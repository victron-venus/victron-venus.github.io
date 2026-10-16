# Quality evidence and limits

The maintained product is public static source plus local Python/CI tooling, not an application package. Original code/documentation uses MIT; imported helper notices and external services retain their own terms. The full Git SHA identifies source, and [source change history](../CHANGELOG.md) records relevant behavior and compatibility.

`bash scripts/ci.sh` runs the actual repository checks documented in CONTRIBUTING.md. Required CodeQL includes the maintained JavaScript, Python and Actions source; workflow contracts and dependency review supplement it. Tests use local fixtures and do not establish live deployment, complete accessibility, all browser behavior or security of linked sites. No physical hardware test or independent penetration test is claimed.

On 2026-10-16 the authenticated GitHub inventory had no public issues, open dependency alerts, project security advisories or secret alerts. Open Code Scanning findings were Scorecard process recommendations, not confirmed source exploits. Reassess these dated observations when new findings arrive; the absence of GitHub dependency alerts does not inspect every external executable.

The primary maintainer confirms knowledge of secure design and typical application/network vulnerabilities and their prevention. No bug, feature or vulnerability reports were received outside GitHub in the preceding 12 months. There is no designated backup maintainer or tested one-week access recovery.

Complete statement/branch coverage, a fresh fuzz campaign, universal warning strictness, accessibility, reproducible native builds and an assurance case for all optional tooling remain unestablished. Those Silver limitations must remain visible. [The transport profile](transport-security.md) separately covers optional owned GitHub CLI operations.
