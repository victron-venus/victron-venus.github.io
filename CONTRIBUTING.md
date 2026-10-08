# Contributing

This repository redirects the organization's root GitHub Pages address to
`https://victron-venus.github.io/.github/`. The destination website is maintained
in [victron-venus/.github](https://github.com/victron-venus/.github).

Report reproducible problems or suggest changes through this repository's
GitHub issues. Include the URL, browser, expected behavior and observed behavior.
Keep suspected vulnerabilities private; see [SECURITY.md](SECURITY.md).

Use Python 3.12 and actionlint 1.7.12. Install the checked dependency hashes and
run the same local entry point used by CI:

```sh
python3 -m pip install --require-hashes --only-binary=:all: -r .github/requirements-workflow-contracts.txt
bash scripts/ci.sh
```

The tests verify the real HTML destination and its JavaScript, meta-refresh,
canonical and clickable fallback forms. Negative tests cover inconsistent,
insecure, duplicate and unexpected script targets. Syntax and workflow contracts
also run locally. These checks do not open a browser or publish the website.

Submit a focused pull request against the current default branch,
`feature/redirect`. Explain the behavior and validation. Preserve fixed HTTPS
destinations and review changes to workflows or external dependencies carefully.
Changes require successful CI and the repository's configured review rules.
