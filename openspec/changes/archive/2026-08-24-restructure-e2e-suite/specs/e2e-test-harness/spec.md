## ADDED Requirements

### Requirement: REQ-271 E2E suite layout by runtime
The e2e suite SHALL be laid out by runtime under `test/e2e/`: `api/` (HTTP against a booted Nuxt server), `ui/` (Playwright against a booted Nuxt server), `db/` (Postgres only: migrator, schema, historical migrations, server-util tests that import server modules), `harness/` (container, template clone, server boot, guards, global setup), and `helpers/` (user seeding, API login, UI login, HTTP fixtures, DOM scripts). Vitest SHALL discover specs recursively under those directories via dedicated projects (not a single `test/e2e/*.spec.ts` glob). Specs that boot Nuxt MUST live under `api/` or `ui/`. Specs that do not boot Nuxt MUST live under `db/`.

#### Scenario: Recursive discovery
- **WHEN** `pnpm test:e2e:api`, `pnpm test:e2e:ui`, or `pnpm test:e2e:db` runs
- **THEN** each command SHALL execute only the matching directory's specs and SHALL include nested spec files

#### Scenario: Nuxt-less specs skip the production build
- **WHEN** the db project runs
- **THEN** global setup SHALL start Postgres and prepare the template database and SHALL NOT run a Nuxt production build

#### Scenario: Misplaced spec is a layout error
- **WHEN** a Playwright spec is added under `api/` or an HTTP `fetch` spec is added under `db/`
- **THEN** that SHALL be treated as a harness layout defect (the spec belongs in `ui/` or `api/` respectively)

### Requirement: REQ-272 User-per-it isolation for HTTP and UI specs
HTTP (`api/`) and UI (`ui/`) specs SHALL keep one cloned database and one Nuxt server per spec file (REQ-052, REQ-054). Each test (`it`) that mutates domain data SHALL obtain a unique user via helpers rather than sharing a file-level seeded account, so leftover rows, unique names, and the single-running-timer invariant cannot leak across tests in the same file.

#### Scenario: Concurrent tests do not share a user
- **WHEN** two tests in the same api spec file each call the user-seed helper
- **THEN** each SHALL receive a distinct email/user id and SHALL NOT observe the other's trackers, projects, tasks, or time entries

#### Scenario: Shared-user leftover is forbidden
- **WHEN** an api spec starts a running timer in one test
- **THEN** a later or concurrent test in that file MUST NOT see that running timer unless it used the same helper-returned user (which helpers MUST NOT reuse across tests)

#### Scenario: DB-only specs keep empty-database-per-test
- **WHEN** a `db/` migrator or historical-migration test runs
- **THEN** it SHALL continue to provision an empty database per test (REQ-057) rather than a user-per-it on a shared schema

### Requirement: REQ-273 In-file concurrency for API specs
The api Vitest project SHALL allow tests inside a spec file to run concurrently, capped so a single file does not overwhelm the per-file Nitro process. Specs that assert login rate limiting, mutate process-wide environment, or drive a browser SHALL remain sequential.

#### Scenario: Fat API file runs tests concurrently
- **WHEN** an api spec that uses user-per-it fixtures enables in-file concurrency
- **THEN** multiple `it` blocks in that file MAY run at the same time against the same Nuxt server and cloned database

#### Scenario: Auth throttle spec stays serial
- **WHEN** the authentication spec asserts excessive login attempts are throttled
- **THEN** its tests SHALL run sequentially and SHALL NOT share the login bucket with concurrent siblings in the same file

#### Scenario: UI specs stay serial
- **WHEN** a ui spec file runs
- **THEN** its tests SHALL execute one at a time (one Playwright page/flow at a time per file)

### Requirement: REQ-274 Historical migrations apply only older SQL
Historical migration specs under `db/` SHALL apply committed migration SQL files whose numeric prefix is strictly less than the migration under test, seed the pre-change shape, then apply that one migration. They SHALL NOT apply later migrations in the "before" set. New additive migrations (column/index only, no data rewrite) SHALL NOT require a new historical capsule.

#### Scenario: Prefix filter ignores later files
- **WHEN** a capsule for migration `0015` runs and later files such as `0016_*.sql` exist
- **THEN** the before-set SHALL include only files with prefix `0000`–`0014` and SHALL NOT execute `0016` or later before applying `0015`

#### Scenario: Exclude-by-filename is insufficient
- **WHEN** a new migration file is added whose name does not match the capsule's exclude string
- **THEN** the prefix filter SHALL still omit it from the before-set (the suite MUST NOT rely on `!startsWith('0015_')` style excludes)

## MODIFIED Requirements

### Requirement: REQ-053 Parallel execution with worker cap
Each e2e Vitest project that boots Nuxt (`api`, `ui`) SHALL enable `fileParallelism: true` and SHALL cap the number of concurrently booted servers to a bounded worker count to prevent CPU thrash. The `db` project SHALL run spec files in parallel without booting Nuxt.

#### Scenario: Files run in parallel
- **WHEN** `pnpm test:e2e:api` (or `ui`) is executed
- **THEN** spec files run in parallel worker processes rather than strictly serially

#### Scenario: Concurrency is bounded
- **WHEN** more api or ui spec files exist than the configured worker cap
- **THEN** the number of simultaneously running Nuxt servers MUST NOT exceed the cap (e.g. `min(4, cpus/2)`)

#### Scenario: Db project has no Nuxt workers
- **WHEN** `pnpm test:e2e:db` is executed
- **THEN** no Nuxt server SHALL be started for those files

### Requirement: REQ-054 Two-mode server setup
The harness SHALL boot a per-file Nuxt server isolated to that file's database for `api/` and `ui/` specs, selecting build-once mode by default and dev mode when `NUXT_TEST_DEV` is set. When a prebuilt `.output` is already present (CI artifact or a prior local build) and skip-build is requested, global setup SHALL NOT run `pnpm build`. When skip-build is requested and `.output` is missing, setup SHALL fail rather than silently rebuild or skip the suite.

#### Scenario: CI build-once mode
- **WHEN** `NUXT_TEST_DEV` is unset and no skip-build artifact is provided
- **THEN** global setup builds `.output` once and each spec uses `setup({ build: false })` against the shared output

#### Scenario: Skip rebuild when artifact is present
- **WHEN** skip-build is set and `.output` exists
- **THEN** global setup SHALL NOT invoke `pnpm build` and specs SHALL use that output

#### Scenario: Skip-build without output fails
- **WHEN** skip-build is set and `.output` is missing
- **THEN** setup SHALL fail with an error naming the missing output (the suite SHALL NOT skip)

#### Scenario: Local dev mode
- **WHEN** `NUXT_TEST_DEV=1` is set
- **THEN** no production build is performed and each spec uses `setup({ dev: true })` via `nuxi dev`

#### Scenario: Per-file env injection
- **WHEN** a server boots from the prebuilt output
- **THEN** the per-file `DATABASE_URL` and shared `NUXT_SESSION_PASSWORD` MUST be passed via `setup({ env })` so the baked `runtimeConfig` is overridden at runtime

### Requirement: REQ-055 Unified seeding and guards
The harness SHALL provide helpers for seeding unique users (shared scrypt hasher) and API/UI login, and a single guard convention via `requireDocker()` / `requireBrowser()`. Locally, missing Docker or browser SHALL skip the suite. When the environment indicates CI, missing Docker (api/db/ui) or missing Chromium (ui) SHALL fail the suite rather than skip.

#### Scenario: Shared seeding
- **WHEN** a spec needs seeded users
- **THEN** it SHALL call the helpers (unique email per test for HTTP/UI mutating tests) instead of duplicating an inline scrypt-and-insert block or reusing a file-level account for those tests

#### Scenario: Missing Docker skips, never fails
- **WHEN** Docker is not available and the environment is not CI
- **THEN** docker-dependent specs are skipped (not failed) via `requireDocker()`

#### Scenario: Missing browser skips, never fails
- **WHEN** no browser binary is available and the environment is not CI
- **THEN** ui specs are skipped (not failed) via `requireBrowser()`

#### Scenario: Missing Docker in CI fails
- **WHEN** Docker is not available and the environment is CI
- **THEN** api, db, and ui suites SHALL fail (not skip)

#### Scenario: Missing Chromium in CI fails
- **WHEN** no Chromium binary is available and the environment is CI
- **THEN** the ui suite SHALL fail (not skip)

### Requirement: REQ-057 Migrator spec on empty database
Migrator, schema, and historical-migration specs SHALL live under `db/` and SHALL provision a fresh empty database (cloned from `template0`) per test rather than the migrated template, except schema tests that need the current migrated shape MAY clone the template (REQ-052) without booting Nuxt.

#### Scenario: Empty database per test
- **WHEN** a migrator test runs
- **THEN** it provisions an empty database via `provisionEmptyDatabase()` and validates the migrator against it

#### Scenario: Schema tests do not boot Nuxt
- **WHEN** a current-schema constraint spec runs
- **THEN** it SHALL use Postgres only and SHALL NOT start a Nuxt server
