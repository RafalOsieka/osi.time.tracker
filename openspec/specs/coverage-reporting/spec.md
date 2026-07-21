# coverage-reporting Specification

## Purpose

Define how code coverage is measured, reported, and governed independently of the
verify/merge-gate pipeline: Vitest `v8` coverage from the `unit` and `nuxt`
projects, upload to Codecov for PR comments and a badge, and a report-only policy
that keeps coverage informational rather than merge-blocking.

## Requirements

### Requirement: REQ-024 Coverage measurement from unit and nuxt tests
The project SHALL support code-coverage collection via Vitest's `v8` provider (`@vitest/coverage-v8`), configured centrally in `vitest.config.ts`. Coverage SHALL be measured from the `unit` and `nuxt` test projects executed together in a single Vitest run exposed as the `test:coverage` script. Coverage sources SHALL be limited to first-party application code (`app/`, `server/`, `shared/`); test files, config, generated Nuxt output, and tooling SHALL be excluded. The `e2e` project SHALL NOT contribute to coverage. The run SHALL emit at least `lcov` (for upload), `json-summary`, and `text` reports into a git-ignored `coverage/` directory.

#### Scenario: Coverage run produces an lcov report
- **WHEN** `pnpm test:coverage` runs
- **THEN** the `unit` and `nuxt` projects SHALL execute with instrumentation and produce an `lcov` report under `coverage/`, covering only `app/`, `server/`, and `shared/`

#### Scenario: e2e excluded from coverage
- **WHEN** coverage is collected
- **THEN** the `e2e` project SHALL NOT be run for coverage and SHALL NOT contribute to the reported numbers

#### Scenario: Coverage artifacts are not committed
- **WHEN** a coverage run writes to `coverage/`
- **THEN** that directory SHALL be git-ignored and never committed

### Requirement: REQ-025 Coverage reporting to GitHub via Codecov
The workflow SHALL provide a `coverage` job that runs `pnpm test:coverage` and uploads the resulting `lcov` report to Codecov using a version-pinned `codecov/codecov-action`, so that pull requests receive a coverage comment with diff coverage and the project exposes a coverage badge. For the public repository the upload MAY be tokenless; if a token is required it SHALL be supplied via a `CODECOV_TOKEN` repository secret and MUST NOT be logged. Uploading coverage SHALL NOT require the DB/e2e infrastructure.

#### Scenario: Coverage uploaded on a pull request
- **WHEN** the `coverage` job runs on a pull request
- **THEN** it SHALL generate the `lcov` report and upload it to Codecov, which SHALL post/update a coverage comment reporting overall and diff coverage

#### Scenario: Badge reflects default-branch coverage
- **WHEN** the `coverage` job runs on a push to `main`
- **THEN** Codecov SHALL update the project coverage used by the README badge

#### Scenario: Upload token is not exposed
- **WHEN** a `CODECOV_TOKEN` secret is configured
- **THEN** it SHALL be passed only to the upload action and MUST NOT appear in logs

### Requirement: REQ-026 Report-only coverage policy
Coverage SHALL be informational only and MUST NOT block merges: a `codecov.yml` SHALL configure the coverage status as `informational: true` (no failing threshold) to establish a baseline before any gating is introduced. The `coverage` job MAY run in parallel with the other verify jobs and SHALL NOT be added to the merge-blocking required checks (REQ-023) as part of this change.

#### Scenario: Low coverage does not block merge
- **WHEN** coverage decreases on a pull request
- **THEN** the Codecov status SHALL report the change but SHALL NOT fail the check or block merging

#### Scenario: Coverage job failure is isolated
- **WHEN** the `coverage` job itself fails (e.g. upload error)
- **THEN** it SHALL NOT be a required merge-blocking check while the policy is report-only
