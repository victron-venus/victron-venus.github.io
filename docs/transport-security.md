# Static website and operator transport boundaries

The browser source implements navigation and page interaction; it implements no encryption, password database, key generation or custom cryptographic primitive. GitHub Pages terminates website HTTPS, and the visitor's browser validates it. External linked sites and optional third-party scripts are separate services; the project does not claim to configure their TLS. No credentials belong in these public pages.

The owned `scripts/release.py status` helper calls GitHub CLI even under validation-only policy. For this optional operation use the qualified GitHub CLI 2.102.0 executable built with Go 1.27.1, inspected with `gh --version` and `go version -m /absolute/path/to/gh`:

```sh
GH_HOST=github.com GODEBUG=fips140=on python3 scripts/release.py status
```

Keep the normal GitHub API endpoint and certificate/hostname verification. This per-process Go profile enforces TLS 1.2 or newer and a verified full-chain RSA 2048 minimum or supported modern elliptic keys. It does not grant FIPS certification. Custom hosts, proxies, trust roots, extensions or other binaries need separate qualification. The helper inherits this environment; it does not publish an application release in validation-only mode.

The [shared exact-runtime TLS evidence](https://github.com/victron-venus/integration-tests/blob/232df66ba8ec59019ee5444090212f256a88b7e6/docs/release-tls-profile.md) and [dated command-specific advisory review](https://github.com/4alvit/google-home-voice-stats/blob/5b0baec1a3c7db3e4d5854e7461e1bae9028cc11/docs/RELEASE_DEPENDENCY_ASSESSMENT.md) cover this CLI. The reviewed gh 2.102.0 source graph does not import the old OpenPGP package; the critical HTTP/2 server issue does not apply to these outbound API calls. Twelve recent binary findings remain tracked. This is not an advisory-free claim; reassess before 2026-12-07, immediately for a new critical finding, or after a runtime/command change.

Local preview servers are development-only and must not receive secrets. General Git/SSH, package managers, browsers and hosting administration remain separately maintained prerequisite tools. No Cosign/signing helper is invoked by this repository's validation-only client.
