# Source change history

## 2026-10-30 — live focus and hover browser check

### Changes

Add [`scripts/check-interaction.mjs`](scripts/check-interaction.mjs), a
dependency-free Chrome DevTools Protocol check for the deployed page. It drives
the installed Chrome/Chromium over the DevTools pipe and, in both colour schemes
at 1440×900 and 390×844, walks every Tab stop to require `:focus-visible` with a
visible indicator at 3:1 contrast. It then hovers 17 representative controls
and requires a computed style change. The copy button in guide code blocks now
has hover feedback; it previously changed only the pointer. Shared asset URLs
move to `?v=20261030s`.

The check defaults to `https://victron-venus.github.io/`, accepts `--url` for a
local server, and is run daily by the scheduled
[`live-interaction`](.github/workflows/live-interaction.yml) workflow. It is not
part of `scripts/ci.sh`, because the pre-merge gate runs before publication and
cannot validate the deployed revision.

### Compatibility and upgrade

No URLs, anchors, markup or content changed. Running the check needs Chrome or
Chromium and Node.js; there is no npm package or browser download. Pass
`--browser` or set `CHROME_PATH` when the browser is not in a standard location.
The measured limits are one browser engine, two viewport widths and computed
styles: assistive-technology, cross-browser and pixel-level checks remain
outside automation.

### Security

The check is read-only, uses a temporary browser profile that is removed on
exit, clears the local `vv-theme` preference before each pass and sends no
credentials. It contacts the configured page and the same-origin assets that
page loads.

## 2026-10-30 — automated contrast check in CI

### Changes

`scripts/ci.sh` now runs `scripts/check-contrast.py`. The check resolves every
paired token from the `light-dark()` palette in both schemes and fails below
WCAG AA: 4.5:1 for normal text and 3:1 for field borders, focus rings and
meaningful icons. It also fails when a CSS `color:` rule uses a token missing
from the matrix, so a new text colour cannot bypass the check. Interactive
boundaries moved to a new `--control-edge` token (3.29:1 or better against every
adjacent surface in both schemes); decorative dividers keep the lighter `--edge`.
The wiki card number label now uses the AA-compliant `--amber` instead of
`--amber-dim`.

### Compatibility and upgrade

No URLs, markup or behaviour changed. The check covers token values, not rendered
pixels, gradients or translucent layers; those still need a browser pass. Add a
new text token to `PAIRS` in the script, or document a non-text exemption with a
reason.

## 2026-10-30 — light and dark colour schemes

### Changes

Every page now renders a light and a dark palette from one token set. The scheme
follows the operating system by default and can be overridden with a header
toggle that remembers the choice in local storage. The toggle cycles
follow-system → light → dark, so the automatic mode stays reachable after an
explicit choice; a sun, moon or monitor icon shows the active state. Section-only
palettes that pinned documentation pages to light values were removed, and
translucent accents, borders and shadows received per-scheme values so both
schemes keep equivalent contrast.

### Compatibility and upgrade

Nothing changes for visitors who make no choice: the page keeps following the
system preference. Choosing the system state again removes the stored
`vv-theme` key. No anchors, URLs or content changed. Bump the `?v=` suffix
on shared CSS/JS when deploying further style changes so cached pages pick up
the new theme.

### Security

The preference is stored under `vv-theme` in local storage only; no cookies,
accounts or third-party requests are added. The no-flash script is inline and
optional: without JavaScript the page still follows the system preference.

## 2026-10-30 — root site and dynamic presentation

### Changes

Serve the organization site directly from the root GitHub Pages repository. The
landing page, project catalog and all wiki guides are consolidated into
`index.html`; the top menu and guide cards link to anchored sections, and the
legacy `projects.html` and `wiki/` URLs redirect to those anchors. The page runs
on a shared motion layer: floating glass navigation with scroll-tracked active
sections, an illustrative system constellation, scroll reveals, pointer depth,
per-guide outlines, offline search and live public GitHub metadata. All curated
content and the no-JavaScript fallback remain. The previous redirect and its
validator are retired.

### Compatibility and upgrade

Existing guide anchors are preserved and old page URLs redirect to equivalent
sections. Internal navigation works with ordinary anchor links when JavaScript
is unavailable. Live metadata is optional and rate-limited; the static catalog
is authoritative. Regenerate `assets/search-index.json` after changing guide
text, heading IDs or anchors.

### Security

Internal navigation fetches only same-origin HTML and falls back to a normal
navigation on any failure. The GitHub API is read-only and unauthenticated,
cached for 30 minutes; no credentials are placed in the site. Live metadata is
the only automatic third-party request; Google Translate remains an explicit
opt-in.

## 2026-10-16 — community and assessment documentation

### Changes

Publish the owner-confirmed MIT terms for original code/documentation while preserving imported notices. Document governance, conduct reporting, source publication, a one-year roadmap and the boundaries of automated tests and optional tooling.

### Compatibility and upgrade

These changes retain the existing static navigation and the `feature/redirect` source branch. No configuration migration, device operation or package installation is required. Review the complete Git revision and preserve existing Pages settings.

### Security

Confidential reports use GitHub private reporting. The remediation clock starts when a vulnerability becomes public, not when the maintainer confirms it. Optional GitHub CLI commands have a separately qualified TLS profile and dated advisory assessment; this does not claim arbitrary operator tools are vulnerability-free. No assigned application vulnerability is fixed by this documentation change.

## Earlier reviewed source changes

- [2c2d63a](https://github.com/victron-venus/victron-venus.github.io/commit/2c2d63a) validates the fixed redirect and hardens workflow dependency contracts.
- [7b2a7c7](https://github.com/victron-venus/victron-venus.github.io/commit/7b2a7c7) simplifies a redundant validator exception without changing navigation.

See the complete Git history and linked pull requests for earlier behavior and review.
