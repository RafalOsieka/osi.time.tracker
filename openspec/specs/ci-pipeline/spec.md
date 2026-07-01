# ci-pipeline Specification

## Purpose
TBD - created by archiving change add-ci-pipeline. Update Purpose after archive.
## Requirements
### Requirement: REQ-NFR-020 Pull-request and push CI triggers
The system SHALL provide a GitHub Actions workflow that runs on pull requests targeting `main` and on pushes to `main`, executing on the free GitHub-hosted `ubuntu-latest` runner.

#### Scenario: Workflow runs on a pull request to main
- **WHEN** a pull request targeting `main` is opened, synchronized, or reopened
- **THEN** the CI workflow SHALL start on a GitHub-hosted `ubuntu-latest` runner

#### Scenario: Workflow runs on push to main
- **WHEN** a commit is pushed to `main`
- **THEN** the CI workflow SHALL run the same verify jobs

### Requirement: REQ-NFR-021 Parallel verify jobs
The workflow SHALL run the verify checks as separate parallel jobs — `lint` (`pnpm lint`), `format` (`pnpm format:check`), `type-check` (`pnpm type-check`), `unit` (`pnpm test:unit`), `nuxt` (`pnpm test:nuxt`), and `build` (`pnpm build`) — so each appears as an independent status check.

#### Scenario: All verify jobs pass
- **WHEN** the code is lint-clean, formatted, type-correct, passes unit and nuxt tests, and builds
- **THEN** every parallel job SHALL report a green check

#### Scenario: A verify job fails
- **WHEN** any one of the verify jobs (e.g. `lint`) fails
- **THEN** that job's status check SHALL be marked red while the other parallel jobs continue to run and report independently

### Requirement: REQ-NFR-022 Lockfile-integrity install with caching
Each job SHALL install dependencies from the repository root using pnpm with `--frozen-lockfile`, and SHALL cache the pnpm store keyed on `pnpm-lock.yaml`.

#### Scenario: Install succeeds with an in-sync lockfile
- **WHEN** `pnpm-lock.yaml` is in sync with `package.json`
- **THEN** `pnpm install --frozen-lockfile` SHALL succeed, restoring the pnpm store from cache when available

#### Scenario: Out-of-sync lockfile fails fast
- **WHEN** `pnpm-lock.yaml` is out of sync with `package.json`
- **THEN** `pnpm install --frozen-lockfile` SHALL fail and the job SHALL report red

### Requirement: REQ-NFR-023 Gated end-to-end job
The workflow SHALL provide an `e2e` job that runs `pnpm test:e2e` and declares `needs:` on all cheap verify jobs (`lint`, `format`, `type-check`, `unit`, `nuxt`, `build`), so the Dockerized Postgres e2e suite only starts after the cheap jobs pass. The job SHALL receive `NUXT_SESSION_PASSWORD` from repository secrets and rely on the existing harness to self-provision `postgres:18-alpine` via Docker.

#### Scenario: e2e runs only after cheap jobs pass
- **WHEN** all of `lint`, `format`, `type-check`, `unit`, `nuxt`, and `build` succeed
- **THEN** the `e2e` job SHALL start, provision Postgres via Docker, and run `pnpm test:e2e`

#### Scenario: e2e skipped when a cheap job fails
- **WHEN** any required upstream job fails
- **THEN** the `e2e` job SHALL NOT run, avoiding the cost of spinning up Docker and Postgres

### Requirement: REQ-NFR-024 Concurrency cancellation of superseded runs
The workflow SHALL define a `concurrency` group keyed on the ref with `cancel-in-progress: true` so a newer run on the same ref cancels an in-progress older run.

#### Scenario: New push cancels the previous run
- **WHEN** a new commit is pushed to a pull-request branch while a CI run for an earlier commit on the same ref is still in progress
- **THEN** the in-progress run SHALL be cancelled and only the newest run continues

### Requirement: REQ-NFR-025 Conventional-Commit PR-title lint
The system SHALL provide a workflow that lints the pull-request title against the Conventional Commits specification, since squash-only merges make the PR title the commit that lands on `main`.

#### Scenario: Valid Conventional-Commit title passes
- **WHEN** a pull-request title such as `feat: add timer pause` is set
- **THEN** the PR-title-lint check SHALL pass

#### Scenario: Non-conforming title fails
- **WHEN** a pull-request title does not follow Conventional Commits (e.g. `updated stuff`)
- **THEN** the PR-title-lint check SHALL fail with a clear message and block merge via the ruleset

### Requirement: REQ-NFR-026 Least-privilege and pinned actions
The workflow SHALL declare a least-privilege `permissions:` block (default `contents: read`) and SHALL pin third-party marketplace actions to fixed versions; secrets such as `NUXT_SESSION_PASSWORD` MUST NOT be logged.

#### Scenario: Default token permissions are restricted
- **WHEN** the workflow runs
- **THEN** the `GITHUB_TOKEN` SHALL be granted only the minimum permissions required (read-only by default)

### Requirement: REQ-NFR-027 Automated dependency and action updates
The system SHALL provide a Dependabot configuration covering the `npm` and `github-actions` ecosystems so dependencies and pinned actions are kept current automatically.

#### Scenario: Dependabot opens update PRs
- **WHEN** a tracked npm dependency or pinned GitHub Action has a newer version
- **THEN** Dependabot SHALL open a pull request that is itself verified by the CI workflow

### Requirement: REQ-NFR-028 Security scanning via CodeQL
The repository SHALL have CodeQL analysis enabled (via GitHub default setup) to provide free static security scanning of the JavaScript/TypeScript codebase.

#### Scenario: CodeQL analyzes the codebase
- **WHEN** CodeQL default setup is enabled and code is pushed
- **THEN** CodeQL SHALL scan the codebase and report any findings in the Security tab

### Requirement: REQ-NFR-029 Merge-blocking rules on main
Unverified pull requests MUST be un-mergeable: a branch ruleset on `main` SHALL require a pull request before merging, require all CI status checks (`lint`, `format`, `type-check`, `unit`, `nuxt`, `build`, `e2e`, and the PR-title lint) to pass, require the branch to be up to date, require conversation resolution, and allow squash-only merges with linear history. Because rulesets are not repository files, this configuration SHALL be delivered as documented manual GitHub-UI setup instructions.

#### Scenario: Merge blocked while a required check is red
- **WHEN** any required status check on a pull request is failing or has not run
- **THEN** GitHub SHALL block merging the pull request into `main`

#### Scenario: Merge allowed when all checks are green
- **WHEN** all required checks pass, the branch is up to date, and conversations are resolved
- **THEN** the pull request SHALL be mergeable via a squash merge

#### Scenario: Manual setup guide reproduces the configuration
- **WHEN** the maintainer follows the documented manual GitHub-UI guide
- **THEN** the guide SHALL list the exact required check names and ruleset toggles, and note that a check is only selectable after it has run at least once

