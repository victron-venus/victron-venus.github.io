# Security policy

The supported source is the current default branch, `feature/redirect`. This
small static project has no application version channels or backend service.
It redirects visitors to the organization's website and includes local CI tools.

Report suspected vulnerabilities privately through
[GitHub private vulnerability reporting](https://github.com/victron-venus/victron-venus.github.io/security/advisories/new). Do not post credentials or an exploit against
a live deployment in a public issue.

Include affected source commits or URLs, reproduction steps, browser/tool
versions and potential impact. Maintainers should acknowledge reports within
seven days, coordinate a fix and publish relevant advisory or change details.
This is a response target, not a statement about historical reports.

Redirect changes must retain an explicit reviewed HTTPS destination. Workflow
actions use immutable commit references, the parser dependency uses verified
hashes, and CodeQL analyzes the Python tooling. Do not add secrets to HTML,
repository files, CI logs or issue attachments.
