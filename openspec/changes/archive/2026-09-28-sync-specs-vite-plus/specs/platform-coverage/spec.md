# Spec Delta

## MODIFIED Requirements

### Requirement: REQ-024 Coverage measurement from unit and nuxt tests
The project SHALL support code-coverage collection via Vitest's `v8` provider (`@vitest/coverage-v8`, pinned through the workspace catalog alongside Vitest), configured in the web package's Vitest config (`apps/web/vitest.config.ts`). In-process coverage SHALL be measured from the `unit` and `nuxt` test projects executed together in a single Vitest run exposed as the `test:coverage` script. Coverage sources SHALL be limited to first-party application code (`app/`, `server/`, `shared/`). Test files, config, generated Nuxt output, tooling, database migration SQL/JSON, other `*.sql` / `*.json` under those trees, and the never-run bundler-warmup plugin SHALL be excluded (REQ-279). The `test:coverage` script SHALL NOT run api, ui, or db e2e projects. The run SHALL emit at least `lcov` (for upload), `json-summary`, and `text` reports into a git-ignored `coverage/` directory.

#### Scenario: Coverage run produces an lcov report
- **WHEN** `pnpm test:coverage` runs
- **THEN** the `unit` and `nuxt` projects SHALL execute with instrumentation and produce an `lcov` report under `coverage/`, covering only `app/`, `server/`, and `shared/`

#### Scenario: e2e excluded from coverage
- **WHEN** `pnpm test:coverage` runs
- **THEN** the api, ui, and db e2e projects SHALL NOT be run as part of that script (Nitro-side e2e-api coverage is collected by the `api` job instead)

#### Scenario: Coverage artifacts are not committed
- **WHEN** a coverage run writes to `coverage/`
- **THEN** that directory SHALL be git-ignored and never committed

#### Scenario: Non-executable files are not in the unit-nuxt report
- **WHEN** `pnpm test:coverage` writes `coverage/lcov.info`
- **THEN** that report SHALL NOT include migration SQL/JSON or the bundler-warmup plugin

#### Scenario: Coverage provider matches Vitest
- **WHEN** the lockfile is inspected
- **THEN** `@vitest/coverage-v8` SHALL resolve to the same version as the catalog-pinned `vitest`
