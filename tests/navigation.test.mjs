import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../assets/js/app.js', import.meta.url), 'utf8');

function element() {
  const classes = new Set();
  return {
    dataset: {}, style: {}, className: '', textContent: '',
    classList: {
      add: (name) => classes.add(name), remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
      toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); },
    },
    querySelector: () => null, querySelectorAll: () => [],
    setAttribute() {}, focus() {}, append() {}, prepend() {}, remove() {},
  };
}

// Run the complete shipped script and its real registered listeners. Only the
// browser boundary is faked; navigation, rejection handling and state are real.
function site(options = {}) {
  const calls = { fetch: [], assign: [], history: [], errors: [], swaps: 0 };
  const documentEvents = new Map();
  const windowEvents = new Map();
  const listen = (events) => (name, callback) => {
    const listeners = events.get(name) || [];
    listeners.push(callback);
    events.set(name, listeners);
  };
  const dispatch = (events, name, event) => {
    for (const listener of events.get(name) || []) listener(event);
  };
  let current = new URL('https://site.example/index.html');
  const location = {
    get href() { return current.href; }, get origin() { return current.origin; },
    get pathname() { return current.pathname; }, get hash() { return current.hash; },
    assign(href) {
      calls.assign.push(href);
      if (options.assignError) throw options.assignError;
      current = new URL(href);
    },
  };
  const progress = element();
  progress.firstElementChild = element();
  const status = element();
  let main = element();
  main.replaceWith = (next) => { main = next; calls.swaps += 1; };
  const document = {
    nodeType: 9, readyState: 'complete', title: 'Initial page',
    documentElement: element(), body: element(), head: element(),
    querySelector(selector) {
      return ({ '#route-progress': progress, '.route-status': status, main })[selector] || null;
    },
    querySelectorAll: () => [], getElementById: () => null,
    createElement: element, addEventListener: listen(documentEvents),
    dispatchEvent: (event) => dispatch(documentEvents, event.type, event),
  };
  const window = {
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    addEventListener: listen(windowEvents), scrollY: 0, scrollTo() {},
    requestAnimationFrame(callback) { callback(); return 1; },
    setTimeout(callback, delay) {
      // Long network deadlines must not fire early; short presentation updates
      // are flushed deterministically before each assertion.
      if (delay < 1000) queueMicrotask(callback);
      return 1;
    },
    clearTimeout() {},
  };
  class DOMParser {
    parseFromString() {
      const next = element();
      next.replaceWith = (replacement) => { main = replacement; calls.swaps += 1; };
      return {
        title: 'Next page', body: { className: 'next-page' },
        querySelector: (selector) => selector === 'main#main' ? next : null,
      };
    }
  }
  const context = {
    window, document, location, URL, AbortController, DOMParser,
    CustomEvent: class { constructor(type, detail) { this.type = type; this.detail = detail; } },
    console: { error: (...args) => calls.errors.push(args) },
    history: Object.fromEntries(['pushState', 'replaceState'].map((method) => [method,
      (_state, _title, href) => { calls.history.push([method, href]); current = new URL(href); }])),
    async fetch(href, init) {
      calls.fetch.push({ href, init });
      if (options.fetchError) throw options.fetchError;
      return { ok: options.httpStatus === undefined, status: options.httpStatus,
        text: async () => '<main>Next page</main>' };
    },
  };
  vm.runInNewContext(source, context, { filename: 'assets/js/app.js' });
  return {
    calls, document, progress, status, options,
    click(href, modifiers = {}) {
      const url = new URL(href, location.href);
      const link = { href: url.href, origin: url.origin, pathname: url.pathname,
        hash: url.hash, target: '', dataset: {}, hasAttribute: () => false };
      const event = { button: 0, defaultPrevented: false, ...modifiers,
        target: { closest: (selector) => selector === 'a[href]' ? link : null },
        preventDefault() { this.defaultPrevented = true; } };
      dispatch(documentEvents, 'click', event);
      return event;
    },
    popstate(href) {
      current = new URL(href, location.href);
      dispatch(windowEvents, 'popstate', {});
    },
  };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test('click navigation swaps content and creates one history entry', async () => {
  const page = site();
  assert.equal(page.click('/next.html').defaultPrevented, true);
  await settle();
  assert.equal(page.calls.swaps, 1);
  assert.deepEqual(page.calls.history, [['pushState', 'https://site.example/next.html']]);
  assert.equal(page.calls.assign.length, 0);
  assert.equal(page.calls.errors.length, 0);
});

test('popstate swaps content without adding a history entry', async () => {
  const page = site();
  page.popstate('/previous.html');
  await settle();
  assert.equal(page.calls.swaps, 1);
  assert.equal(page.calls.fetch[0].href, 'https://site.example/previous.html');
  assert.equal(page.calls.history.length, 0);
  assert.equal(page.calls.assign.length, 0);
});

for (const trigger of ['click', 'popstate']) {
  test(`${trigger}: network failure retains native page-load fallback`, async () => {
    const page = site({ fetchError: new Error('offline') });
    page[trigger]('/next.html');
    await settle();
    assert.deepEqual(page.calls.assign, ['https://site.example/next.html']);
    assert.equal(page.calls.history.length, 0);
    assert.equal(page.calls.errors.length, 0);
  });

  test(`${trigger}: rejected fallback is reported and releases the routing lock`, async () => {
    const error = new Error('navigation blocked');
    const page = site({ fetchError: new Error('offline'), assignError: error });
    page[trigger]('/next.html');
    await settle();
    assert.equal(page.calls.errors.length, 1);
    assert.equal(page.calls.errors[0][1], error);
    assert.match(page.status.textContent, /Reload this page or try the link again/);
    assert.equal(page.document.documentElement.classList.contains('is-routing'), false);
    assert.equal(page.progress.firstElementChild.style.width, '0%');
    delete page.options.fetchError;
    delete page.options.assignError;
    page[trigger]('/retry.html');
    await settle();
    assert.equal(page.calls.fetch.length, 2);
    assert.equal(page.calls.swaps, 1);
  });
}

test('HTTP failure also falls back to full navigation', async () => {
  const page = site({ httpStatus: 503 });
  page.click('/next.html');
  await settle();
  assert.deepEqual(page.calls.assign, ['https://site.example/next.html']);
  assert.equal(page.calls.swaps, 0);
});

test('modified clicks, external links and same-page anchors remain native', async () => {
  const page = site();
  for (const [href, options] of [['/next.html', { ctrlKey: true }],
    ['https://other.example/page.html', {}], ['#section', {}]]) {
    assert.equal(page.click(href, options).defaultPrevented, false);
  }
  await settle();
  assert.equal(page.calls.fetch.length, 0);
});
