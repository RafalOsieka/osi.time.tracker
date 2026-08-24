## ADDED Requirements

### Requirement: REQ-275 Build artifact reused by API and UI jobs
The `build` job SHALL upload the production `.output` directory as a workflow artifact. The `api` and `ui` jobs SHALL download that artifact into `.output`, set skip-build, and MUST NOT run `pnpm build` again. They SHALL still install dependencies so test tooling can boot the prebuilt server.

#### Scenario: Api and ui consume the build artifact
- **WHEN** `build` succeeds and `api` / `ui` start
- **THEN** each SHALL restore `.output` from the artifact and run its test project with skip-build enabled

#### Scenario: Artifact missing fails the consumer
- **WHEN** `api` or `ui` cannot restore `.output`
- **THEN** that job SHALL fail (the suite SHALL NOT skip and SHALL NOT rebuild)

### Requirement: REQ-276 UI job installs a usable Chromium
The `ui` job SHALL install Playwright Chromium and required OS dependencies before running UI specs, and the package manager SHALL be allowed to run Playwright's install/build scripts. After that step a Chromium binary MUST be present so `requireBrowser()` does not skip.

#### Scenario: Chromium is present before ui tests
- **WHEN** the `ui` job reaches `pnpm test:e2e:ui`
- **THEN** a Chromium executable SHALL exist on the runner and the ui suite SHALL run (not skip)

#### Scenario: Install failure is red
- **WHEN** Playwright Chromium installation fails
- **THEN** the `ui` job SHALL fail

## MODIFIED Requirements

### Requirement: REQ-017 Gated end-to-end job
The workflow SHALL provide three Dockerized jobs after cheap verify work: `db` (`pnpm test:e2e:db`, needs cheap jobs except it MUST NOT need `build`), `api` (`pnpm test:e2e:api`, needs cheap jobs including `build`), and `ui` (`pnpm test:e2e:ui`, needs cheap jobs including `build`). `api` and `ui` MAY run in parallel with each other. Each SHALL receive `NUXT_SESSION_PASSWORD` from repository secrets when a server is booted and SHALL self-provision `postgres:18-alpine` via the harness. Missing Docker in these jobs SHALL fail the job (e2e-test-harness CI skip policy).

#### Scenario: e2e runs only after cheap jobs pass
- **WHEN** all of `lint`, `format`, `type-check`, `unit`, `nuxt`, and `build` succeed
- **THEN** the `api` and `ui` jobs SHALL start, restore `.output`, provision Postgres via Docker, and run their respective scripts

#### Scenario: e2e skipped when a cheap job fails
- **WHEN** any required upstream job fails
- **THEN** the dependent `db` / `api` / `ui` job SHALL NOT run, avoiding the cost of spinning up Docker (and Playwright for `ui`)

#### Scenario: Db runs without the production artifact
- **WHEN** cheap jobs other than `build` succeed
- **THEN** the `db` job SHALL start, provision Postgres via Docker, and run `pnpm test:e2e:db` without downloading `.output`

### Requirement: REQ-023 Merge-blocking rules on main
Unverified pull requests MUST be un-mergeable: a branch ruleset on `main` SHALL require a pull request before merging, require all CI status checks (`lint`, `format`, `type-check`, `unit`, `nuxt`, `build`, `db`, `api`, `ui`, and the PR-title lint) to pass, require the branch to be up to date, require conversation resolution, and allow squash-only merges with linear history. Because rulesets are not repository files, this configuration SHALL be delivered as documented manual GitHub-UI setup instructions. The former single `e2e` check SHALL be replaced by `db`, `api`, and `ui`.

#### Scenario: Merge blocked while a required check is red
- **WHEN** any required status check on a pull request is failing or has not run
- **THEN** GitHub SHALL block merging the pull request into `main`

#### Scenario: Merge allowed when all checks are green
- **WHEN** all required checks pass, the branch is up to date, and conversations are resolved
- **THEN** the pull request SHALL be mergeable via a squash merge

#### Scenario: Manual setup guide reproduces the configuration
- **WHEN** the maintainer follows the documented manual GitHub-UI guide
- **THEN** the guide SHALL list the exact required check names including `db`, `api`, and `ui` (not a single `e2e` job), and note that a check is only selectable after it has run at least once
