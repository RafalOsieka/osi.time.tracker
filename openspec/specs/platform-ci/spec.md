# platform-ci Specification

## Purpose

Keep `main` verified: a change lands only after every quality gate passes, its pull-request title becomes a meaningful commit, and every bug fix leaves a regression test behind. How the gates are wired in CI is described in `docs/development.md`.

## Requirements

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

### Requirement: REQ-530 Production deploys are explicit and gated
A production deploy SHALL start only by an explicit operator action on `main`, and SHALL publish that commit only after every quality gate has passed for it. Merging to `main` SHALL NOT deploy.

#### Scenario: Merge does not deploy
- **WHEN** a pull request is merged to `main`
- **THEN** the quality gates SHALL run and nothing SHALL be published or deployed

#### Scenario: Deploy requested on main with passing gates
- **WHEN** the operator requests a deploy on `main` and every quality gate passes
- **THEN** that commit SHALL be published and handed to production

#### Scenario: Failing gate stops the deploy
- **WHEN** the operator requests a deploy and any quality gate fails
- **THEN** nothing SHALL be published and production SHALL keep running the same build

#### Scenario: Deploy requested from another branch
- **WHEN** the operator requests a deploy on a branch other than `main`
- **THEN** nothing SHALL be published or deployed

### Requirement: REQ-531 A deploy succeeds only when production reports its commit
A deploy SHALL be reported successful only once the running production instance reports the deployed commit, and SHALL be reported failed when it does not do so within 15 minutes.

#### Scenario: Production reports the deployed commit
- **WHEN** production starts reporting the deployed commit within 15 minutes
- **THEN** the deploy SHALL be reported successful

#### Scenario: Production never reports the commit
- **WHEN** production is unreachable or still reports another commit after 15 minutes
- **THEN** the deploy SHALL be reported failed

### Requirement: REQ-532 Deployment details stay private
The repository and its public workflow logs SHALL NOT disclose the production address, access credentials or specifics of the hosting infrastructure. Those values SHALL exist only as masked secrets or on the host.

#### Scenario: Deploy logs mask the address
- **WHEN** a deploy runs and its logs are read publicly
- **THEN** the production address and access credentials SHALL NOT appear in them

#### Scenario: Deployment files carry no private values
- **WHEN** the committed deployment files are inspected
- **THEN** they SHALL contain only placeholders and variable names for the production address, credentials and hosting details
