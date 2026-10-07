# platform-ci Specification

## Purpose

Keep `main` verified: a change lands only after every quality gate passes, its pull-request title becomes a meaningful commit, and every bug fix leaves a regression test behind. How the gates are wired in CI is described in `docs/development.md`.

## Requirements

### Requirement: REQ-406 Merge-blocking rules on main
Unverified pull requests MUST be un-mergeable. A change SHALL reach `main` only through a pull request whose required checks all pass: lint, format check, type check, unit tests, component tests, the production build, the database, API and UI end-to-end suites, and the pull-request title check. The branch SHALL be up to date with `main` and its review conversations resolved before merging, and merges SHALL be squash-only with linear history.

#### Scenario: Merge blocked while a required check is red
- **WHEN** any required status check on a pull request is failing or has not run
- **THEN** GitHub SHALL block merging the pull request into `main`

#### Scenario: Merge allowed when all checks are green
- **WHEN** all required checks pass, the branch is up to date, and conversations are resolved
- **THEN** the pull request SHALL be mergeable via a squash merge

#### Scenario: Required checks match the CI jobs
- **WHEN** the required checks are compared with the quality gates
- **THEN** the database, API and UI end-to-end suites SHALL each be a separate required check alongside the other gates

### Requirement: REQ-019 Conventional-Commit PR-title lint
The pull-request title SHALL follow the Conventional Commits specification, because squash-only merges make the title the commit that lands on `main`. A non-conforming title SHALL fail its check and block merging.

#### Scenario: Valid Conventional-Commit title passes
- **WHEN** a pull-request title such as `feat: add timer pause` is set
- **THEN** the PR-title-lint check SHALL pass

#### Scenario: Non-conforming title fails
- **WHEN** a pull-request title does not follow Conventional Commits (e.g. `updated stuff`)
- **THEN** the PR-title-lint check SHALL fail with a clear message and block merge via the ruleset

### Requirement: REQ-037 Bug fixes are test-first
Every bug fix SHALL be preceded by an automated regression test that reproduces the defect, confirmed **failing** against the unfixed code and **passing** after the fix. The test SHALL NOT be weakened, skipped, or deleted to force a green run, and SHALL stay in the suite as a permanent regression guard. Trivial defects (e.g. typos, obvious single-line logic errors) MAY rely on a documented manual check instead.

#### Scenario: Failing repro precedes the fix
- **WHEN** a bug is fixed in application code
- **THEN** a regression test that fails against the pre-fix code and passes against the post-fix code SHALL be added in the same change, and it SHALL NOT be weakened or skipped
