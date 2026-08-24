# coverage-reporting Specification

## Purpose

Define how code coverage is measured, reported, and governed independently of the
verify/merge-gate pipeline: Vitest `v8` coverage from the `unit` and `nuxt`
projects, upload to Codecov for PR comments and a badge, and a report-only policy
that keeps coverage informational rather than merge-blocking.

## Requirements

### Requirement: REQ-024 Coverage measurement from unit and nuxt tests
The project SHALL support code-coverage collection via Vitest's `v8` provider (`@vitest/coverage-v8`), configured centrally in `vitest.config.ts`. In-process coverage SHALL be measured from the `unit` and `nuxt` test projects executed together in a single Vitest run exposed as the `test:coverage` script. Coverage sources SHALL be limited to first-party application code (`app/`, `server/`, `shared/`); test files, config, generated Nuxt output, and tooling SHALL be excluded. The `test:coverage` script SHALL NOT run api, ui, or db e2e projects. The run SHALL emit at least `lcov` (for upload), `json-summary`, and `text` reports into a git-ignored `coverage/` directory.

#### Scenario: Coverage run produces an lcov report
- **WHEN** `pnpm test:coverage` runs
- **THEN** the `unit` and `nuxt` projects SHALL execute with instrumentation and produce an `lcov` report under `coverage/`, covering only `app/`, `server/`, and `shared/`

#### Scenario: e2e excluded from coverage
- **WHEN** `pnpm test:coverage` runs
- **THEN** the api, ui, and db e2e projects SHALL NOT be run as part of that script (Nitro-side e2e-api coverage is collected by the `api` job instead)

#### Scenario: Coverage artifacts are not committed
- **WHEN** a coverage run writes to `coverage/`
- **THEN** that directory SHALL be git-ignored and never committed

### Requirement: REQ-025 Coverage reporting to GitHub via Codecov
The workflow SHALL provide a `coverage` job that runs `pnpm test:coverage` and uploads the resulting `lcov` report to Codecov using a version-pinned `codecov/codecov-action` with flag `unit-nuxt`, so that pull requests receive a coverage comment with diff coverage and the project exposes a coverage badge. For the public repository the upload MAY be tokenless; if a token is required it SHALL be supplied via a `CODECOV_TOKEN` repository secret and MUST NOT be logged. The unit+nuxt `coverage` job SHALL NOT require the DB/e2e infrastructure. Nitro-side e2e-api coverage SHALL be uploaded from the `api` job (REQ-277, REQ-278), which does require that infrastructure.

#### Scenario: Coverage uploaded on a pull request
- **WHEN** the `coverage` job runs on a pull request
- **THEN** it SHALL generate the lcov report and upload it to Codecov with flag `unit-nuxt`, which SHALL post/update a coverage comment reporting overall and diff coverage

#### Scenario: Badge reflects default-branch coverage
- **WHEN** coverage uploads run on a push to `main`
- **THEN** Codecov SHALL update the project coverage used by the README badge from the combined flags

#### Scenario: Upload token is not exposed
- **WHEN** a `CODECOV_TOKEN` secret is configured
- **THEN** it SHALL be passed only to the upload action and MUST NOT appear in logs

#### Scenario: Unit-nuxt coverage job stays Docker-free
- **WHEN** the `coverage` job runs
- **THEN** it SHALL NOT start Postgres or Playwright

### Requirement: REQ-026 Report-only coverage policy
Coverage SHALL be informational only and MUST NOT block merges: a `codecov.yml` SHALL configure the coverage status as `informational: true` (no failing threshold) to establish a baseline before any gating is introduced. The `coverage` job MAY run in parallel with the other verify jobs and SHALL NOT be added to the merge-blocking required checks (REQ-023) as part of this change.

#### Scenario: Low coverage does not block merge
- **WHEN** coverage decreases on a pull request
- **THEN** the Codecov status SHALL report the change but SHALL NOT fail the check or block merging

#### Scenario: Coverage job failure is isolated
- **WHEN** the `coverage` job itself fails (e.g. upload error)
- **THEN** it SHALL NOT be a required merge-blocking check while the policy is report-only

### Requirement: REQ-277 API e2e coverage from the Nitro process
The `api` CI job SHALL collect code coverage from the Nuxt/Nitro process that serves HTTP tests (not from the Vitest worker that only calls `fetch`). Coverage sources SHALL be first-party `app/`, `server/`, and `shared/` paths. The production output used for those tests SHALL include source maps so attributed files are the TypeScript/Vue sources, not opaque `.output` chunks. Playwright/UI client coverage SHALL NOT be collected. If the collected report cannot be attributed to those first-party sources, the coverage-upload step SHALL fail rather than publish an unusable report.

#### Scenario: Http tests credit server routes
- **WHEN** the api job runs HTTP specs against the booted server
- **THEN** executed `server/api` handlers SHALL appear as covered in the uploaded `e2e-api` report

#### Scenario: Unmapped output fails the upload
- **WHEN** the converted lcov only names bundled `.output` chunks with no first-party `server/` or `app/` or `shared/` paths
- **THEN** the api job SHALL fail the coverage step and SHALL NOT upload that report to Codecov

#### Scenario: Ui job does not upload browser coverage
- **WHEN** the ui job finishes
- **THEN** it SHALL NOT upload a Playwright/client coverage report

### Requirement: REQ-278 Codecov flags merge unit-nuxt and e2e-api
The unit+nuxt `coverage` job SHALL upload its lcov with Codecov flag `unit-nuxt`. The `api` job SHALL upload its Nitro-derived lcov with flag `e2e-api`. Codecov SHALL combine those flags for the PR comment and default-branch totals. Coverage SHALL remain informational (REQ-026); neither flag SHALL become a merge-blocking threshold.

#### Scenario: PR comment includes both flags
- **WHEN** both `coverage` and `api` jobs upload successfully on a pull request
- **THEN** the Codecov comment SHALL report coverage that includes both the in-process unit/nuxt hits and the e2e-api Nitro hits

#### Scenario: Api job failure does not block on coverage policy
- **WHEN** the api tests themselves fail
- **THEN** the `api` job SHALL be red as a required check (REQ-023) for the tests, independent of the informational coverage flags
