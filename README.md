# victron-venus.github.io

Public organization site for
[**victron-venus**](https://github.com/victron-venus), served at
**https://victron-venus.github.io/**.

The site is static HTML, CSS and JavaScript with no build step, framework or
remote fonts. The landing page, public project catalog and all guides live on
one page at the root address, with anchored navigation between sections.

## What is here

- [`index.html`](index.html) — single-page site: landing hero and topology,
  ecosystem entry points, flagship projects, the full filterable catalog and
  installation, architecture, integration, CI and contribution guides.
- [`projects.html`](projects.html) and [`wiki/`](wiki/) — legacy entry points
  kept as redirects to the corresponding sections on the root page.
- Anchored navigation, a sticky per-guide outline and offline search move
  between sections without leaving the page.
- [`assets/css/style.css`](assets/css/style.css) — shared editorial theme and
  light reading palette.
- [`assets/css/elevate.css`](assets/css/elevate.css) — presentation layer:
  floating glass navigation, atmospheric gradients, layered cards, scroll
  reveals and view transitions.
- [`assets/js/app.js`](assets/js/app.js) — site motion, same-page navigation
  state, GitHub metadata and legacy client-side page loading.
- [`assets/js/main.js`](assets/js/main.js) — catalog filters, diagram tracing
  and the opt-in translation UI.
- [`assets/js/site.js`](assets/js/site.js) — documentation search, outline and
  copy buttons.

## Progressive enhancement

Every section is readable and navigable without JavaScript; the top menu uses
ordinary anchor links. The catalog remains a complete static catalog when the
GitHub API is unavailable.

With JavaScript enabled:

- navigation marks the active section, smooth-scrolls to anchors and keeps the
  address bar shareable; legacy cross-document links still work with the View
  Transitions API where supported and a normal page load otherwise;
- cards and sections reveal on scroll, project cards tilt under a mouse and the
  system topology responds to pointer depth;
- public repository metadata (stars, forks and last push) decorates project
  cards from the unauthenticated GitHub API. Responses are cached in
  `sessionStorage` for 30 minutes; the curated copy is always the fallback. The
  unauthenticated API is rate-limited per visitor IP, so missing live metadata
  is an expected state, not a broken page;
- documentation search uses the local, generated
  [`assets/search-index.json`](assets/search-index.json) and never contacts a
  remote search service.

`prefers-reduced-motion`, `prefers-reduced-transparency`, keyboard focus and
print styles are supported. The GitHub API request and the opt-in Google
Translate widget are the only third-party runtime requests.

## Preview locally

Use a loopback HTTP server; opening the files directly bypasses relative URL
behavior:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open <http://127.0.0.1:4173/>. Check the top navigation, catalog filters, a
guide with a hash link, documentation search and the narrow layout. The live
GitHub metadata is subject to the public API rate limit.

After changing guide text, heading IDs or anchors, regenerate the search index:

```sh
python3 scripts/build-search-index.py
```

CSS and JavaScript references carry a `?v=` token so GitHub Pages caches do
not serve an older asset with new HTML. Bump the token on every page whenever
those files change.

## Validation

The repository uses Python 3.12 and actionlint 1.7.12 in CI. Install the pinned
workflow-contract parser and lint dependencies, then run the same entry point as
CI:

```sh
python3 -m pip install --require-hashes --only-binary=:all: -r .github/requirements-workflow-contracts.txt -r .github/requirements-lint.txt
bash scripts/ci.sh
```

`scripts/ci.sh` checks source syntax, workflow contracts, the generated search
index, light and dark text contrast and the site regression tests. The contrast
check resolves the `light-dark()` palette and fails below WCAG AA (4.5:1) for
every listed text pair, and when a stylesheet colours text from a token the
matrix does not cover. The site tests verify local assets and navigation, stable
anchors, canonical URLs, the absence of third-party script tags and the search
index. They do not launch a browser, contact GitHub or publish the site.

## Content rules

Keep safety limits and operating constraints in the text. Never present the
illustrative topology as live telemetry. Link only public projects; do not add
private repository names, local settings, credentials or customer data. Keep
existing section IDs stable so shared links continue to work.

## CI and deployment

See [CI and deployment workflow](docs/release-workflow.md) for required checks
and local commands. This repository uses validation-only policy; application
release channels do not apply.

Development checks and review expectations are in
[CONTRIBUTING.md](CONTRIBUTING.md); private reporting guidance is in
[SECURITY.md](SECURITY.md). [OpenSSF readiness evidence](docs/openssf-evidence.md)
records verified controls and remaining assessment limits.

## License

Original code, tests and documentation use the [MIT license](LICENSE). The
upstream site and project descriptions were published by the same organization
under the same license. See [third-party notices](THIRD_PARTY_NOTICES.md) for
imported helper notices and exclusions.

## Maintenance and security evidence

See [governance](GOVERNANCE.md), [Code of Conduct](CODE_OF_CONDUCT.md),
[roadmap](ROADMAP.md), [source changes](CHANGELOG.md) and
[quality evidence](docs/quality.md). Source revisions use complete Git
identities; no synthetic application releases are created. Optional CLI status
operations use the documented [transport profile](docs/transport-security.md).

[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/15587/badge)](https://www.bestpractices.dev/projects/15587)
