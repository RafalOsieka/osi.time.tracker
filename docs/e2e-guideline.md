# E2E guideline

How the end-to-end suites under `apps/web/test/e2e` are organized and run, and how to resolve the problems that keep coming back. The harness contract itself is specified in `openspec/specs/platform-e2e-harness`.

## Suites

| Directory                | Vitest project | Runtime                      | Owns                                           |
| ------------------------ | -------------- | ---------------------------- | ---------------------------------------------- |
| `apps/web/test/e2e/db/`  | `e2e-db`       | Postgres only                | Migrator, schema, historical SQL, server utils |
| `apps/web/test/e2e/api/` | `e2e-api`      | HTTP + Nuxt + Postgres       | Server contracts (`apps/web/server/api`)       |
| `apps/web/test/e2e/ui/`  | `e2e-ui`       | Playwright + Nuxt + Postgres | Journeys, SSR, production wiring               |
| `apps/web/test/nuxt/`    | `nuxt`         | happy-dom, mocked fetch      | Component behavior for given data (not e2e)    |

Shared code lives in `apps/web/test/e2e/harness/` (global setup, database provisioning, server boot, coverage) and `apps/web/test/e2e/helpers/` (seeding, login and similar).

When a UI behavior fails, pick the suite by what is wrong: rendering for given data belongs to `nuxt`, the HTTP contract to `api`, the end-to-end wiring to `ui`.

## Running the suites

```bash
pnpm test:e2e:db    # no Nuxt build
pnpm test:e2e:api   # production build, then HTTP specs
pnpm test:e2e:ui    # production build, then Playwright (needs Chromium)
pnpm test:e2e       # all three
pnpm test:e2e:dev   # api + ui against the Nuxt dev server (NUXT_TEST_DEV=1), faster loop
```

Each spec file gets its own database cloned from one pre-migrated template (`postgres:18-alpine`), and mutating HTTP/UI specs seed a unique user per test.

### Build modes

The api/ui global setup (`harness/global-setup.ts`) decides how to get a server:

| Environment              | Behavior                                           |
| ------------------------ | -------------------------------------------------- |
| default                  | Sets `IS_E2E=true` and runs `pnpm -w build`.       |
| `NUXT_TEST_SKIP_BUILD=1` | Reuses `apps/web/.output`; fails if it is missing. |
| `NUXT_TEST_DEV=1`        | No build; boots the dev server.                    |

`IS_E2E` must be set **at build time**: nuxt-security's login and global rate limits are compiled into `routeRules`. A build made without it and reused under skip-build produces CI-only 429s, missing CSRF meta tags, login timeouts and 401s.

### CI

- The `build` job builds the e2e artifact (not the production image) with `IS_E2E=true` and `NUXT_BUILD_SOURCEMAP=1`; `api` and `ui` download it and run with skip-build.
- `db` does not need the build.
- Missing Docker or Chromium **fails** the job in CI; locally it skips the suite.

## Conventions

- Spec files are `*.spec.ts`; e2e TypeScript files use kebab-case names (`setup-server.ts`, `helper-isolation.spec.ts`), functions stay `camelCase` (`setupServer()`).
- Wait on and assert against `data-testid` selectors, not markup.
- Before writing a new spec, copy the shape of a passing sibling of the same kind (login helper, seeding order, waits), e.g. `ui/timer-view-ui.spec.ts`.
- Trackers are never real: api specs assert server contracts, ui specs stub tracker HTTP with `page.route`.

## Coverage

- `pnpm test:coverage` measures only the in-process unit + nuxt projects with `@vitest/coverage-v8`.
- API e2e runs handlers in a child Nitro process, so Vitest cannot see those hits. In CI, Node writes raw V8 data (`NODE_V8_COVERAGE`) and `harness/report-e2e-coverage.ts` runs `c8 report` to turn it into lcov for the Codecov flag `e2e-api`. `c8` is a converter here, not a test runner.
- Do not pass the Vitest include/exclude globs to `c8 report`: it filters compiled `.output` chunks before sourcemap remapping, so `--include app/**` or `--exclude .output/**` drops the whole Nitro dump. The converter refuses an lcov without first-party `app/`, `server/` or `shared/` paths.
- UI e2e (Playwright) coverage is not collected.

## Troubleshooting

### `RollupError: Could not resolve "../shared/..."` after adding a `shared/` module

**Cause:** a stale Nuxt build cache that still points at the old module layout. It looks like a code problem but is not.

**Fix:**

1. Remove `node_modules/.cache/nuxt` and `.output` in `apps/web`.
2. Run `pnpm exec nuxi cleanup`, then `pnpm exec nuxt prepare`.
3. Re-run `pnpm build`. If the error still names a file that exists, clean once more before assuming a regression.

### The same `RollupError`, even on a clean build

**Cause:** the `shared/` module is imported from only one page's own chunk (e.g. only `sync/[date].vue`). Nitro's production chunking isolates it into that page chunk and miscomputes its relative import back into `shared/`. Modules referenced from several chunks are promoted to the stable chunk and do not hit this.

**Fix, in order of preference:**

1. Reference the module from a second, already shared chunk (a composable or component used elsewhere).
2. If no natural second call site exists yet, add a no-op reference in `app/plugins/shared-chunk-warmup.ts`. This is a last resort; remove the entry once a real second usage exists.

Do not weaken or skip the failing test, and do not settle on `NUXT_TEST_DEV=1`; that only hides a production-build bug.

### A single spec fails or hangs and the output is huge

**Cause:** usually a deviation from the patterns of passing specs, or a stale build (see above), not the new test logic.

**Fix:**

1. Diff the spec against a passing sibling of the same shape (login helper, seeding helpers, `data-testid` waits).
2. Rebuild cleanly and re-run only that test with `-t "<name>"`.
3. Only then capture full output to a file, and search it for `Error|Failed Tests|✓|×` instead of reading it end to end.

## Known gaps

No suite talks to a real OpenProject or Redmine:

| Layer   | What exists                                                                                     |
| ------- | ----------------------------------------------------------------------------------------------- |
| Unit    | Adapter and client tests in `packages/remote-trackers` with mocked `fetch`                      |
| API e2e | Tracker, sync and export contracts; removed `/api/remote/*` routes assert 404                   |
| UI e2e  | Playwright `page.route` stubs of the tracker APIs                                               |
| Manual  | Local trackers from [`development.md`](./development.md#local-trackers-openproject-and-redmine) |

A round trip (search a real issue, export time, assert the remote log) would need its own opt-in suite, e.g. `test:e2e:trackers` gated by an env flag with one smoke test per provider. Keep it out of the default `api`/`ui` jobs: those stacks are slow and stateful.
