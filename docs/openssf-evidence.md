# OpenSSF readiness evidence

This project contains executable redirect and CI code and is included in the
public repository maintenance scope.

- Purpose and destination: [README](../README.md) and `index.html`.
- Contribution and testing instructions: [CONTRIBUTING](../CONTRIBUTING.md).
- Confidential reporting and supported source: [SECURITY](../SECURITY.md).
- Automated checks: `scripts/ci.sh`, redirect regression tests, CodeQL,
  dependency review, actionlint and workflow-contract tests.
- Dependency integrity: immutable GitHub Action references and hashed
  `.github/requirements-workflow-contracts.txt`.
- Change history and review: Git commits, GitHub issues and pull requests.

The redirect contract verifies its four navigation forms without contacting a
live site. CI validates local syntax and workflow structure; it does not prove
browser accessibility, deployment availability or the destination application's
security. This repository does not release synthetic application packages.

No license file is currently present. The owner must choose and publish a
license before this repository can claim the corresponding OpenSSF criterion.
Maintainer knowledge and report-response attestations also require direct owner
confirmation. No awarded OpenSSF badge is claimed by this change.

## Additional source-analysis coverage

The [CodeQL workflow](../.github/workflows/codeql.yml) also analyzes the redirect JavaScript embedded in index.html. Existing language analyses remain enabled. Each language reports a separate analysis category; review its completed run and findings for the submitted revision. A passing GitHub Code Quality check does not substitute for these security analyses.

The additional-source matrix also scans GitHub Actions workflows with CodeQL.
