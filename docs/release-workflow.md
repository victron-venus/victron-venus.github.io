# Website validation and publication

This repository serves the organization website at
`https://victron-venus.github.io/`. It contains static HTML, CSS and JavaScript
with no application packages or beta, RC and stable release channels. The site
is published through this repository's GitHub Pages settings. The current
default branch and Pages source are both `main`.

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

The separate live interaction check does open a browser and contact the
deployed site. `node scripts/check-interaction.mjs` drives the installed
Chrome/Chromium over the DevTools pipe, walks every Tab stop in both colour
schemes at desktop and mobile widths, and verifies focus indicators and hover
feedback. Use `--url http://127.0.0.1:4173/` for the local server. It is outside
`scripts/ci.sh` because it validates a published revision.

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

`live-interaction.yml` is separate from the gate. It triggers on pushes to
`main`, the default branch and Pages source, polls the Pages build API until
that exact commit is published, and then runs
the browser check against the deployed URL. A failure here means the live
revision lost a focus indicator or hover change; it does not block the push or
roll back the deployment.

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

## Default-branch and analysis runbook

Keep these settings aligned when maintaining the website:

- GitHub's default branch, `.release-policy.json`, and the push triggers in
  `quality-gate.yml` and `scorecards.yml` use `main`.
- GitHub Pages publishes `main` at `/` using its existing branch-based build.
  The public URL remains `https://victron-venus.github.io/`.
- The active ruleset targets the default branch and requires the strict
  **CI gate** check. Verify the effective rules on `main`, not just the
  ruleset's existence.
- SonarQube Cloud uses automatic analysis of the default branch and pull
  requests. Keep automatic analysis enabled; do not add a second scanner to CI.

After a default-branch change, inspect **Project > Branches** in SonarQube
Cloud. The existing main branch can follow GitHub's change automatically,
preserving its analysis history. A renamed branch can still display the last
analysis of the old commit. Confirm the analyzed commit SHA before treating
that result as evidence for the published website.

Automatic analysis runs on pushes to the default branch and pull request
branches. A GitHub Actions manual dispatch does not itself submit code to
SonarQube Cloud. After the next reviewed change is merged, wait for the main
branch analysis and verify that its SHA matches the merge commit. Compare the
result against the existing quality gate and new-code definition; do not reset
the baseline, relax thresholds, or exclude source files to turn a failure green.

For the GitHub-side checks after a branch transition, dispatch the existing
workflows against `main`:

```sh
gh workflow run quality-gate.yml --repo victron-venus/victron-venus.github.io --ref main
gh workflow run scorecards.yml --repo victron-venus/victron-venus.github.io --ref main
```

Record the run URLs, checked commit, and final results. Scorecard must actually
run: a skipped job from its default-branch guard is not a successful analysis.
Separately verify the exact-commit Pages deployment and the live interaction
check. Keep the former branch until its commits and any active users have been
accounted for; a default-branch change does not require deleting it.

If a transition must be rolled back, first coordinate a pause in website
changes. Restore the GitHub default setting together with the matching release
policy and workflow triggers, preserving site content and the Pages source.
Then recheck effective branch protection, Sonar's branch mapping and analyzed
SHA, Scorecard, and the live URL. Changing only the GitHub default is not a
complete rollback.

References: [GitHub default branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-branches-in-your-repository/changing-the-default-branch),
[Pages publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site),
and [SonarQube Cloud automatic analysis](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/automatic-analysis).
