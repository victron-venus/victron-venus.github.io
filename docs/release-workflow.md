# Website validation and publication

This repository serves the organization website at
`https://victron-venus.github.io/`. It contains static HTML, CSS and JavaScript
with no application packages or beta, RC and stable release channels. The site
is published through this repository's GitHub Pages settings. The current
default branch is `feature/redirect`.

## Local validation

Use Python 3.12 and actionlint 1.7.12. Install the parser from its checked hashes:

```sh
python3 -m pip install --require-hashes --only-binary=:all: -r .github/requirements-workflow-contracts.txt
bash scripts/ci.sh
```

The entry point checks Python, JSON, YAML and shell syntax, runs actionlint,
verifies immutable workflow references and CI dependencies, confirms the
generated documentation search index is current, and executes the site
regression tests. The tests validate local assets and navigation, stable heading
anchors, canonical URLs, the absence of third-party script tags and the
generated index. They do not open a browser or contact GitHub.

For local visual review, serve the repository over loopback:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Check the landing page, the catalog filters and search, a guide with a hash link,
documentation search, the narrow layout and the no-JavaScript fallback. Live
GitHub metadata depends on the unauthenticated API and its per-IP rate limit;
the curated catalog remains usable when that request fails. Bump the `?v=` asset
token in the HTML when changing CSS or JavaScript.

## Pull requests and scheduled checks

`.release-policy.json` declares validation-only operation. `quality-gate.yml`
runs the configuration contracts before these reusable workflows:

- `validate.yml`: the local validation entry point.
- `codeql.yml`: static analysis of the Python tools, site JavaScript and
  workflow files.
- `dependency-review.yml`: dependency changes on pull requests.

The final **CI gate** requires every prerequisite to succeed. These checks run
for pull requests, merge-queue entries, default-branch pushes, the nightly
schedule and manual dispatch. A green gate covers the checked source commit; it
does not publish the website or establish live browser behavior, GitHub API
availability or deployment availability.

## Publication and verification

Website publication is managed separately through this repository's GitHub
Pages settings. Changing the site requires a reviewed pull request and a
successful CI gate. After an authorized publication, verify the root URL, the
project catalog, live-metadata fallback, a documentation search result and a
guide with and without JavaScript. CI cannot establish the live Pages
configuration, browser rendering or third-party service availability.

`scripts/release.py` is the vendored toolkit client. This repository uses its
validation-only policy and does not invoke artifact publication or promotion.
The local workflow-contract validator is also vendored from
`victron-venus/venus-os-ci-toolkit`; preserve its regression tests when updating
it. Review any generated workflow change against the repository's actual
validation-only policy.
