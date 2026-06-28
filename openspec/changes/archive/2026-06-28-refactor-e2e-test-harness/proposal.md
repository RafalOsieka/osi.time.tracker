## Why

The e2e suite (`test/e2e/*.spec.ts`) is slow (>5 min), partially failing, and inconsistent: every spec re-implements its own PostgreSQL bring-up, user seeding, and skip guards, and `fileParallelism` is forced **off** to work around a single shared database. With CI on the horizon, the suite needs to be fast, deterministic, parallel-safe, and leave nothing running afterward.

## What Changes

- Introduce a shared e2e harness under `test/e2e/support/`: `database.ts`, `seed.ts`, `guards.ts`, `setupServer.ts` (plus refactored `postgres.ts`, `global-setup.ts`).
- **DB-per-file via template clone**: `global-setup` migrates one template DB once; each spec clones it (`CREATE DATABASE <unique> TEMPLATE <tpl>`), removing shared-DB coupling.
- Enable `fileParallelism: true` with a bounded worker cap to prevent CPU thrash from concurrent Nuxt boots.
- **Build-once, reuse** for CI fidelity (`setup({ build: false })`), with an opt-in `NUXT_TEST_DEV` dev mode (`setup({ dev: true })`) for a faster local loop.
- One scrypt hasher + `seedUsers([...])`; one guard convention `requireDocker()` / `requireBrowser()` that **skip** (not fail) when prerequisites are missing.
- Real teardown: `stopPostgres()` becomes `docker rm -f` so the container is removed after the run.
- Refactor all existing specs (`auth`, `clients`, `auth-ui`, `shell`, `i18n-login`, `db`) onto the harness; `db.spec` provisions a fresh empty DB (clone `template0`) per test.
- Use `127.0.0.1` (not `host.docker.internal`) for portability.

## Capabilities

### New Capabilities
- `e2e-test-harness`: Shared, consistent e2e test infrastructure providing per-file database isolation, parallel execution, two-mode server setup (build vs dev), unified seeding/guards, and reliable teardown.

### Modified Capabilities
<!-- None — this change restructures test infrastructure only; no behavioral spec requirements change. -->

## Impact

- **Test code**: all `test/e2e/*.spec.ts` and `test/e2e/support/*` files.
- **Config**: `vitest.config.ts` (e2e project: parallelism + worker cap).
- **Tooling/CI**: requires Docker present in CI; guards skip gracefully locally without Docker/browser.
- **No production code changes**; no behavioral coverage added (restructuring only).

## Non-goals

- Adding new test cases / behavioral coverage.
- Moving `i18n-login` to the `nuxt` environment (deferred; stays e2e).
- Merging `auth.spec` + `clients.spec` (stay separate).
- Defining the CI pipeline / workflow files themselves.
