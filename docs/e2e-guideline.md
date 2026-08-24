# E2E Troubleshooting Guideline

Notes for recurring issues hit while writing/running `test/e2e` specs, and how to resolve them
without wasting time re-diagnosing the same root causes.

## Layout and ownership

| Directory       | Runtime                      | Owns                                          |
| --------------- | ---------------------------- | --------------------------------------------- |
| `test/e2e/api/` | HTTP + Nuxt + Postgres       | Server contracts (`server/api`)               |
| `test/e2e/ui/`  | Playwright + Nuxt + Postgres | Journeys, SSR, production wiring              |
| `test/e2e/db/`  | Postgres only                | Migrator, schema, historical SQL, server-util |
| `test/nuxt/`    | happy-dom, mocked fetch      | Component behavior given data X               |

Scripts: `pnpm test:e2e:db`, `pnpm test:e2e:api`, `pnpm test:e2e:ui`. `NUXT_TEST_SKIP_BUILD=1` reuses `.output` and fails if it is missing. In CI, missing Docker or Chromium **fails** (does not skip).

E2E TypeScript files use kebab-case names (`setup-server.ts`, `helper-isolation.spec.ts`). Function names stay `camelCase` (`setupServer()`).

## Coverage tools (`c8` vs Vitest v8)

`pnpm test:coverage` uses Vitest's `@vitest/coverage-v8` on the **test process** (unit + nuxt). API e2e does not run handlers in that process — it `fetch()`es a child Nitro server — so those hits never appear in Vitest coverage.

`c8` is only the converter for that child process: Node writes raw V8 JSON when `NODE_V8_COVERAGE` is set, and `test/e2e/harness/report-e2e-coverage.ts` runs `c8 report` to turn that dump into `lcov` for Codecov flag `e2e-api`. It is not a second test runner.

## Follow-up: live OpenProject / Redmine e2e (not done)

Current tests never talk to a real tracker:

| Layer       | What exists today                                                          | What it is not          |
| ----------- | -------------------------------------------------------------------------- | ----------------------- |
| Unit        | `openproject-*` / `redmine-*` adapter and client tests with mocked `fetch` | No network              |
| API e2e     | `remote-*-proxy.spec.ts` against an in-process fake HTTP server            | Not OpenProject/Redmine |
| UI e2e      | Playwright `page.route` stubs of `/api/v3/...`                             | Not the real API        |
| Dev compose | `docker-compose.openproject.yml`, `docker-compose.redmine.yml`             | Manual only; not in CI  |

There is no round-trip: create/search a real work package or issue, export time, and assert the remote time log. That needs a separate change (suggested: opt-in `test:e2e:trackers` against the compose stacks, skip unless an env flag is set, one smoke per provider for search, lookup, activities, and export). Do not fold it into the default `api`/`ui` jobs — those stacks are slow and stateful.

## 1. Stale Nuxt build cache after adding new `shared/` modules

**Symptom:** `pnpm exec vitest run --project e2e-ui` fails during global setup with a `RollupError:
Could not resolve "../shared/utils/<new-file>.ts"` coming from a stale chunk under
`node_modules/.cache/nuxt/.nuxt/dist/server/_nuxt/...js`. `pnpm build` fails the same way when run
directly.

**Cause:** `test/e2e/harness/global-setup.ts` runs `pnpm build` before api/ui suites
(unless `NUXT_TEST_DEV=1`). When new files are added under `shared/` mid-session, Nitro's Rollup
build can leave behind a cached chunk graph that still points at the old module layout, producing
resolution errors that look like a real code problem but are just a dirty cache.

**Remediation:**

1. Clear the Nuxt build cache and output before rebuilding: remove `node_modules/.cache/nuxt` and
   `.output`.
2. Run `pnpm exec nuxi cleanup` then `pnpm exec nuxt prepare` to regenerate `.nuxt` types cleanly.
3. Re-run `pnpm build`. If it still fails with a `RollupError` referencing a file that clearly
   exists on disk, treat it as a caching issue first, not a code issue — repeat the cleanup once
   more before assuming a real regression.

## 2. Page-scoped route chunk breaks relative imports into `shared/`

**Symptom:** Same `RollupError: Could not resolve "../shared/..."` as above, but reproducible even
against a clean build — only for modules imported exclusively from one page's own component
(e.g. only `sync/[date].vue` imports a given `shared/` helper).

**Cause:** When a `shared/` module is referenced from only a single route's own chunk, Nitro's
production chunking can isolate that module into the page's chunk and miscompute its relative
import path back into `shared/` (the path assumes the module still lives next to the app's stable
chunks). Modules that are already referenced from multiple chunks (shared across pages/components)
don't hit this, because they get promoted into the common/stable chunk instead.

**Remediation options, in order of preference:**

- Reference the new `shared/` module from at least one more already-multi-referenced chunk (e.g. a
  composable or component used elsewhere), so the bundler naturally promotes it to the stable
  chunk. This needs no extra file.
- If there's no natural second call site yet, add a trivial no-op reference from an app-wide
  plugin, as done in `app/plugins/shared-chunk-warmup.ts`. This forces the bundler to place the
  module in the stable chunk without changing runtime behavior. Treat this as a last-resort
  workaround, not a pattern to reach for by default — prefer a real second usage site once one
  exists naturally, and revisit/remove the warmup plugin if it does.
- Do not "fix" this by weakening or skipping the affected e2e test, and don't downgrade to
  `NUXT_TEST_DEV=1` as a permanent workaround — that only hides the production-build-only bug.

## 3. Directly comparing raw diagnostic dumps instead of existing test patterns

**Symptom:** Debugging a single failing/hanging e2e spec by capturing full verbose output to a
file and grepping through hundreds of lines (`*> out.txt` + `Select-String`), burning time and
tokens without converging.

**Cause:** Treating the failure as a black box, rather than first comparing the new spec's
structure/timing/selectors against sibling specs that already work (e.g. `timer-view-ui.spec.ts`,
`remote-issue-proxy.spec.ts`) for the same kind of flow (login, `waitForSelector` before
`waitForFunction`, seeding order, etc.). Most of these UI e2e failures for this change traced back
to the build-cache issues in sections 1–2 above, not to anything unusual in the new spec itself.

**Remediation:**

- Before dumping full output, diff the new spec against an existing, passing spec of the same
  shape (login helper, seeding helpers, `data-testid` waits) to rule out a self-inflicted pattern
  deviation.
- Only capture/redirect full verbose output to a file as a last resort, and grep it for
  `Error|Failed Tests|✓|×` rather than paging through everything.
- Re-run the single failing test in isolation (`-t "<name>"`) after a clean build before assuming
  the test logic itself is wrong — a hanging `waitForFunction` was, in this case, a downstream
  symptom of the stale-build issues above, not a selector/timing bug.
