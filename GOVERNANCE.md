# Governance and maintenance

The organization website at the root GitHub Pages address is maintained in this repository. Other projects retain their own source, deployment and acceptance responsibilities.

The primary maintainer is the `4alvit` account. The maintainer owns scope, review, public-source publication, dependency updates and vulnerability handling. Contributors propose issues and pull requests; reviewers examine behavior, documentation, security and validation evidence. Automation supplies evidence and does not authorize a deployment or bypass branch protections.

Use public issues for ordinary proposals and pull requests for changes. Record compatibility effects and validation, and request reconsideration with new evidence when necessary. The [Code of Conduct](CODE_OF_CONDUCT.md) governs participation, [SECURITY.md](SECURITY.md) defines confidential technical reporting and [RELEASING.md](RELEASING.md) defines source publication.

## Continuity limitation

There is one primary maintainer. No backup person or tested arrangement can currently restore repository, CI and publication access within one week. Public source and bot access do not establish this guarantee. Silver access continuity and a bus factor of two remain unmet until a real recovery arrangement exists and is tested.
