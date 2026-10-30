# Source publication and site changes

This repository publishes static source and community documentation. It does not distribute a versioned application package. The complete Git commit SHA uniquely identifies each source revision; the maintained branch is `feature/redirect`. Do not invent semantic-version releases or tags to represent ordinary website edits.

Before merging, run `bash scripts/ci.sh`, inspect required checks for the exact revision, and obtain review through the existing branch rules. Record meaningful behavior, compatibility and security changes in [CHANGELOG.md](CHANGELOG.md). Include affected source revisions, mitigation and assigned advisory identifiers when a security defect is fixed. A changed README or successful CI does not establish that GitHub Pages has deployed or that linked projects are available.

Existing GitHub Pages settings control publication. Verify the deployed revision and relevant navigation separately after an intended deployment; this procedure does not change Pages configuration. To restore an older behavior, review a revert that preserves unrelated changes and validate it through the same process. Preserve current content and URLs where possible and document migrations before removing links.

Keep the README's real OpenSSF badge and evidence current within 48 hours of an announced achievement. Submission is a self-assessment, not independent certification.
