# OpenSSF readiness evidence

This project contains executable website and CI code and is included in the
public repository maintenance scope.

- Purpose and content: [README](../README.md), `index.html`, `projects.html` and
  the guides in `wiki/`.
- Contribution and testing instructions: [CONTRIBUTING](../CONTRIBUTING.md).
- Confidential reporting and supported source: [SECURITY](../SECURITY.md).
- Automated checks: `scripts/ci.sh`, site structure and search-index tests,
  CodeQL, dependency review, actionlint and workflow-contract tests.
- Dependency integrity: immutable GitHub Action references and hashed
  `.github/requirements-workflow-contracts.txt`.
- Change history and review: Git commits, GitHub issues and pull requests.

The site contract verifies local asset and navigation targets, stable search
anchors, canonical URLs, the generated documentation index and the absence of
third-party script tags without contacting a live site. CI validates local
syntax and workflow structure; it does not prove browser rendering,
accessibility, GitHub API availability, deployment availability or the security
of linked projects. This repository does not release synthetic application
packages.

The owner confirmed MIT publication for original source and documentation on
2026-10-16. The root LICENSE and THIRD_PARTY_NOTICES.md record its scope.
Maintainer knowledge and report-response attestations are recorded in
[quality evidence](quality.md), following direct owner confirmation. No awarded OpenSSF badge is claimed by this change.

## Additional source-analysis coverage

The [CodeQL workflow](../.github/workflows/codeql.yml) analyzes the site JavaScript in `assets/js/`, the Python tools and the GitHub Actions workflows. Existing language analyses remain enabled. Each language reports a separate analysis category; review its completed run and findings for the submitted revision. A passing GitHub Code Quality check does not substitute for these security analyses.

The additional-source matrix also scans GitHub Actions workflows with CodeQL.

## Ongoing process

See [governance](../GOVERNANCE.md), [conduct](../CODE_OF_CONDUCT.md), [roadmap](../ROADMAP.md), [source publication](../RELEASING.md) and [transport boundaries](transport-security.md). Full Git identities and [change notes](../CHANGELOG.md) identify source revisions. No backup maintainer, complete accessibility assessment, fresh fuzz campaign or package-release certification is claimed.
