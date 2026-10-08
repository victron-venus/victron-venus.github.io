# Website validation and publication

This repository supplies a fixed redirect from the organization root GitHub
Pages address to `https://victron-venus.github.io/.github/`. It has no application
packages or beta, RC and stable release channels. The current default branch is
`feature/redirect`.

## Local validation

Use Python 3.12 and actionlint 1.7.12. Install the parser from its checked hashes:

```sh
python3 -m pip install --require-hashes --only-binary=:all: -r .github/requirements-workflow-contracts.txt
bash scripts/ci.sh
```

The entry point checks Python, JSON, YAML and shell syntax, runs actionlint,
verifies immutable workflow references and CI dependencies, and executes
regression tests against the actual redirect HTML. It validates the fixed
JavaScript, meta-refresh, canonical URL and clickable fallback without opening
a browser or contacting the destination.

## Pull requests and scheduled checks

`.release-policy.json` declares validation-only operation. `quality-gate.yml`
runs the configuration contracts before these reusable workflows:

- `validate.yml`: the local validation entry point.
- `codeql.yml`: static analysis of the Python tools.
- `dependency-review.yml`: dependency changes on pull requests.

The final **CI gate** requires every prerequisite to succeed. These checks run
for pull requests, merge-queue entries, default-branch pushes, the nightly
schedule and manual dispatch. A green gate covers the checked source commit;
it does not publish the website or establish destination availability.

## Publication and verification

Website publication is managed separately through this repository's GitHub
Pages settings. Changing the redirect requires a reviewed pull request and a
successful CI gate. After an authorized publication, verify both the root URL
and destination in a browser, including the clickable fallback with JavaScript
disabled. CI cannot establish the live Pages configuration or browser behavior.

`scripts/release.py` is the vendored toolkit client. This repository uses its
validation-only policy and does not invoke artifact publication or promotion.
The local workflow-contract validator is also vendored from
`victron-venus/venus-os-ci-toolkit`; preserve its regression tests when updating
it. Review any generated workflow change against the repository's actual
validation-only policy.
