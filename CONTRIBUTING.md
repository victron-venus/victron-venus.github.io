# Contributing

This repository serves the organization website at
**https://victron-venus.github.io/**. The site is static HTML, CSS and JavaScript;
[`assets/js/app.js`](assets/js/app.js) adds client-side page loading, motion and
live GitHub metadata as progressive enhancements.

Report reproducible problems or suggest changes through this repository's
GitHub issues. Include the URL, browser, expected behavior and observed behavior.
Keep suspected vulnerabilities private; see [SECURITY.md](SECURITY.md).

Use Python 3.12 and actionlint 1.7.12. Install the checked dependency hashes and
run the same local entry point used by CI:

```sh
python3 -m pip install --require-hashes --only-binary=:all: -r .github/requirements-workflow-contracts.txt -r .github/requirements-lint.txt
bash scripts/ci.sh
```

The tests verify local assets and navigation, stable heading anchors, canonical
URLs, the generated documentation index and the absence of third-party script
tags. Syntax and workflow contracts also run locally. These checks do not open a
browser, contact GitHub or publish the website.

Submit a focused pull request against the default branch. Explain the behavior
and validation. Keep the no-JavaScript fallback intact, test both desktop and
narrow layouts, and review changes to workflows or external dependencies
carefully. Changes require successful CI and the repository's configured review
rules.

Contribute original material under the root MIT license only when you have the right to do so. Preserve imported material's copyright notices and license terms in THIRD_PARTY_NOTICES.md.

## Participation and required regression coverage

Follow the [Code of Conduct](CODE_OF_CONDUCT.md), [governance](GOVERNANCE.md) and [roadmap](ROADMAP.md). All contributors, including the primary maintainer, must add automated tests for major new functionality and regression tests for defect fixes, with relevant negative inputs. Use PEP8-compatible Python, existing JavaScript conventions and deterministic HTML/YAML formatting; address diagnostics rather than disabling checks globally.

Follow [source publication](RELEASING.md) and update [change notes](CHANGELOG.md) for user-visible behavior and security fixes. Optional GitHub CLI status commands use the documented [transport profile](docs/transport-security.md).

Install the pinned Python diagnostic tool with `python3 -m pip install --require-hashes --only-binary=:all: -r .github/requirements-lint.txt`. The local gate runs Ruff syntax/undefined-name/control-flow checks across authored and vendored Python with `--ignore-noqa`, plus the existing source, workflow and site checks. Maximum warning strictness is not claimed.
