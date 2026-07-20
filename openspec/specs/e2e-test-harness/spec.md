# e2e-test-harness Specification

## Purpose
Define how the end-to-end (e2e) test harness provisions, isolates, and tears down its runtime so spec files run reliably and in parallel. Each spec file runs against its own PostgreSQL database cloned from a single pre-migrated template, ensuring no cross-file state bleed. The harness boots a per-file Nuxt server (build-once mode by default, dev mode when `NUXT_TEST_DEV` is set), provides unified seeding and environment-availability guards (Docker/browser), bounds parallelism with a worker cap, and guarantees clean teardown of containers and server processes. It also covers the migrator spec running against fresh empty databases and the use of a portable `127.0.0.1` connection host.
## Requirements
### Requirement: REQ-052 Per-file database isolation
Each e2e spec file SHALL run against its own PostgreSQL database, cloned from a single pre-migrated template database, so that files do not share mutable state.

#### Scenario: Spec provisions its own database
- **WHEN** an e2e spec file starts and calls the harness to provision a database
- **THEN** a uniquely named database is created via `CREATE DATABASE <unique> TEMPLATE <tpl>` and the spec receives a `DATABASE_URL` pointing only to that database

#### Scenario: No cross-file data bleed
- **WHEN** multiple spec files run and each seeds and mutates users
- **THEN** changes made by one file MUST NOT be visible to another file

#### Scenario: Template clone with no active connections
- **WHEN** the template is migrated during global setup
- **THEN** the migration pool MUST be closed before any clone so `CREATE DATABASE ... TEMPLATE` does not fail with an active-connection error

### Requirement: REQ-053 Parallel execution with worker cap
The e2e project SHALL enable `fileParallelism: true` and SHALL cap the number of concurrently booted servers to a bounded worker count to prevent CPU thrash.

#### Scenario: Files run in parallel
- **WHEN** `pnpm test:e2e` is executed
- **THEN** spec files run in parallel worker processes rather than strictly serially

#### Scenario: Concurrency is bounded
- **WHEN** more spec files exist than the configured worker cap
- **THEN** the number of simultaneously running Nuxt servers MUST NOT exceed the cap (e.g. `min(4, cpus/2)`)

### Requirement: REQ-054 Two-mode server setup
The harness SHALL boot a per-file Nuxt server isolated to that file's database, selecting build-once mode by default and dev mode when `NUXT_TEST_DEV` is set.

#### Scenario: CI build-once mode
- **WHEN** `NUXT_TEST_DEV` is unset
- **THEN** global setup builds `.output` once and each spec uses `setup({ build: false })` against the shared output

#### Scenario: Local dev mode
- **WHEN** `NUXT_TEST_DEV=1` is set
- **THEN** no production build is performed and each spec uses `setup({ dev: true })` via `nuxi dev`

#### Scenario: Per-file env injection
- **WHEN** a server boots from the prebuilt output
- **THEN** the per-file `DATABASE_URL` and shared `NUXT_SESSION_PASSWORD` MUST be passed via `setup({ env })` so the baked `runtimeConfig` is overridden at runtime

### Requirement: REQ-055 Unified seeding and guards
The harness SHALL provide a single `seedUsers([...])` backed by one shared scrypt hasher and a single skip convention via `requireDocker()` / `requireBrowser()`.

#### Scenario: Shared seeding
- **WHEN** a spec needs seeded users
- **THEN** it calls `seedUsers([...])` instead of duplicating an inline scrypt-and-insert block

#### Scenario: Missing Docker skips, never fails
- **WHEN** Docker is not available locally
- **THEN** docker-dependent specs are skipped (not failed) via `requireDocker()`

#### Scenario: Missing browser skips, never fails
- **WHEN** no browser binary is available
- **THEN** browser specs (`auth-ui`, `shell`, `i18n-login`) are skipped (not failed) via `requireBrowser()`

### Requirement: REQ-056 Reliable teardown
After the run completes, the harness SHALL leave no lingering containers or server processes.

#### Scenario: Container removed
- **WHEN** the e2e global teardown runs
- **THEN** `stopPostgres()` removes the container via `docker rm -f` and `docker ps` no longer shows `osi-time-tracker-e2e-pg`

#### Scenario: No orphan servers
- **WHEN** the run finishes
- **THEN** no orphan Nuxt/Node server processes from the suite remain running

#### Scenario: Leftover databases cleaned on container reuse
- **WHEN** `prepareTemplate()` runs against a reused container
- **THEN** leftover `osi_time_tracker_*` databases from previous runs are bulk-cleaned

### Requirement: REQ-057 Migrator spec on empty database
The migrator spec (`db.spec`) SHALL provision a fresh empty database (cloned from `template0`) per test rather than the migrated template.

#### Scenario: Empty database per test
- **WHEN** a `db.spec` test runs
- **THEN** it provisions an empty database via `provisionEmptyDatabase()` and validates the migrator against it

### Requirement: REQ-058 Portable connection host
The harness SHALL use `127.0.0.1` rather than `host.docker.internal` for database URLs.

#### Scenario: Portable URL
- **WHEN** a `DATABASE_URL` is produced by the harness
- **THEN** its host is `127.0.0.1` so it resolves consistently in CI and locally
