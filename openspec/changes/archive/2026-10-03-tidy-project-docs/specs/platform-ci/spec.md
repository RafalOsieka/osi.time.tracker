## ADDED Requirements

### Requirement: REQ-406 Merge-blocking rules on main
Unverified pull requests MUST be un-mergeable: a branch ruleset on `main` SHALL require a pull request before merging, require all CI status checks (`lint`, `format`, `type-check`, `unit`, `nuxt`, `build`, `db`, `api`, `ui`, and the PR-title lint) to pass, require the branch to be up to date, require conversation resolution, and allow squash-only merges with linear history. The ruleset SHALL live in the GitHub repository settings; the repository SHALL NOT keep a manual setup guide for it.

#### Scenario: Merge blocked while a required check is red
- **WHEN** any required status check on a pull request is failing or has not run
- **THEN** GitHub SHALL block merging the pull request into `main`

#### Scenario: Merge allowed when all checks are green
- **WHEN** all required checks pass, the branch is up to date, and conversations are resolved
- **THEN** the pull request SHALL be mergeable via a squash merge

#### Scenario: Required checks match the CI jobs
- **WHEN** the ruleset's required checks are compared with the CI workflow jobs
- **THEN** they list `db`, `api`, and `ui` (not a single `e2e` job) alongside the other checks

## REMOVED Requirements

### Requirement: REQ-023 Merge-blocking rules on main
**Reason**: It required a committed manual GitHub-UI setup guide (`docs/github-setup.md`), which is removed; the ruleset itself is unchanged.
**Migration**: REQ-406 carries the same ruleset without the guide requirement.
