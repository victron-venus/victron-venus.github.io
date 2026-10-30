/* Site-wide motion, live metadata and client-side page loading.
   Content and navigation work without this file; everything here is an
   enhancement. */
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const pageInits = Array.isArray(window.VVPageInits) ? window.VVPageInits : [];
  window.VVPageInits = pageInits;

  const state = {
    navigating: false,
    routing: false,
    revealObserver: null,
    livePromise: null,
    liveReady: false,
    lastFocused: null,
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  /* ---------- Chrome: progress, status, header ---------- */

  function ensureChrome() {
    if (!$("#route-progress")) {
      const progress = document.createElement("div");
      progress.id = "route-progress";
      progress.setAttribute("aria-hidden", "true");
      progress.innerHTML = "<i></i>";
      document.body.prepend(progress);
    }
    if (!$(".route-status")) {
      const status = document.createElement("p");
      status.className = "route-status";
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      status.textContent = "Page loading status";
      document.body.append(status);
    }
  }

  function progress(value) {
    const bar = $("#route-progress");
    if (!bar) return;
    const line = bar.firstElementChild;
    bar.classList.toggle("is-active", value > 0);
    line.style.width = `${Math.max(0, Math.min(100, value))}%`;
  }

  function announce(message) {
    const status = $(".route-status");
    if (!status) return;
    status.textContent = "";
    window.setTimeout(() => { status.textContent = message; }, 40);
  }

  function normalizeHeaderLinks() {
    const header = $(".nav");
    if (!header) return;
    header.querySelectorAll("a[href]").forEach((link) => {
      const url = new URL(link.href);
      if (url.origin !== location.origin) return;
      const pathname = url.pathname.replace(/index\.html$/, "");
      link.setAttribute("href", `${pathname}${url.search}${url.hash}`);
    });
  }

  function initHeader() {
    const header = $(".nav");
    if (!header) return;
    let ticking = false;
    const update = () => {
      ticking = false;
      header.classList.toggle("is-scrolled", window.scrollY > 14);
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    update();
  }

  function initNavState() {
    const links = $$(".nav-links a, .mobile-links a");
    const here = location.pathname.replace(/index\.html$/, "");
    const hash = location.hash;
    const local = links
      .map((link) => ({ link, url: new URL(link.href) }))
      .filter(({ url }) => url.origin === location.origin);
    const scopedHash = hash.startsWith("#catalog-") ? "#projects" : hash;
    for (const { link, url } of local) {
      const samePage = url.pathname === here;
      const isCurrent = samePage && (url.hash
        ? scopedHash === url.hash || scopedHash.startsWith(`${url.hash}-`)
        : !hash);
      if (isCurrent) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
  }

  /* ---------- Reveal ---------- */

  const REVEAL_SELECTOR = [
    "main .sec-head",
    "main .section-heading",
    "main .prose > h2",
    "main .path-list a",
    "main .proj",
    "main .wcard",
    "main .layer",
    "main .callout",
    "main .diagram-wrap",
    "main .stats",
    "main .cta-band",
    "main .wiki-cards",
  ].join(",");

  function initReveal(root) {
    if (state.revealObserver) state.revealObserver.disconnect();
    if (!document.querySelector("main")) return;
    const scope = root.nodeType === 9 ? root.body : root;
    const targets = $$(REVEAL_SELECTOR, scope).filter((el) => !el.closest(".hero") && !el.dataset.reveal);
    if (!targets.length) return;

    targets.forEach((el, index) => {
      el.dataset.reveal = "";
      el.style.setProperty("--reveal-delay", `${Math.min(index % 6, 5) * 55}ms`);
    });

    if (reduceMotion.matches || !("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.01 });
    targets.forEach((el) => observer.observe(el));
    state.revealObserver = observer;
  }

  /* ---------- Pointer depth ---------- */

  function initTilt(root) {
    if (reduceMotion.matches || !finePointer.matches) return;
    const scope = root.nodeType === 9 ? root.body : root;
    $$(".proj, .wcard", scope).forEach((card) => {
      if (card.dataset.tilt) return;
      card.dataset.tilt = "1";
      let frame = 0;
      let point = null;

      const apply = () => {
        frame = 0;
        if (!point) return;
        const rect = card.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (point.x - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (point.y - rect.top) / rect.height));
        card.style.setProperty("--ry", `${((x - 0.5) * 5.2).toFixed(2)}deg`);
        card.style.setProperty("--rx", `${((0.5 - y) * 5.2).toFixed(2)}deg`);
        card.style.setProperty("--px", `${(x * 100).toFixed(1)}%`);
        card.style.setProperty("--py", `${(y * 100).toFixed(1)}%`);
      };

      card.addEventListener("pointermove", (event) => {
        if (event.pointerType === "touch") return;
        point = { x: event.clientX, y: event.clientY };
        if (!frame) frame = window.requestAnimationFrame(apply);
      }, { passive: true });

      card.addEventListener("pointerleave", () => {
        point = null;
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
      });
    });
  }

  function initConstellation(root) {
    const scope = root.nodeType === 9 ? root.body : root;
    const art = $(".constellation", scope);
    if (!art || art.dataset.parallax || reduceMotion.matches || !finePointer.matches) return;
    art.dataset.parallax = "1";
    let frame = 0;
    let point = null;

    const apply = () => {
      frame = 0;
      if (!point) return;
      const rect = art.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, ((point.x - rect.left) / rect.width) * 2 - 1));
      const y = Math.max(-1, Math.min(1, ((point.y - rect.top) / rect.height) * 2 - 1));
      art.style.setProperty("--mx", x.toFixed(3));
      art.style.setProperty("--my", y.toFixed(3));
    };

    art.addEventListener("pointermove", (event) => {
      point = { x: event.clientX, y: event.clientY };
      if (!frame) frame = window.requestAnimationFrame(apply);
    }, { passive: true });

    art.addEventListener("pointerleave", () => {
      point = null;
      art.style.setProperty("--mx", "0");
      art.style.setProperty("--my", "0");
    });
  }

  /* ---------- Live GitHub metadata ---------- */

  const LIVE_CACHE = "vv:github:v1";
  const LIVE_TTL = 30 * 60 * 1000;

  function readCache() {
    try {
      const cached = JSON.parse(sessionStorage.getItem(LIVE_CACHE) || "null");
      if (cached && Array.isArray(cached.repos) && Date.now() - cached.at < LIVE_TTL) return cached;
    } catch (error) { /* storage can be unavailable */ }
    return null;
  }

  function writeCache(repos) {
    try {
      sessionStorage.setItem(LIVE_CACHE, JSON.stringify({ at: Date.now(), repos }));
    } catch (error) { /* storage can be unavailable */ }
  }

  async function fetchJson(url) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 9000);
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/vnd.github+json" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`GitHub ${response.status}`);
      return await response.json();
    } finally {
      window.clearTimeout(timer);
    }
  }

  function loadRepos() {
    if (state.livePromise) return state.livePromise;
    const cached = readCache();
    if (cached) return Promise.resolve({ repos: cached.repos, cached: true });

    const endpoints = [
      "https://api.github.com/orgs/victron-venus/repos?type=public&per_page=100&sort=pushed",
      "https://api.github.com/users/4alvit/repos?type=public&per_page=100&sort=pushed",
    ];
    state.livePromise = Promise.all(
      endpoints.map((url) => fetchJson(url).catch(() => []))
    ).then((lists) => {
      const repos = lists.flat().filter((repo) => repo && repo.full_name);
      if (!repos.length) throw new Error("GitHub metadata unavailable");
      writeCache(repos);
      return { repos, cached: false };
    }).catch((error) => {
      state.livePromise = null;
      throw error;
    });
    return state.livePromise;
  }

  function repoFromCard(card) {
    const link = card.querySelector('a[href^="https://github.com/"]');
    if (!link) return "";
    const match = /^https:\/\/github\.com\/([^/]+)\/([^/?#]+)/.exec(link.href);
    return match ? `${match[1]}/${match[2]}`.toLowerCase() : "";
  }

  function relativeDate(value) {
    const time = Date.parse(value);
    if (Number.isNaN(time)) return "";
    const days = Math.max(0, Math.floor((Date.now() - time) / 86400000));
    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
  }

  function decorateCard(card, repo) {
    if (!repo || card.querySelector(".repo-live")) return;
    const live = document.createElement("div");
    live.className = "repo-live";
    live.setAttribute("aria-label", "Live GitHub metadata");

    const stars = document.createElement("span");
    stars.className = "star";
    stars.textContent = `★ ${Number(repo.stargazers_count || 0).toLocaleString("en-US")}`;
    stars.title = `${repo.stargazers_count || 0} GitHub stars`;
    live.append(stars);

    if (repo.forks_count) {
      const forks = document.createElement("span");
      const count = Number(repo.forks_count);
      forks.textContent = `${count.toLocaleString("en-US")} fork${count === 1 ? "" : "s"}`;
      forks.title = `${count} GitHub forks`;
      live.append(forks);
    }

    if (repo.pushed_at) {
      const updated = document.createElement("span");
      updated.className = "live-updated";
      updated.textContent = `updated ${relativeDate(repo.pushed_at)}`;
      updated.title = `Last push: ${new Date(repo.pushed_at).toISOString().slice(0, 10)}`;
      live.append(updated);
    }

    card.append(live);
  }

  function setCatalogStatus(message, liveState) {
    const bar = $(".catalog-live");
    if (!bar) return;
    bar.dataset.liveState = liveState;
    const text = $("[data-live-message]", bar);
    if (text) text.textContent = message;
  }

  function initLive(root) {
    const scope = root.nodeType === 9 ? root.body : root;
    const cards = $$(".proj", scope);
    const counters = $$("[data-live-count]", document);
    if (!cards.length && !counters.length) return;

    document.body.dataset.live = state.liveReady ? "ready" : "loading";
    if (!state.liveReady) setCatalogStatus("Syncing live GitHub metadata…", "loading");

    loadRepos().then(({ repos }) => {
      const byName = new Map(repos.map((repo) => [repo.full_name.toLowerCase(), repo]));
      cards.forEach((card) => decorateCard(card, byName.get(repoFromCard(card))));

      const count = new Set(repos.map((repo) => repo.full_name.toLowerCase())).size;
      counters.forEach((counter) => { counter.textContent = String(count); });
      $$(".live-stat").forEach((chip) => { chip.hidden = false; });
      document.body.dataset.live = "ready";
      state.liveReady = true;
      setCatalogStatus(`GitHub metadata · ${count} public repositories`, "ready");
    }).catch(() => {
      document.body.dataset.live = "off";
      setCatalogStatus("Curated catalog · live metadata unavailable", "off");
    });
  }

  /* ---------- Year ---------- */

  function initYear() {
    $$("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });
  }

  /* ---------- Page bootstrap ---------- */

  function initPage(root = document) {
    const scope = root.nodeType === 9 ? root.body : root;
    initNavState();
    initReveal(scope);
    initTilt(scope);
    initConstellation(scope);
    initLive(scope);
    initYear();
    for (const init of pageInits) {
      try { init(scope); } catch (error) { console.error("Page enhancement failed", error); }
    }
    document.dispatchEvent(new CustomEvent("vv:page", { detail: { root: scope } }));
  }

  /* ---------- Client-side navigation ---------- */

  function isRoutable(link) {
    if (!link || link.target || link.hasAttribute("download") || link.dataset.noRoute !== undefined) return false;
    if (link.origin !== location.origin) return false;
    if (!/\/$|\.html$/.test(link.pathname)) return false;
    return true;
  }

  function samePageHash(link) {
    return link.pathname === location.pathname && Boolean(link.hash);
  }

  function scrollToTarget(url) {
    if (url.hash) {
      let id = "";
      try { id = decodeURIComponent(url.hash.slice(1)); } catch (error) { id = url.hash.slice(1); }
      const target = id ? document.getElementById(id) : null;
      if (target) {
        const header = document.querySelector(".nav");
        const offset = (header ? header.getBoundingClientRect().height : 60) + 36;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion.matches ? "auto" : "smooth" });
        return;
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  function updateMetadata(doc, url) {
    document.title = doc.title;
    const description = doc.querySelector('meta[name="description"]');
    const current = document.querySelector('meta[name="description"]');
    if (description && current) current.setAttribute("content", description.content);

    const canonical = doc.querySelector('link[rel="canonical"]');
    const currentCanonical = document.querySelector('link[rel="canonical"]');
    if (canonical && currentCanonical) currentCanonical.setAttribute("href", canonical.href);

    const ogTitle = doc.querySelector('meta[property="og:title"]');
    const currentOgTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && currentOgTitle) currentOgTitle.setAttribute("content", ogTitle.content);

    const ogDescription = doc.querySelector('meta[property="og:description"]');
    const currentOgDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription && currentOgDescription) currentOgDescription.setAttribute("content", ogDescription.content);

    const ogUrl = doc.querySelector('meta[property="og:url"]');
    const currentOgUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl && currentOgUrl) currentOgUrl.setAttribute("content", url.href);

    const theme = doc.querySelector('meta[name="theme-color"]');
    const currentTheme = document.querySelector('meta[name="theme-color"]');
    if (theme && currentTheme) currentTheme.setAttribute("content", theme.content);
  }

  function swapPage(doc, url) {
    const nextMain = doc.querySelector("main#main") || doc.querySelector("main");
    if (!nextMain) throw new Error("No main content in response");

    updateMetadata(doc, url);
    document.body.className = doc.body.className || "";

    const oldMain = document.querySelector("main");
    if (oldMain) oldMain.replaceWith(nextMain);

    const nextFooter = doc.querySelector("footer");
    const oldFooter = document.querySelector("footer");
    if (nextFooter && oldFooter) oldFooter.replaceWith(nextFooter);
    else if (nextFooter) document.body.append(nextFooter);
    else if (oldFooter) oldFooter.remove();

    $$("details[open]").forEach((details) => { details.open = false; });

    nextMain.setAttribute("tabindex", "-1");
    nextMain.focus({ preventScroll: true });
    initPage(nextMain);
    state.lastFocused = null;
    announce(`${document.title} loaded`);
  }

  async function navigate(href, options = {}) {
    const url = new URL(href, location.href);
    const historyNavigation = options.history === "none";
    if (state.navigating) return;
    if (!historyNavigation && url.href === location.href && !url.hash) return;
    state.navigating = true;
    state.routing = true;
    document.documentElement.classList.add("is-routing");
    progress(14);

    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 12000);
      let response;
      try {
        response = await fetch(url.href, {
          credentials: "same-origin",
          headers: { Accept: "text/html" },
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timer);
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      progress(62);

      const swap = () => {
        swapPage(doc, url);
        progress(100);
      };

      if (document.startViewTransition && !reduceMotion.matches) {
        const transition = document.startViewTransition(swap);
        await transition.finished.catch(() => {});
      } else {
        swap();
      }

      if (options.history !== "none") {
        const method = options.replace ? "replaceState" : "pushState";
        history[method]({}, "", url.href);
        initNavState();
      }

      window.requestAnimationFrame(() => scrollToTarget(url));
      state.routing = false;
      document.documentElement.classList.remove("is-routing");
      window.setTimeout(() => progress(0), 320);
    } catch (error) {
      location.assign(url.href);
    } finally {
      state.navigating = false;
    }
  }

  function prefetch(link) {
    if (!finePointer.matches || link.dataset.prefetched) return;
    link.dataset.prefetched = "1";
    const hint = document.createElement("link");
    hint.rel = "prefetch";
    hint.href = link.pathname;
    hint.as = "document";
    document.head.append(hint);
  }

  function initRouter() {
    document.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest("a[href]");
      if (!link || !isRoutable(link)) return;
      if (samePageHash(link)) return;
      if (link.href === location.href) return;
      event.preventDefault();
      navigate(link.href);
    });

    document.addEventListener("mouseover", (event) => {
      const link = event.target.closest("a[href]");
      if (link && isRoutable(link) && !samePageHash(link)) prefetch(link);
    }, { passive: true });

    window.addEventListener("popstate", () => {
      navigate(location.href, { history: "none" });
    });
    window.addEventListener("hashchange", initNavState);
  }

  function boot() {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    ensureChrome();
    normalizeHeaderLinks();
    initHeader();
    initRouter();
    initPage(document);
  }

  window.VV = {
    register(init) { if (typeof init === "function") pageInits.push(init); },
    init: initPage,
    navigate,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
