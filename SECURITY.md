# Security policy

The supported source is the current default branch, `feature/redirect`. This
small static project has no application version channels or backend service.
It serves the organization website and includes local CI tools.

Report suspected vulnerabilities privately through
[GitHub private vulnerability reporting](https://github.com/victron-venus/victron-venus.github.io/security/advisories/new). Do not post credentials or an exploit against
a live deployment in a public issue.

Include affected source commits or URLs, reproduction steps, browser/tool
versions and potential impact. Maintainers should acknowledge reports within
seven days, coordinate a fix and publish relevant advisory or change details.
This is a response target, not a statement about historical reports.

Site changes must keep internal navigation same-origin, preserve the
no-JavaScript fallback and avoid unvetted third-party scripts. Workflow actions
use immutable commit references, the parser dependency uses verified hashes, and
CodeQL analyzes the Python tooling and site JavaScript. Do not add secrets to
HTML, repository files, CI logs or issue attachments.

## Remediation and disclosure

Publicly known medium-or-higher vulnerabilities must be addressed within 60 days of public knowledge; confirmation does not restart that clock. Prioritize critical issues, reproduce with synthetic inputs, record affected revisions, test the correction, coordinate disclosure and identify assigned advisories in source change notes. Credit reporters unless they request anonymity. No prior response history is inferred from this policy.

The current [transport profile](docs/transport-security.md) and [quality evidence](docs/quality.md) state supported boundaries and dated findings.
