## Context

See proposal.md for motivation. Today one Vitest `e2e` project glob `test/e2e/*.{test,spec}.ts` shares `support/global-setup.ts` (always `pnpm build` + Docker Postgres). Guards `requireDocker()` / `requireBrowser()` skip entire describes when Chromium is missing. CI's `e2e` job does not install Playwright browsers and does not list `playwright` in pnpm `allowBuilds`. `pnpm test:coverage` is unit+nuxt only; HTTP tests never credit `server/api` because they `fetch()` a child Nitro process. File-scoped DBs are shared by every `it()` in a file (same seeded user, `Date.now()` names, manual timer cleanup).

Constraints: keep per-file DB clone + per-file Nitro (REQ-052/054); GitHub-hosted `ubuntu-latest`; coverage stays informational.

## Goals / Non-Goals

**Goals:**
- Three runtimes, three Vitest projects, matching directories.
- Honest CI (no silent skip); api/ui reuse the `build` artifact.
- User-per-it so API files can run `it()`s concurrently without data races.
- Codecov totals include Nitro-side hits from HTTP tests.

**Non-Goals:**
- Per-`it` `CREATE DATABASE` for HTTP/UI.
- Playwright client coverage.
- Changing product code except sourcemaps for the CI e2e artifact.

## Decisions

1. **Three Vitest projects, not one glob.** `e2e-api`, `e2e-ui`, `e2e-db` with includes `test/e2e/{api,ui,db}/**/*.{test,spec}.ts`. Scripts: `test:e2e:api`, `test:e2e:ui`, `test:e2e:db`; `test:e2e` runs all three sequentially for local convenience. *Alternative: directories only, one project* — rejected: db would still pay for `pnpm build` and UI would still need Chromium for a mixed run.

2. **`harness/` vs `helpers/`.** Infra (postgres, database, global-setup, setupServer, guards) in `harness/`; login/seed/HTTP/DOM in `helpers/`. *Alternative: rename `support` → `common`* — rejected: junk-drawer name. *Alternative: single `harness/`* — rejected: CookieJar is not setup.

3. **CI skip = red via `process.env.CI`.** GitHub Actions sets `CI=true`. Guards throw when Docker/Chromium missing in CI; locally they still `describe.skip`. *Alternative: drop guards entirely* — rejected: Windows/local without Docker should still run unit/nuxt.

4. **User-per-it, not per-it DB, for HTTP/UI.** Unique email each `seedUser()` / `apiLogin()` / `loginAs()`. One Nitro per file cannot switch `DATABASE_URL` (lazy Drizzle client). *Alternative: reboot Nitro per `it`* — rejected: dominates runtime. *Alternative: keep shared alice + `Date.now()`* — rejected: that is the leak.

5. **In-file concurrency is opt-in on fat API files** (`describe.concurrent` / `it.concurrent`, `maxConcurrency` ~5), not `sequence.concurrent` on the whole api project. Auth throttle, env-mutating, and all UI/db files stay serial. *Alternative: project-wide concurrent* — rejected: `auth.spec` measures the login bucket.

6. **Skip-build env `NUXT_TEST_SKIP_BUILD=1`.** Global setup for api/ui: if set and `.output` exists → no `pnpm build`; if set and missing → fail. Db project's global setup never builds. CI `build` job uploads `.output` (retention 1 day); api/ui download to the same path. Build job sets `NUXT_BUILD_SOURCEMAP=1` (or equivalent) so the artifact has maps; production Dockerfile does not. *Alternative: rebuild in each job* — rejected: doubles wall time. *Alternative: always-on production sourcemaps* — rejected: leaks sources in the self-hosted image.

7. **UI job installs Chromium explicitly.** `pnpm-workspace.yaml` `allowBuilds` includes `playwright` / `playwright-core`, and the job runs `pnpm exec playwright install --with-deps chromium`. Binary presence is asserted before tests.

8. **Nitro V8 coverage on the api job, Codecov flags.** Pass `NODE_V8_COVERAGE` through `setup({ env })`, convert to lcov in api global teardown, upload `flags: e2e-api`. Existing coverage job uploads `flags: unit-nuxt`. If lcov has no `server/`/`app/`/`shared/` paths, fail the upload step. UI job does not collect coverage. *Alternative: add e2e to `pnpm test:coverage`* — rejected: Vitest v8 instruments the worker, not Nitro. *Alternative: istanbul in the client bundle* — rejected: out of scope; `test/nuxt` owns components.

9. **Historical capsules: numeric prefix `< N`.** Shared helper in `harness/` lists `server/db/migrations/*.sql` and keeps files whose `^\d{4}` prefix is `< N`. Existing 0014/0015 specs switch to it. No new capsules unless a future migration rewrites data.

10. **`test/nuxt` vs UI e2e (guideline only).** Nuxt = component + mocks; api = HTTP contract; ui = journeys + production wiring. Do not delete overlapping UI specs in this change.

### Target layout

```
test/e2e/
  harness/     postgres, database, global-setup, setupServer, guards
  helpers/     seedUser, apiLogin, loginAs, createTracker/createProject, fixtures, dom
  api/         HTTP specs
  ui/          Playwright specs
  db/          migrator, schema, historical, server-util+DB
```

### CI shape

```
cheap parallel: lint, format, type-check, unit, nuxt, coverage(unit-nuxt), build→artifact
db    needs cheap except build
api   needs cheap + build, download .output, skip-build, NODE_V8_COVERAGE → flag e2e-api
ui    needs cheap + build, download .output, skip-build, playwright install
```

### File moves (mechanical)

- **api/** — `auth`, `projects`, `trackers`, `tasks`, `tasks-remote-issue-ref`, `time-entries`, `timer-flow`, `timer-view-feed`, `user-settings`, `sync-day`, `sync-export`, `remote-issue-proxy`, `remote-activities-proxy`, `remote-export-proxy`, `remote-sync-guard`
- **ui/** — `auth-ui`, `i18n-login`, `shell`, `ssr-list-and-timer`, `projects-ui`, `trackers-ui`, `user-settings-ui`, `timer-view-ui`, `timer-topbar-start-edit`, `remote-issue-picker-ui`, `remote-issue-picker-proxied-ui`, `remote-sync-ui`
- **db/** — `db`, `tasks-schema`, `remote-exports-schema`, both historical migration specs, `resolve-task-id`, `remote-issue-refs`

## Risks / Trade-offs

- **[`@nuxt/test-utils` may not forward `NODE_V8_COVERAGE` to Nitro]** → Spike first: one api spec, inspect coverage dir, confirm lcov paths. If inheritance fails, wrap the started server or write coverage from a shutdown hook. Do not upload chunk-only lcov.
- **[GitHub ruleset still requires old `e2e` check]** → Document in `docs/github-setup.md`; after first green run of `db`/`api`/`ui`, maintainer replaces the required check. Until then PRs may look blocked or over-required.
- **[Artifact size / download time for `.output`]** → Accept; still cheaper than rebuilding. Retention 1 day.
- **[In-file concurrent + login limiter]** → Per-file Nitro has its own 30/3s bucket; cap concurrency at 5; keep auth serial.
- **[User-per-it increases seed cost]** → scrypt per test; acceptable vs leaked running timers. Shared hasher stays.

## Migration Plan

1. Harness/helpers + Vitest projects + globs (tests still pass locally).
2. Move files; fix imports; `nuxt.config` `tsConfig.include`.
3. User-per-it + extract duplicated login/tracker helpers; opt-in concurrent on fat api files.
4. CI: artifact, split jobs, Playwright install, skip=red.
5. Coverage spike + flags.
6. Update `docs/e2e-guideline.md` and `docs/github-setup.md`; maintainer edits the ruleset.

Rollback: revert the workflow to a single `e2e` job and restore the `e2e` required check.

## Open Questions

None that change specs. The Nitro coverage hook is a spike with a specified failure mode (do not upload unmapped lcov).
