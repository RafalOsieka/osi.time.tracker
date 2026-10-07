## MODIFIED Requirements

### Requirement: REQ-406 Merge-blocking rules on main
Unverified pull requests MUST be un-mergeable. A change SHALL reach `main` only through a pull request whose required checks all pass: every quality gate and the pull-request title check. The branch SHALL be up to date with `main` and its review conversations resolved before merging, and merges SHALL be squash-only with linear history.

#### Scenario: Merge blocked while a required check is red
- **WHEN** any required status check on a pull request is failing or has not run
- **THEN** GitHub SHALL block merging the pull request into `main`

#### Scenario: Merge allowed when all checks are green
- **WHEN** all required checks pass, the branch is up to date, and conversations are resolved
- **THEN** the pull request SHALL be mergeable via a squash merge

#### Scenario: Required checks match the CI jobs
- **WHEN** the required checks are compared with the quality gates
- **THEN** lint, format check, spec validation, type check, the standalone package checks, unit tests, the browser-extension checks, component tests, the coverage run, the production build, and the database, API and UI end-to-end suites as separate checks SHALL each be required

#### Scenario: Coverage figures never block a merge
- **WHEN** the coverage run passes but reported coverage drops
- **THEN** the pull request SHALL remain mergeable, because only a failing test fails the coverage check
