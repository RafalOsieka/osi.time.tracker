## 1. DB-per-file provisioning + container lifecycle

- [ ] 1.1 Modify `test/e2e/support/postgres.ts`: switch DB host to `127.0.0.1`; expose admin URL helper for the `postgres` db (REQ-NFR-107)
- [ ] 1.2 Implement `stopPostgres()` as `docker rm -f` replacing the current no-op (REQ-NFR-105)
- [ ] 1.3 Add `test/e2e/support/database.ts` with `prepareTemplate()` that migrates the template DB once, bulk-cleans leftover `osi_time_tracker_*` DBs, and closes its pool before any clone (REQ-NFR-101, REQ-NFR-105)
- [ ] 1.4 Add `provisionDatabase()` (`CREATE DATABASE <unique> TEMPLATE <tpl>`, returns per-file URL) and `provisionEmptyDatabase()` (clone `template0`) (REQ-NFR-101, REQ-NFR-106)
- [ ] 1.5 Update `test/e2e/support/global-setup.ts`: `startPostgres → prepareTemplate`; implement real `teardown()` calling `stopPostgres()` (REQ-NFR-105)
- [ ] 1.6 Verify (integration): two specs receive distinct `DATABASE_URL`s and `prepareTemplate` clone succeeds with no active-connection error (REQ-NFR-101)

## 2. Shared seed + guard helpers

- [ ] 2.1 Add `test/e2e/support/seed.ts` exposing `seedUsers([...])` backed by a single shared scrypt hasher (REQ-NFR-104)
- [ ] 2.2 Add `test/e2e/support/guards.ts` with `requireDocker()` / `requireBrowser()` using a single `describe.skip` convention (skip, never fail) (REQ-NFR-104)
- [ ] 2.3 Verify (integration): missing Docker and missing browser both cause specs to skip (not fail) (REQ-NFR-104)

## 3. Two-mode server setup wrapper

- [ ] 3.1 Add `test/e2e/support/setupServer.ts` exporting `setupServer({ databaseUrl, browser })` (REQ-NFR-103)
- [ ] 3.2 Resolve mode from `NUXT_TEST_DEV`: set → `setup({ dev: true })`; unset → `setup({ build: false })` against the shared `.output` (REQ-NFR-103)
- [ ] 3.3 Inject per-file `env: { DATABASE_URL, NUXT_SESSION_PASSWORD }` via `setup({ env })` from a shared harness constant (REQ-NFR-103)
- [ ] 3.4 Update `global-setup.ts` to build `.output` once only when `NUXT_TEST_DEV` is unset (REQ-NFR-103)
- [ ] 3.5 Verify (integration): a booted server reads the injected per-file `DATABASE_URL`/`NUXT_SESSION_PASSWORD` at runtime (REQ-NFR-103)

## 4. Parallelism with a worker cap

- [ ] 4.1 Edit `vitest.config.ts` e2e project: remove `fileParallelism: false` (enable parallel files) (REQ-NFR-102)
- [ ] 4.2 Add a worker concurrency cap via `poolOptions`/`maxWorkers` (e.g. `min(4, cpus/2)`) (REQ-NFR-102)
- [ ] 4.3 Keep `hookTimeout`/`testTimeout` appropriate for parallel cold starts (REQ-NFR-102)

## 5. Refactor specs onto the harness

- [ ] 5.1 Refactor `auth.spec.ts`: `provisionDatabase()` → `seedUsers()` → `setupServer()`, guarded by `requireDocker()` (REQ-NFR-101, REQ-NFR-104)
- [ ] 5.2 Refactor `clients.spec.ts` similarly, kept as a separate file with its own DB + server (REQ-NFR-101, REQ-NFR-104)
- [ ] 5.3 Refactor `auth-ui.spec.ts` and `shell.spec.ts`: harness with `requireDocker()` + `requireBrowser()` (REQ-NFR-103, REQ-NFR-104)
- [ ] 5.4 Refactor `i18n-login.spec.ts` onto the harness; stays e2e with `requireDocker()` + `requireBrowser()` (REQ-NFR-104)
- [ ] 5.5 Refactor `db.spec.ts` to use `provisionEmptyDatabase()` per test for the migrator tests (REQ-NFR-106)
- [ ] 5.6 Remove per-spec inline `startPostgres`/scrypt/TRUNCATE boilerplate and ad-hoc guards (REQ-NFR-104)

## 6. Validation

- [ ] 6.1 Run `pnpm test:e2e` (build mode): green with files running in parallel (REQ-NFR-102, REQ-NFR-103)
- [ ] 6.2 Run `NUXT_TEST_DEV=1 pnpm test:e2e` (dev mode): green without a production build (REQ-NFR-103)
- [ ] 6.3 Confirm clean teardown: `docker ps` shows no `osi-time-tracker-e2e-pg` and no orphan server processes remain (REQ-NFR-105)
- [ ] 6.4 Confirm wall-clock time is meaningfully lower than the serial >5 min baseline (REQ-NFR-102)
