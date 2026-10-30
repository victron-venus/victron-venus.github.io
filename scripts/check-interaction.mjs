#!/usr/bin/env node
/**
 * Browser check for visible keyboard focus and hover feedback.
 *
 * Runs against the deployed site by default. A real Chrome/Chromium is driven
 * over the DevTools pipe (`--remote-debugging-pipe`), so there is no npm
 * dependency, no WebSocket client and no downloaded browser.
 *
 * For every colour scheme and viewport it:
 *   - walks the page with Tab and verifies each stop matches `:focus-visible`,
 *     has a visible focus indicator and that the indicator reaches 3:1
 *     contrast against the surface behind it (WCAG 1.4.11);
 *   - hovers representative controls and verifies the computed style changes
 *     visibly, without relying on screenshots or pixel diffs.
 *
 * The check complements scripts/check-contrast.py: the token check proves the
 * palette, this one proves the browser actually applies it to focus and hover.
 *
 * Usage:
 *   node scripts/check-interaction.mjs
 *   node scripts/check-interaction.mjs --url http://127.0.0.1:4173/
 *   node scripts/check-interaction.mjs --scheme dark --viewport desktop
 *   CHROME_PATH=/usr/bin/chromium node scripts/check-interaction.mjs
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_URL = "https://victron-venus.github.io/";
const FOCUSABLE = 'a[href],button,input:not([type="hidden"]),select,textarea,summary,[tabindex]:not([tabindex="-1"])';
const MIN_FOCUS_CONTRAST = 3; // WCAG 2.2 1.4.11 non-text contrast.
const TRANSITION_MS = 400; // Longest interactive transition in the stylesheets.
const TAB_LIMIT = 400;

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];
const SCHEMES = ["light", "dark"];

// Representative controls. Hover is only required where the design defines a
// hover state; text fields intentionally have none and are covered by focus.
const HOVER_CONTROLS = [
  ["brand", ".nav .brand"],
  ["header navigation link", ".nav-links a"],
  ["GitHub link", ".nav .nav-gh"],
  ["documentation search toggle", ".doc-search summary"],
  ["theme toggle", ".theme-toggle"],
  ["primary action", ".btn-primary"],
  ["secondary action", ".btn-ghost"],
  ["starting-point row", ".path-list a"],
  ["topology node", ".node"],
  ["project card", ".proj"],
  ["catalog filter", ".filter-btn"],
  ["guide card", ".wcard"],
  ["guide outline link", ".guide-toc a"],
  ["guide back-to-top", ".guide-top"],
  ["inline code copy button", ".copy-code"],
  ["footer link", "footer a"],
  ["language selector", ".lang-select"],
];

const HELP = `Usage: node scripts/check-interaction.mjs [options]

Options:
  --url <url>          page to check (default ${DEFAULT_URL})
  --browser <path>     Chrome/Chromium executable (default: auto-detect)
  --scheme <name>      light, dark or both (default both)
  --viewport <name>    desktop, mobile or both (default both)
  --timeout <seconds>  navigation timeout (default 30)
  --verbose            print every passing focus and hover check
  --help               show this message
`;

function parseArgs(argv) {
  const options = { url: DEFAULT_URL, browser: "", scheme: "both", viewport: "both", timeout: 30, verbose: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      process.stdout.write(HELP);
      process.exit(0);
    }
    if (argument === "--verbose") {
      options.verbose = true;
      continue;
    }
    if (!argument.startsWith("--")) throw new Error(`Unexpected argument: ${argument}`);
    const [flag, inline] = argument.split("=", 2);
    const value = inline ?? argv[++index];
    if (value === undefined) throw new Error(`Missing value for ${flag}`);
    if (flag === "--url") options.url = value;
    else if (flag === "--browser") options.browser = value;
    else if (flag === "--scheme") options.scheme = value;
    else if (flag === "--viewport") options.viewport = value;
    else if (flag === "--timeout") options.timeout = Number(value);
    else throw new Error(`Unknown option: ${flag}`);
  }
  if (!Number.isFinite(options.timeout) || options.timeout <= 0) throw new Error("--timeout must be a positive number");
  if (!["light", "dark", "both"].includes(options.scheme)) throw new Error("--scheme must be light, dark or both");
  if (!["desktop", "mobile", "both"].includes(options.viewport)) throw new Error("--viewport must be desktop, mobile or both");
  try {
    options.url = new URL(options.url).href;
  } catch {
    throw new Error(`Invalid --url: ${options.url}`);
  }
  return options;
}

function findBrowser(explicit) {
  if (explicit) {
    if (!existsSync(explicit)) throw new Error(`Browser not found: ${explicit}`);
    return explicit;
  }
  if (process.env.CHROME_PATH) {
    if (!existsSync(process.env.CHROME_PATH)) throw new Error(`CHROME_PATH not found: ${process.env.CHROME_PATH}`);
    return process.env.CHROME_PATH;
  }
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
    "/opt/google/chrome/chrome",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ];
  const browser = candidates.find((candidate) => existsSync(candidate));
  if (!browser) {
    throw new Error("No Chrome/Chromium found. Pass --browser or set CHROME_PATH.");
  }
  return browser;
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

class Protocol {
  constructor(process) {
    this.process = process;
    this.buffer = Buffer.alloc(0);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.stderr = "";
    process.stderr.setEncoding("utf8");
    process.stderr.on("data", (chunk) => {
      this.stderr = (this.stderr + chunk).slice(-4000);
    });
    process.stdio[4].on("data", (chunk) => this.receive(chunk));
    process.on("exit", (code) => {
      const error = new Error(`Browser exited (${code}).${this.stderr ? `\n${this.stderr}` : ""}`);
      for (const entry of this.pending.values()) entry.reject(error);
      this.pending.clear();
    });
  }

  receive(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    let boundary;
    while ((boundary = this.buffer.indexOf(0)) !== -1) {
      const raw = this.buffer.subarray(0, boundary).toString("utf8");
      this.buffer = this.buffer.subarray(boundary + 1);
      if (!raw.trim()) continue;
      let message;
      try {
        message = JSON.parse(raw);
      } catch {
        continue;
      }
      if (message.id !== undefined) {
        const entry = this.pending.get(message.id);
        if (!entry) continue;
        this.pending.delete(message.id);
        if (message.error) entry.reject(new Error(`${message.error.message} (${message.error.code})`));
        else entry.resolve(message.result ?? {});
      } else if (message.method) {
        for (const listener of this.listeners.get(message.method) ?? []) listener(message.params ?? {});
      }
    }
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const payload = JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) });
      this.process.stdio[3].write(payload + "\0");
    });
  }

  once(method, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${method}`)), timeoutMs);
      timer.unref?.();
      const listener = (params) => {
        clearTimeout(timer);
        const list = this.listeners.get(method) ?? [];
        this.listeners.set(method, list.filter((item) => item !== listener));
        resolve(params);
      };
      this.listeners.set(method, [...(this.listeners.get(method) ?? []), listener]);
    });
  }

  close() {
    try {
      this.process.stdio[3].end();
    } catch {
      // The browser may already have closed the pipe.
    }
  }
}

class Page {
  constructor(protocol, sessionId, timeoutMs) {
    this.protocol = protocol;
    this.sessionId = sessionId;
    this.timeoutMs = timeoutMs;
  }

  send(method, params = {}) {
    return this.protocol.send(method, params, this.sessionId);
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: false,
    });
    if (result.exceptionDetails) {
      const message = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text;
      throw new Error(`Page evaluation failed: ${message}`);
    }
    return result.result?.value;
  }

  async goto(url) {
    const loaded = this.protocol.once("Page.loadEventFired", this.timeoutMs);
    loaded.catch(() => {}); // Navigation errors are reported below, not by the timer.
    const navigation = await this.send("Page.navigate", { url });
    if (navigation.errorText) throw new Error(`Navigation failed: ${navigation.errorText}`);
    await Promise.race([loaded, sleep(this.timeoutMs)]);
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if ((await this.evaluate("document.readyState")) === "complete") break;
      await sleep(50);
    }
    // app.js runs deferred; one extra frame plus its small post-load work.
    await this.evaluate("new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 350)))");
  }

  async key(key, code, windowsVirtualKeyCode) {
    await this.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key,
      code,
      windowsVirtualKeyCode,
      nativeVirtualKeyCode: windowsVirtualKeyCode,
    });
    await this.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key,
      code,
      windowsVirtualKeyCode,
      nativeVirtualKeyCode: windowsVirtualKeyCode,
    });
  }

  async tab() {
    await this.key("Tab", "Tab", 9);
    await this.evaluate("new Promise((resolve) => requestAnimationFrame(() => resolve()))");
  }
}

const INSTALL_HELPERS = `(() => {
  const parse = (value) => {
    const match = String(value).match(/rgba?\\(([^)]+)\\)/i);
    if (!match) return null;
    const parts = match[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };
  const blend = (top, bottom) => {
    const alpha = Math.min(1, Math.max(0, top.a));
    return {
      r: Math.round(top.r * alpha + bottom.r * (1 - alpha)),
      g: Math.round(top.g * alpha + bottom.g * (1 - alpha)),
      b: Math.round(top.b * alpha + bottom.b * (1 - alpha)),
      a: 1,
    };
  };
  const luminance = (color) => {
    const channel = (value) => {
      const scaled = value / 255;
      return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
  };
  const contrast = (first, second) => {
    const a = luminance(first);
    const b = luminance(second);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  const surfaceBehind = (element) => {
    const chain = [];
    for (let node = element.parentElement; node; node = node.parentElement) chain.push(node);
    let surface = { r: 255, g: 255, b: 255, a: 1 };
    for (const node of chain.reverse()) {
      const color = parse(getComputedStyle(node).backgroundColor);
      if (color && color.a > 0) surface = blend(color, surface);
    }
    return surface;
  };
  const shadowColor = (value) => {
    if (!value || value === "none") return null;
    const matches = [...String(value).matchAll(/rgba?\\(([^)]+)\\)/gi)];
    if (!matches.length) return null;
    const colors = matches.map((match) => parse(match[0])).filter(Boolean);
    colors.sort((a, b) => b.a - a.a);
    return colors[0];
  };
  const snapshot = (element) => {
    const style = getComputedStyle(element);
    return {
      color: style.color,
      backgroundColor: style.backgroundColor,
      borderColor: [style.borderTopColor, style.borderRightColor, style.borderBottomColor, style.borderLeftColor],
      borderWidth: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth].map(parseFloat),
      boxShadow: style.boxShadow,
      textDecorationLine: style.textDecorationLine,
      transform: style.transform,
      translate: style.translate,
      opacity: style.opacity,
    };
  };
  const focusOwner = (element) => {
    if (window.__vvFocusables?.includes(element)) return element;
    const descendant = element.querySelector?.(':scope > a[href], :scope > button, :scope > input, :scope > select, :scope > textarea, :scope > summary, :scope > [tabindex]');
    if (descendant && window.__vvFocusables?.includes(descendant)) return descendant;
    const ancestor = element.closest?.('a[href],button,input,select,textarea,summary,[tabindex]');
    if (ancestor && window.__vvFocusables?.includes(ancestor)) return ancestor;
    return element;
  };
  const describe = (element) => {
    if (!element || element === document.body || element === document.documentElement) return null;
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const owner = focusOwner(element);
    const style = getComputedStyle(owner);
    const surface = surfaceBehind(owner);
    const outlineColor = parse(style.outlineColor);
    const borderColor = parse(style.borderTopColor);
    const shadow = shadowColor(style.boxShadow);
    const svgShape = element.matches?.(".dg-node") ? element.querySelector("rect") : null;
    const svgStroke = svgShape ? parse(getComputedStyle(svgShape).stroke) : null;
    const svgFill = svgShape ? parse(getComputedStyle(svgShape).fill) : null;
    const base = window.__vvBase?.get(owner);
    return {
      index: window.__vvFocusables ? window.__vvFocusables.indexOf(owner) : -1,
      tag: element.tagName.toLowerCase(),
      id: element.id || "",
      classes: typeof element.className === "string" ? element.className : "",
      text: (element.innerText || element.textContent || element.getAttribute("aria-label") || "").trim().replace(/\\s+/g, " ").slice(0, 60),
      focusVisible: element.matches(":focus-visible") || owner.matches(":focus-visible"),
      focusWithin: element.matches(":focus-within"),
      insideSvg: Boolean(element.closest("svg")),
      outlineChanged: !base || base.outline !== style.outline,
      borderChanged: !base || base.borderColor !== style.borderTopColor || base.borderWidth !== style.borderTopWidth,
      shadowChanged: !base || base.boxShadow !== style.boxShadow,
      svgChanged: Boolean(base?.svgStroke && svgShape && base.svgStroke !== getComputedStyle(svgShape).stroke),
      svg: Boolean(svgStroke && svgFill),
      // The stroke is an edge: it is visible against the page as well as the fill.
      svgContrast: svgStroke && svgFill ? Math.max(contrast(svgStroke, svgFill), contrast(svgStroke, surface)) : 0,
      outlineStyle: style.outlineStyle,
      outlineWidth: parseFloat(style.outlineWidth),
      outlineColor,
      outlineContrast: outlineColor ? contrast(outlineColor, surface) : 0,
      boxShadow: shadow,
      shadowContrast: shadow ? contrast(shadow, surface) : 0,
      borderColor,
      borderWidth: parseFloat(style.borderTopWidth),
      borderContrast: borderColor ? contrast(borderColor, surface) : 0,
      surface,
      rect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
      viewport: { width: innerWidth, height: innerHeight },
    };
  };
  window.__vv = { parse, contrast, surfaceBehind, snapshot, describe };
  return true;
})()`;

function describeTarget(info) {
  const name = info.text ? `"${info.text}"` : info.tag;
  const classes = info.classes ? `.${info.classes.trim().split(/\s+/).join(".")}` : "";
  return `${info.tag}${classes} ${name}`.trim();
}


function checkFocus(info, label) {
  const failures = [];
  if (!info.focusVisible && !(info.svg && info.focusWithin)) {
    failures.push("focused element does not match :focus-visible");
  }
  if (info.rect.bottom < 0 || info.rect.top > info.viewport.height) {
    failures.push("focused element did not scroll into the viewport");
  }
  if (info.svg && info.focusWithin) {
    if (!info.svgChanged) failures.push("SVG focus does not change the shape stroke");
    if (info.svgContrast < MIN_FOCUS_CONTRAST) {
      failures.push(`SVG focus stroke contrast ${info.svgContrast.toFixed(2)}:1 is below ${MIN_FOCUS_CONTRAST}:1`);
    }
    return { failures, detail: `SVG stroke ${info.svgContrast.toFixed(2)}:1`, label };
  }
  const outlineVisible =
    info.outlineChanged &&
    info.outlineStyle !== "none" &&
    info.outlineWidth >= 2 &&
    info.outlineColor &&
    info.outlineColor.a > 0;
  const borderVisible = info.borderChanged && info.borderWidth > 0 && info.borderColor && info.borderColor.a > 0;
  const shadowVisible = info.shadowChanged && Boolean(info.boxShadow && info.boxShadow.a >= 0.25);
  const indicators = [];
  if (outlineVisible) indicators.push(["outline", info.outlineContrast]);
  if (borderVisible) indicators.push(["border", info.borderContrast]);
  if (shadowVisible) indicators.push(["shadow", info.shadowContrast]);
  const chosen = indicators.sort((first, second) => second[1] - first[1])[0];
  if (!chosen) {
    failures.push("no outline, border or shadow is drawn for focus");
  } else if (chosen[1] < MIN_FOCUS_CONTRAST) {
    failures.push(`${chosen[0]} contrast ${chosen[1].toFixed(2)}:1 is below ${MIN_FOCUS_CONTRAST}:1`);
  }
  return { failures, detail: chosen ? `${chosen[0]} ${chosen[1].toFixed(2)}:1` : "no indicator", label };
}

async function auditFocus(page, label, options) {
  await page.evaluate(`(() => {
    ${INSTALL_HELPERS};
    // Start Tab at the top of the document, not wherever the browser left off,
    // and make focus scrolling instantaneous so the viewport check is stable.
    document.documentElement.style.scrollBehavior = "auto";
    const instant = document.createElement("style");
    instant.id = "vv-focus-instant";
    instant.textContent = "*,*::before,*::after{transition-duration:0s!important;animation-duration:0s!important;animation-delay:0s!important}";
    document.head.append(instant);
    document.body.tabIndex = -1;
    document.body.focus({ preventScroll: true });
    document.body.removeAttribute("tabindex");
    document.activeElement?.blur?.();
    window.__vvFocusables = [...document.querySelectorAll(${JSON.stringify(FOCUSABLE)})].filter((element) => {
      if (element.disabled) return false;
      if (element.closest("details:not([open]) > :not(summary)")) return false;
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    // Baseline per control, so a permanent border cannot masquerade as focus.
    window.__vvBase = new Map(window.__vvFocusables.map((element) => {
      const style = getComputedStyle(element);
      const node = element.closest("g.dg-node");
      const shape = node?.querySelector("rect");
      return [element, {
        outline: style.outline,
        borderColor: style.borderTopColor,
        borderWidth: style.borderTopWidth,
        boxShadow: style.boxShadow,
        svgStroke: shape ? getComputedStyle(shape).stroke : null,
      }];
    }));
    return window.__vvFocusables.length;
  })()`);
  const expected = await page.evaluate("window.__vvFocusables.length");
  const visited = new Set();
  const failures = [];
  let duplicate = null;
  for (let step = 0; step < Math.min(TAB_LIMIT, expected + 40); step += 1) {
    await page.tab();
    const info = await page.evaluate("window.__vv.describe(document.activeElement)");
    if (!info) break; // The Tab sequence left the document.
    if (info.index < 0) {
      // Chrome adds scrollable regions (e.g. wide tables) to the Tab order.
      // They are not controls, so continue walking instead of ending the audit.
      if (options.verbose) console.log(`  SKIP non-control Tab stop ${label} · ${describeTarget(info)}`);
      continue;
    }
    if (visited.has(info.index)) {
      // An SVG link exposes both its <g> and its <a> as separate Tab stops.
      // They describe one visual control, so skip the inner duplicate.
      if (info.insideSvg) {
        if (options.verbose) console.log(`  SKIP duplicate SVG stop ${label} · ${describeTarget(info)}`);
        continue;
      }
      duplicate = info.index;
      if (options.verbose) console.log(`  STOP duplicate ${label} · ${describeTarget(info)} · index ${info.index}`);
      break;
    }
    visited.add(info.index);
    const result = checkFocus(info, describeTarget(info));
    if (result.failures.length) {
      failures.push({ label: result.label, failures: result.failures, scheme: label });
      if (options.verbose) console.log(`  FAIL focus ${label} · ${result.label} · ${result.failures.join("; ")}`);
    } else if (options.verbose) {
      console.log(`  PASS focus ${label} · ${result.label} · ${result.detail}`);
    }
  }
  await page.evaluate(`document.getElementById("vv-focus-instant")?.remove()`);
  const unreached = expected - visited.size;
  if (unreached > 0) {
    failures.push({
      label: `${unreached} focusable element${unreached === 1 ? "" : "s"} not reached by Tab`,
      failures: [`expected ${expected} controls, visited ${visited.size}`],
      scheme: label,
    });
  }
  return { expected, visited: visited.size, failures, wrapped: duplicate !== null, unreached };
}

async function hoverCheck(page, selector, options) {
  const found = await page.evaluate(`(() => {
    ${INSTALL_HELPERS};
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return { found: false };
    element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
    return { found: true };
  })()`);
  if (!found.found) return { skip: `selector not present: ${selector}` };
  await sleep(900);
  const before = await page.evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    const rect = element.getBoundingClientRect();
    return {
      style: window.__vv.snapshot(element),
      point: { x: Math.min(innerWidth - 2, Math.max(2, rect.left + rect.width / 2)), y: Math.min(innerHeight - 2, Math.max(2, rect.top + rect.height / 2)) },
      inViewport: rect.top >= 0 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth,
      surface: window.__vv.surfaceBehind(element),
    };
  })()`);
  if (!before.inViewport) return { skip: `${selector} is not fully in the viewport` };
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: before.point.x, y: before.point.y, button: "none" });
  await sleep(TRANSITION_MS);
  let after = await page.evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    return { style: window.__vv.snapshot(element), hovered: element.matches(":hover") };
  })()`);
  if (!after.hovered) {
    // Floating hero nodes can drift between measuring the rect and the event.
    const point = await page.evaluate(`(() => {
      const rect = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
      return { x: Math.min(innerWidth - 2, Math.max(2, rect.left + rect.width / 2)), y: Math.min(innerHeight - 2, Math.max(2, rect.top + rect.height / 2)) };
    })()`);
    await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y, button: "none" });
    await sleep(120);
    after = await page.evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      return { style: window.__vv.snapshot(element), hovered: element.matches(":hover") };
    })()`);
  }
  if (!after.hovered) {
    const hit = await page.evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      const rect = element.getBoundingClientRect();
      const x = Math.min(innerWidth - 2, Math.max(2, rect.left + rect.width / 2));
      const y = Math.min(innerHeight - 2, Math.max(2, rect.top + rect.height / 2));
      const top = document.elementFromPoint(x, y);
      return { point: { x, y }, rect: rect.toJSON(), top: top?.outerHTML?.slice(0, 120) ?? null, contains: Boolean(top && element.contains(top)), scrollY };
    })()`);
    return { skip: `${selector} is not under the pointer (${JSON.stringify(hit)})` };
  }
  const changes = Object.keys(before.style).filter(
    (property) => JSON.stringify(before.style[property]) !== JSON.stringify(after.style[property]),
  );
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2, y: 2, button: "none" });
  if (!changes.length) {
    return { failure: `${selector} has no visible hover change` };
  }
  return { pass: `${selector} changes ${changes.join(", ")}` };
}

async function auditHover(page, label, options) {
  const failures = [];
  let checked = 0;
  let skipped = 0;
  for (const [name, selector] of HOVER_CONTROLS) {
    const result = await hoverCheck(page, selector, options);
    if (result.failure) failures.push({ label: name, failures: [result.failure], scheme: label });
    if (result.skip) {
      skipped += 1;
      if (options.verbose) console.log(`  SKIP hover ${label} · ${name} · ${result.skip}`);
    }
    if (result.pass) {
      checked += 1;
      if (options.verbose) console.log(`  PASS hover ${label} · ${name}`);
    }
  }
  return { checked, skipped, failures };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const schemes = options.scheme === "both" ? SCHEMES : [options.scheme];
  const viewports = options.viewport === "both" ? VIEWPORTS : VIEWPORTS.filter((item) => item.name === options.viewport);
  const browser = findBrowser(options.browser);
  const profile = mkdtempSync(join(tmpdir(), "vv-interaction-"));
  const browserProcess = spawn(
    browser,
    [
      "--headless",
      "--remote-debugging-pipe",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-sync",
      "--disable-extensions",
      "--disable-gpu",
      "--mute-audio",
      "--window-size=1440,900",
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"] },
  );
  const protocol = new Protocol(browserProcess);
  const failures = [];
  let sessionId = null;
  try {
    const deadline = Date.now() + options.timeout * 1000;
    let target = null;
    while (!target && Date.now() < deadline) {
      const { targetInfos } = await protocol.send("Target.getTargets");
      target = targetInfos?.find((info) => info.type === "page");
      if (!target) await sleep(100);
    }
    if (!target) throw new Error("Chrome did not expose a page target");
    ({ sessionId } = await protocol.send("Target.attachToTarget", { targetId: target.targetId, flatten: true }));
    const page = new Page(protocol, sessionId, options.timeout * 1000);
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("Emulation.setFocusEmulationEnabled", { enabled: true });
    const version = await protocol.send("Browser.getVersion");
    console.log(`Browser: ${version.product} (${browser})`);
    console.log(`Target:  ${options.url}`);
    for (const viewport of viewports) {
      await page.send("Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1,
        mobile: false,
      });
      for (const scheme of schemes) {
        await page.send("Emulation.setEmulatedMedia", {
          features: [{ name: "prefers-color-scheme", value: scheme }],
        });
        await page.goto(options.url);
        await page.evaluate(`(() => { try { localStorage.removeItem("vv-theme"); } catch (error) {} return true; })()`);
        await page.goto(options.url);
        const state = await page.evaluate(`({
          scheme: document.documentElement.dataset.theme,
          mode: document.documentElement.dataset.themeMode,
          title: document.title,
          asset: [...document.querySelectorAll('link[rel="stylesheet"]')].map((link) => link.getAttribute("href")).find((href) => href && href.includes("style.css")) || "",
        })`);
        const label = `${scheme}/${viewport.name}`;
        if (state.scheme !== scheme) {
          failures.push({ scheme: label, label: "colour scheme", failures: [`expected ${scheme}, page resolved ${state.scheme}`] });
          continue;
        }
        if (state.mode !== "system") {
          failures.push({ scheme: label, label: "colour scheme", failures: [`expected system mode, page reports ${state.mode}`] });
          continue;
        }
        // Open both disclosures so their controls are keyboard reachable.
        await page.evaluate(`(() => {
          document.querySelectorAll("details.doc-search, details.mobile-nav").forEach((details) => { details.open = true; });
          return true;
        })()`);
        await sleep(250);
        console.log(`\n${scheme} / ${viewport.name} — ${state.title} · asset ${state.asset.split("?")[1] || "unversioned"}`);
        const focus = await auditFocus(page, label, options);
        // Disclosures opened for keyboard reachability would otherwise sit over
        // the hero and intercept the pointer during the hover pass.
        await page.evaluate(`(() => { document.querySelectorAll("details[open]").forEach((details) => { details.open = false; }); return true; })()`);
        await sleep(150);
        const hover = viewport.name === "desktop" ? await auditHover(page, label, options) : { checked: 0, skipped: 0, failures: [] };
        console.log(
          `  focus: ${focus.visited}/${focus.expected} controls checked, ${focus.failures.length} failures` +
            `${hover.checked ? `; hover: ${hover.checked} controls checked, ${hover.failures.length} failures` : ""}` +
            `${hover.skipped ? `, ${hover.skipped} skipped` : ""}`,
        );
        failures.push(...focus.failures, ...hover.failures);
      }
    }
  } finally {
    if (sessionId) await Promise.race([protocol.send("Browser.close").catch(() => {}), sleep(1000)]);
    await sleep(300);
    if (!browserProcess.killed) browserProcess.kill();
    protocol.close();
    rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
  if (failures.length) {
    console.error(`\n${failures.length} interaction failure${failures.length === 1 ? "" : "s"}:`);
    for (const failure of failures) {
      console.error(`  FAIL ${failure.scheme} · ${failure.label}`);
      for (const reason of failure.failures) console.error(`       ${reason}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log("\nFocus and hover states are visible in every checked scheme and viewport.");
}

main().catch((error) => {
  console.error(`Interaction check could not run: ${error.message}`);
  process.exitCode = 2;
});
