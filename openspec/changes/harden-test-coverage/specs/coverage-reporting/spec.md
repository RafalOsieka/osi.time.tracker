## ADDED Requirements

### Requirement: REQ-279 Non-executable sources are omitted from coverage
The in-process unit+nuxt coverage run SHALL omit files that are not executable application logic: SQL and JSON under the database migrations directory, other `*.sql` / `*.json` under `app/`, `server/`, or `shared/`, and the bundler-warmup plugin whose body is never executed at runtime. Those files SHALL NOT appear as uncovered rows in the unit-nuxt lcov. The Nitro-side e2e-api `c8` conversion SHALL NOT apply that Vitest include/exclude list to compiled output chunks (those globs would drop remappable `.output` files before sourcemaps run). Playwright/UI client coverage SHALL remain uncollected (REQ-277).

#### Scenario: Migration snapshots do not appear as misses
- **WHEN** unit-nuxt or e2e-api coverage is generated
- **THEN** the lcov SHALL NOT list Drizzle migration snapshot or journal JSON files, and SHALL NOT list migration SQL files

#### Scenario: Never-run warmup plugin is omitted
- **WHEN** unit-nuxt or e2e-api coverage is generated
- **THEN** the bundler-warmup plugin SHALL NOT appear as an uncovered source file

#### Scenario: UI coverage is still not collected
- **WHEN** this exclude list is applied
- **THEN** the ui job SHALL still not upload a Playwright/client coverage report

## MODIFIED Requirements

### Requirement: REQ-024 Coverage measurement from unit and nuxt tests
The project SHALL support code-coverage collection via Vitest's `v8` provider (`@vitest/coverage-v8`), configured centrally in `vitest.config.ts`. In-process coverage SHALL be measured from the `unit` and `nuxt` test projects executed together in a single Vitest run exposed as the `test:coverage` script. Coverage sources SHALL be limited to first-party application code (`app/`, `server/`, `shared/`); test files, config, generated Nuxt output, tooling, database migration SQL/JSON, other `*.sql` / `*.json` under those trees, and the never-run bundler-warmup plugin SHALL be excluded (REQ-279). The `test:coverage` script SHALL NOT run api, ui, or db e2e projects. The run SHALL emit at least `lcov` (for upload), `json-summary`, and `text` reports into a git-ignored `coverage/` directory.

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

### Requirement: REQ-277 API e2e coverage from the Nitro process
The `api` CI job SHALL collect code coverage from the Nuxt/Nitro process that serves HTTP tests (not from the Vitest worker that only calls `fetch`). Coverage sources SHALL be first-party `app/`, `server/`, and `shared/` paths produced by sourcemap remap of the Nitro process. The `c8` conversion SHALL NOT apply the Vitest include/exclude list from REQ-279 to compiled `.output` chunks. The production output used for those tests SHALL include source maps so attributed files are the TypeScript/Vue sources, not opaque `.output` chunks. Playwright/UI client coverage SHALL NOT be collected. If the collected report cannot be attributed to those first-party sources, the coverage-upload step SHALL fail rather than publish an unusable report.

#### Scenario: Http tests credit server routes
- **WHEN** the api job runs HTTP specs against the booted server
- **THEN** executed `server/api` handlers SHALL appear as covered in the uploaded `e2e-api` report

#### Scenario: Unmapped output fails the upload
- **WHEN** the converted lcov only names bundled `.output` chunks with no first-party `server/` or `app/` or `shared/` paths
- **THEN** the api job SHALL fail the coverage step and SHALL NOT upload that report to Codecov

#### Scenario: Ui job does not upload browser coverage
- **WHEN** the ui job finishes
- **THEN** it SHALL NOT upload a Playwright/client coverage report

#### Scenario: Converted e2e-api lcov is not filtered with Vitest globs
- **WHEN** the api job converts the Nitro V8 dump to lcov
- **THEN** `c8 report` SHALL run without Vitest `--include`/`--exclude` globs, and the uploaded report SHALL still map to first-party `app/`/`server/`/`shared/` sources rather than only `.output` chunks
