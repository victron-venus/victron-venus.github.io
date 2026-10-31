# Source change history

## 2026-10-30 — root site and dynamic presentation

### Changes

Serve the organization site directly from the root GitHub Pages repository. The
landing page, project catalog and wiki now run on a shared motion layer: floating
glass navigation, an illustrative system constellation, scroll reveals, pointer
depth, client-side page loading and live public GitHub metadata. The catalog and
all guides retain their curated content and no-JavaScript fallback. The previous
redirect and its validator are retired.

### Compatibility and upgrade

Existing guide anchors are preserved. Internal navigation works with ordinary
page loads when JavaScript or the View Transitions API is unavailable. Live
metadata is optional and rate-limited; the static catalog is authoritative.
Regenerate `assets/search-index.json` after changing guide text.

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
