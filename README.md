# victron-venus.github.io

Root-domain holder for the organization website. GitHub Pages only serves
`https://<org>.github.io/` from a repository with this exact name — the real site
lives in [`victron-venus/.github`](https://github.com/victron-venus/.github) and is
served at **https://victron-venus.github.io/.github/**.

This repo contains a single instant redirect (meta refresh + `location.replace`)
so that https://victron-venus.github.io/ lands on the site.

To serve the site from this root directly instead: copy the contents of the
`.github` repo's site files here (all internal URLs are relative, so they work at
any base path), enable Pages, and drop the redirect.

<!-- ci-release-process:start -->
## CI and deployment

See [CI and deployment workflow](docs/release-workflow.md) for required checks and local commands. This repository uses validation-only policy; application release channels do not apply.
<!-- ci-release-process:end -->
