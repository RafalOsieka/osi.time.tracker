## 1. Backend: projects, harness, and globs

- [x] 1.1 Create `test/e2e/harness/` by moving `postgres.ts`, `database.ts`, `global-setup.ts`, `setup-server.ts`, and `guards.ts` out of `support/`; leave re-export shims only if a mid-move compile requires them, then delete `support/` when empty (REQ-271)
- [x] 1.2 Split `vitest.config.ts` into projects `e2e-api`, `e2e-ui`, `e2e-db` with recursive includes `test/e2e/{api,ui,db}/**/*.{test,spec}.ts`, per-project globalSetup, and Nuxt worker cap only on api/ui; add `package.json` scripts `test:e2e:api`, `test:e2e:ui`, `test:e2e:db` and make `test:e2e` run all three; update `nuxt.config.ts` `tsConfig.include` to `../test/e2e/**` (REQ-271, REQ-053)
- [x] 1.3 Make db global setup start Postgres + `prepareTemplate` and never `pnpm build`; verify with `pnpm test:e2e:db` (after 2.x moves) that no `.output` rebuild is required (REQ-271, REQ-057)

## 2. Backend: skip-build and CI skip policy

- [x] 2.1 Implement `NUXT_TEST_SKIP_BUILD=1`: skip `pnpm build` when `.output` exists, fail with a missing-output error when it does not; keep `NUXT_TEST_DEV=1` as the no-build dev path (REQ-054)
- [x] 2.2 Change `requireDocker()` / `requireBrowser()` so `process.env.CI` throws instead of `describe.skip`; locally missing Docker/browser still skips; add a unit test in `test/unit/` (or a tiny harness spec) covering CI-fail vs local-skip (REQ-055)
- [x] 2.3 Verify skip-build failure mode by running api setup with the env set and `.output` removed and observing a hard fail, not a skip (REQ-054)

## 3. Backend: API helpers and unique users

- [x] 3.1 Add `helpers/seed.ts` unique `seedUser()` (email per call, shared hasher) and keep bulk seed only where a file truly needs a static account (auth throttle); verify two calls return distinct emails (REQ-272, REQ-055)
- [x] 3.2 Extract `helpers/auth.ts` `apiLogin()` and `helpers/http.ts` `createTracker` / `createProject` (and shared entry helpers used in multiple api files); delete per-file copies as specs are moved (REQ-055)
- [x] 3.3 Verify api helper isolation with a focused api spec: two `it`s seed different users, create a tracker each, and listing as user A does not include user B's tracker (REQ-272)

## 4. Frontend: UI login helper

- [x] 4.1 Extract `helpers/ui.ts` `loginAs(page, email)` (viewport, email/password testids, wait for topbar) and move `dom.ts` / `fixtures.ts` into `helpers/`; verify one ui spec still logs in through the helper (REQ-055)
- [x] 4.2 Replace duplicated UI login blocks in remaining ui specs with the helper as those files are moved (section 6) (REQ-055)

## 5. Backend: move api + db specs

- [x] 5.1 Move HTTP specs listed in design.md into `test/e2e/api/`, fix imports to `harness/` + `helpers/`, switch mutating tests to `seedUser()` + `apiLogin()` per `it` (auth throttle file may keep a static user and MUST stay serial) (REQ-271, REQ-272)
- [x] 5.2 e2e-api `maxConcurrency` is 5 (project allows in-file concurrent). Fat files stay sequential: `describe.concurrent` lost `@nuxt/test-utils` ALS for `url()`; origin is cached via `bindTestOrigin()`. `auth.spec.ts` stays serial. `pnpm test:e2e:api` is green (REQ-273)
- [x] 5.3 Move migrator, schema, historical, and server-util specs into `test/e2e/db/`; add `harness` helper that selects migration SQL with numeric prefix `< N` and switch the 0014/0015 capsules to it; verify `pnpm test:e2e:db` is green and a dummy later-prefixed filename would not run in the before-set (REQ-271, REQ-274, REQ-057)

## 6. Frontend: move ui specs

- [x] 6.1 Move Playwright specs listed in design.md into `test/e2e/ui/`, `setupServer({ browser: true })`, `requireBrowser()`, and per-`it` unique user + `loginAs`; keep tests serial (REQ-271, REQ-272, REQ-273)
- [x] 6.2 Verify `pnpm test:e2e:ui` is green locally when Chromium is installed, and skipped (not failed) when Chromium is absent and `CI` is unset (REQ-055)

## 7. Backend: CI db/api jobs and artifact

- [x] 7.1 Enable sourcemaps for the CI e2e artifact only (`NUXT_BUILD_SOURCEMAP` or equivalent in the `build` job); do not enable sourcemaps in the production Dockerfile (REQ-277, REQ-275)
- [x] 7.2 Change `.github/workflows/ci.yml`: `build` uploads `.output`; add `db` job (`pnpm test:e2e:db`, needs cheap jobs except `build`); add `api` job that downloads `.output`, sets `NUXT_TEST_SKIP_BUILD=1`, runs `pnpm test:e2e:api`; remove the single `e2e` job after `ui` exists (section 8) (REQ-017, REQ-275)
- [x] 7.3 Verify on a CI run (or act locally with skip-build): api does not invoke `pnpm build` when `.output` is present; missing artifact fails the job (REQ-275, REQ-054)

## 8. Frontend: CI ui job and Chromium

- [x] 8.1 Add `playwright` / `playwright-core` to `pnpm-workspace.yaml` `allowBuilds`; add `ui` job that downloads `.output`, skip-build, `pnpm exec playwright install --with-deps chromium`, then `pnpm test:e2e:ui` (REQ-276, REQ-017)
- [x] 8.2 Verify the ui job log shows Chromium installed and tests run (not skipped); a failed install fails the job (REQ-276, REQ-055)

## 9. Backend: e2e-api coverage

- [x] 9.1 Spike: pass `NODE_V8_COVERAGE` through `setup({ env })` on one api spec, convert to lcov, confirm paths under `server/` (not only `.output` chunks). If inheritance fails, wrap the Nitro process as in design.md (REQ-277)
- [x] 9.2 Wire api global teardown to write lcov; fail the coverage step when the report has no first-party `app/`/`server/`/`shared/` paths; upload from the api job with Codecov flag `e2e-api`; set the existing coverage job flag to `unit-nuxt`; keep `pnpm test:coverage` as unit+nuxt only (REQ-024, REQ-025, REQ-277, REQ-278)
- [x] 9.3 Verify Codecov PR comment shows both flags after a CI run, and that `pnpm test:coverage` still does not start Docker or e2e projects (REQ-025, REQ-278)

## 10. Docs and ruleset

- [x] 10.1 Update `docs/e2e-guideline.md`, `docs/github-setup.md` (required checks `db`, `api`, `ui`; Chromium install), `AGENTS.md` / `README.md` scripts; document nuxt vs api vs ui ownership (REQ-023, REQ-271)
- [x] 10.2 After the first green CI run of the new jobs, replace the GitHub ruleset required check `e2e` with `db`, `api`, and `ui` (manual; REQ-023)

## 11. Validation

- [x] 11.1 Run `pnpm test:e2e:db`, `pnpm test:e2e:api`, and `pnpm test:e2e:ui` (Chromium present) green; `pnpm test:e2e` runs all three (REQ-271)
- [x] 11.2 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:nuxt` green
- [x] 11.3 Confirm `docker ps` has no leftover `osi-time-tracker-e2e-pg` after teardown (REQ-056)
