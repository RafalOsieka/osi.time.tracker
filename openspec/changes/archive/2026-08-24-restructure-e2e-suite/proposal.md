## Why

The e2e suite is one flat Vitest project mixing HTTP, Playwright, schema, and server-util tests. Guards skip (never fail) when Chromium is missing, so CI can go green while the UI slice never runs. Codecov ignores e2e, so `server/api` looks uncovered. The suite outgrew the 2026-06-28 harness; it needs structure, honest CI, and coverage that reflects what HTTP tests actually hit.

## What Changes

- Split `test/e2e` into `api/`, `ui/`, `db/`, plus `harness/` (infra) and `helpers/` (login, seed, HTTP fixtures).
- Separate Vitest projects and pnpm scripts for api, ui, and db.
- **CI skip = red**: missing Docker or Chromium in CI fails the job; local skip remains.
- Split CI: `db` (Postgres, no `.output`), `api` (HTTP), `ui` (Playwright). `build` uploads `.output`; api/ui download it and skip rebuild.
- Install Chromium (and OS deps) in the `ui` job; allow Playwright's install script in pnpm `allowBuilds`.
- HTTP isolation: keep file-scoped DB + one Nitro; **user-per-it** fixtures. Fat API files MAY run `it()`s concurrently. Auth throttle, db, and UI stay serial.
- Historical migrations: freeze under `db/`, apply files with numeric prefix `< N` only.
- Collect Nitro V8 coverage during the api job; upload Codecov flag `e2e-api`. Keep `pnpm test:coverage` as unit+nuxt. No Playwright client coverage.
- **BREAKING** (CI ruleset): required check `e2e` splits into `db`, `api`, and `ui` (document in `docs/github-setup.md`).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `e2e-test-harness`: layout, skip policy, skip-build, user-per-it, API in-file concurrency, migration filter.
- `ci-pipeline`: split jobs, artifact reuse, Playwright, required checks.
- `coverage-reporting`: Nitro-side e2e-api coverage and Codecov flags.

## Non-goals

- New product behavior or new domain tests except harness regressions.
- Per-`it` database clones for HTTP/UI specs.
- Browser/client coverage from Playwright.
- Folding e2e into `pnpm test:coverage`.
- Deleting `test/nuxt` overlap; ownership is documented only.
- Coverage merge gating (stays informational).

## Impact

- `test/e2e/**`, `vitest.config.ts`, `package.json`, `nuxt.config.ts` (tsConfig include, sourcemaps for e2e output).
- `.github/workflows/ci.yml`, `pnpm-workspace.yaml` (`allowBuilds`), `codecov.yml`, `docs/e2e-guideline.md`, `docs/github-setup.md`.
- GitHub ruleset: replace required check `e2e` with `db`, `api`, `ui` after first green run.
