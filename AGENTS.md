# AGENTS.md

Guidance for AI coding agents working on **OSI Time Tracker**. This complements `README.md` (human-focused) and `CODING_STANDARDS.md` (authoritative style guide). When any of these conflict, prefer `CODING_STANDARDS.md` for style and this file for workflow.

## Project Overview

OSI Time Tracker is a self-hosted, open-source personal time tracker for IT consultants who work across multiple clients and projects. Each user works in a fully isolated, single-user workspace: time is tracked locally in a `Client → Project → Task` hierarchy and pushed to remote issue trackers (OpenProject in the MVP) on demand.

- **Status:** early MVP — the platform foundation (auth, sessions, database, i18n, security, testing) exists; most domain features are still being built. See `docs/wbs.md` and `openspec/` for the roadmap.
- **Rendering:** SSR via Nuxt/Nitro.

### Tech stack

- **Frontend / SSR:** Nuxt 4, Vue 3 (`<script setup lang="ts">`), Vue Router, TypeScript.
- **UI:** Nuxt UI v4 (Tailwind v4 utilities, Lucide icons) + `@nuxtjs/color-mode`.
- **Backend / API:** Nitro server routes under `apps/web/server/api`.
- **Database:** PostgreSQL ≥ 18 (native `uuidv7()`) via Drizzle ORM + `postgres` driver.
- **Auth & security:** `nuxt-auth-utils` (sealed cookie sessions), `nuxt-security` (CSRF, rate limiting, CSP).
- **Validation:** `zod` `^4` — single source of truth for boundary types.
- **i18n:** `@nuxtjs/i18n` with `en` and `pl` catalogs kept in strict parity.
- **Testing:** Vitest 5, bundled by Vite+ (`unit`, `e2e-*`, `nuxt` projects) + `@nuxt/test-utils`.
- **Tooling:** pnpm, Vite+ (`vp`: Vite, Vitest, Oxlint, Oxfmt — configured in the root `vite.config.ts`) + leftover ESLint (Vue templates / a11y / i18n), Docker Compose. Use `pnpm` / `pnpx`, not npm / npx.

## Setup Commands

The package manager is **pnpm** (`^12`). Do not use `npm` or `yarn`. Run `pnpm install` (equivalent to `vp install`) again after pulling changes.

```bash
pnpm install            # install deps (web package postinstall runs `nuxt prepare`)
cp .env.example .env    # create env file (defaults work for local development)
docker compose up -d    # start local PostgreSQL 18 (+ PgAdmin)
pnpm db:migrate         # apply database migrations
pnpm dev                # dev server on http://localhost:3000
```

The dev compose file is infrastructure only; the dev server and migrations always run on the host. For adapter work add `--profile trackers` to also start local OpenProject (`:8090`) and Redmine (`:8091`), then run `pnpm trackers:seed` (package `apps/dev-seed`) to bootstrap the admin accounts, install the dev API keys and seed the Nordwind/Helios fixture (projects, issues, three months of time logs). Idempotent; `--dry-run` and `--reset` available.

### Required environment variables

| Variable                | Description                                                                 |
| ----------------------- | --------------------------------------------------------------------------- |
| `DATABASE_URL`          | PostgreSQL connection string (e.g. `postgres://postgres:postgres@localhost:5432/osi_time_tracker`). |
| `NUXT_SESSION_PASSWORD` | 32+ character secret used by `nuxt-auth-utils` to seal session cookies.     |

Both the Drizzle client and the migration tooling fail fast when `DATABASE_URL` is missing. Never log or commit secrets.

Optional: `CONSOLA_LEVEL` (`0` fatal … `3` info default … `5` trace) raises server log verbosity — `4`+ also logs every Drizzle statement — without a rebuild.

## Development Workflow

```bash
pnpm dev            # start dev server (hot reload) on http://localhost:3000
pnpm build          # production build (output in apps/web/.output/)
pnpm build:packages # build workspace libraries in dependency order (cached by `vp run`)
pnpm preview        # preview the production build locally
pnpm generate       # generate a static site
pnpm type-check     # builds the libraries, then type-checks every workspace package (tsc / vue-tsc / nuxt typecheck)
```

### Vite+ (`vp`)

Vite+ bundles Vite, Vitest, Oxlint and Oxfmt behind one CLI, `vp`. The root `vite.config.ts` holds the shared `lint` and `fmt` settings plus the root `test` project (anti-slop plugin tests only); each workspace package keeps its own `vitest.config.ts`, and `apps/extension` its `vite.config.ts`. Run `vp help` or `vp <command> --help` for commands; docs are in `node_modules/vite-plus/docs` or at https://viteplus.dev/guide/.

- **Built-ins vs scripts:** `vp <name>` runs a built-in (`vp lint`, `vp fmt`, `vp test`, `vp build`); `vp run <name>` runs the `package.json` script of that name, like `pnpm <name>`. They differ here — `vp dev` is not `pnpm dev`, and root `vp test` runs only the anti-slop tests — so prefer the `pnpm` scripts in this file.
- **Workspace scripts:** root scripts drive packages with `vp run --filter …`, which orders builds by workspace dependencies; `pnpm build:packages` builds the libraries with caching. `vp run -r` also selects the root package (whose scripts are the orchestrators), so root scripts filter `./packages/*` and `./apps/*` instead.
- **`vp check`** covers formatting and Oxlint only — not ESLint and not type checking. Validate with `pnpm lint`, `pnpm format:check` and `pnpm type-check`.
- **Diagnostics:** `vp toolchain` shows the bundled tool versions (`--global` ignores the local `vite-plus`); `vp why <package>` explains the dependency graph; `vp env doctor` diagnoses runtime or package-manager problems — include its output when asking for help.

### Database

The schema lives in `apps/web/server/db/schema`; migrations are committed SQL files under `apps/migrator/migrations`. `drizzle-kit` in `apps/web` writes new migrations there, and `@osi/migrator` applies them and seeds the `BOOTSTRAP_USER_*` user — locally, in the e2e harness (`runMigrations`), and in production as the Dockerfile's `migrator` image.

```bash
pnpm db:generate        # generate a new migration after editing the schema (into apps/migrator/migrations)
pnpm db:migrate         # apply pending migrations (vp run --filter @osi/migrator migrate)
docker compose --profile trackers down     # stop all dev containers (keeps data)
docker compose --profile trackers down -v  # stop and delete ALL dev volumes (db, pgAdmin, trackers)
```

Always apply migrations before the app serves traffic.

## Testing Instructions

Root commands forward to workspace packages. Web Vitest projects live in `apps/web/vitest.config.ts`; anti-slop plugin tests live under `tools/oxlint/anti-slop/test/`.

```bash
pnpm test:unit      # unit tests of every workspace package + anti-slop plugin tests
pnpm test:e2e:db    # Postgres-only (schema, migrator, server-util)
pnpm test:e2e:api   # HTTP against a booted Nuxt server
pnpm test:e2e:ui    # Playwright journeys (needs Chromium)
pnpm test:e2e       # db + api + ui
pnpm test:nuxt      # component/integration tests (apps/web/test/nuxt/*, nuxt env)
pnpm test:coverage  # Vitest v8 coverage for web unit + nuxt (exclude migrations/sql/json/warmup plugin); e2e-api Nitro coverage is collected in CI via c8, not this script. UI e2e is not in coverage.
pnpm package:check  # tracker package build/type-check/tests without Nuxt
```

- **Focus one test by name:** from the package directory, `pnpm exec vp test run -t "<test name>"`.
- **Naming:** test files use `*.spec.ts` under the matching `test/` project directory.
- **E2E layout:** `apps/web/test/e2e/api`, `apps/web/test/e2e/ui`, `apps/web/test/e2e/db`, plus `harness/` and `helpers/`. HTTP/UI specs seed a unique user per mutating test. Missing Docker/Chromium skips locally and **fails in CI**.
- **E2E runtimes:** api/ui use a production build by default (`postgres:18-alpine`). `pnpm test:e2e:db` does not build Nuxt. Faster loop: `pnpm test:e2e:dev`. Reuse `apps/web/.output` with `NUXT_TEST_SKIP_BUILD=1` (the CI `build` artifact is built with `IS_E2E=true` so login rate limits match local e2e).
- **Who owns a UI failure:** `apps/web/test/nuxt` = component + mocks; `apps/web/test/e2e/api` = HTTP contract; `apps/web/test/e2e/ui` = journey + production wiring.
- **Remote trackers:** unit + e2e mock OpenProject/Redmine (fake HTTP / `page.route`). There is **no** live integration suite against the local `trackers` profile of `docker-compose.yml`. See `docs/e2e-guideline.md` (“Follow-up: live OpenProject / Redmine e2e”).
- **E2E file names:** kebab-case (`setup-server.ts`).
- **Determinism:** prefer deterministic tests; seed any randomness. Assert against stable `data-testid` selectors, not fragile markup.
- Add or update tests alongside any code change, and keep the whole suite green.

## Code Style

Follow `CODING_STANDARDS.md` — key rules summarized here:

- **TypeScript everywhere**; Vue 3 SFCs use `<script setup lang="ts">`, ordered `<script setup>` → `<template>` → `<style scoped>`.
- **No explicit `any`.** Prefer named types. `catch (err)` is already `unknown` (omit `: unknown`). Narrow with `instanceof` on real classes (`FetchError`, `RemoteAdapterError`, `Error`) or schema parse — not `isStringValue` / `isJsonObject` wrappers. API `params` are `MessageParams`. Remaining `as` need `// SAFETY:`.
- **Formatting:** 2-space indentation, single quotes, semicolons, trailing commas on multi-line literals, ~100-char lines, UTF-8 with a trailing newline. Let Oxfmt own whitespace.
- **Naming:** `camelCase` for variables/functions, `useXxx()` composables, `PascalCase` components/types, `PascalCase` + `Dto` for response DTOs, `camelCase` + `Schema` for zod schemas, `UPPER_SNAKE_CASE` constants. Server route files are `name.<method>.ts` (e.g. `entity.post.ts`). Other source/test files are kebab-case (`setup-server.ts`).
- **i18n:** never hard-code user-facing text; use `t(...)` and keep `en`/`pl` catalogs in parity.
- **UI:** prefer existing Nuxt UI components (`UButton`, `UForm`/`UFormField`, `UTable`, `UModal`, dashboard shell) over native elements; style with Tailwind utilities and `--ui-*` tokens; icons use `i-lucide-*`; provide accessibility affordances (`aria-label`, `role`, `aria-live`) targeting WCAG 2.1 AA. Date entry uses `UInputDate` (single dates) or its `range` variant (inclusive ranges), each with a trailing `UCalendar` popover; a "jump to a date" picker with no typed field uses `UCalendar` directly. Native `<input type="date">` is not used. Clock-time entry (a single time or a start–end range) uses the shared `TimeField` component (wrapping `UInputTime`, always 24-hour hour/minute segments); a typed free-text duration (which may exceed 24 hours) uses `DurationInput` instead. Destructure `defineProps()` when props are used in script (Vue 3.5 keeps them reactive); do not assign to a `props` object.
- **Server/API:** one `defineEventHandler` per route file annotated with its response DTO; resolve the authenticated user via the shared auth helper before other work; validate bodies with `readZodBody` and query strings with `getZodQuery` (single zod schema from `shared/types`) and, on `ZodError`, throw a `422` `createError` mapped to a `{ messageKey, params }` contract (`params` may include `min`/`max`/`expected`/custom fields — never `received`). Never return rendered text — clients translate `messageKey`. Access the database only through `getDb()` (bind once per handler: `const db = getDb()`; it is a process-wide pool); emit timestamps as ISO strings.
- **Boundary types:** define each cross-boundary shape once in `shared/types`, decoupled from the DB schema; derive input types with `z.infer<typeof schema>`. Use the unified zod 4 `error` option and `z.uuid()` / `z.url()` / `z.iso.datetime()` for identifier and format fields.

### Linting & formatting

```bash
pnpm lint           # vp lint (Oxlint) then ESLint (Vue i18n + accessibility stay on ESLint)
pnpm lint:fix       # auto-fix Oxlint + ESLint issues
pnpm format         # format with vp fmt (Oxfmt)
pnpm format:check   # verify formatting
```

`pnpm lint` includes vendored anti-slop rules (`tools/oxlint/anti-slop`). Explicit `any` is an Oxlint `typescript/no-explicit-any` error; justified exceptions use `// oxlint-disable-next-line typescript/no-explicit-any -- reason`. Do not use npm or npx; one-off CLIs use `pnpx`.

**Do not modify the anti-slop plugin.** Never edit `tools/oxlint/anti-slop/` (rules, shared helpers, plugin entry) unless the developer explicitly asks for that change. Agents may add or update tests under `tools/oxlint/anti-slop/test/` and may change the `lint` block of `vite.config.ts` to enable/disable `anti-slop/*` rules only when asked. Do not “fix” anti-slop by rewriting its rules.

Run lint, format check, and the relevant test projects before opening a PR. After moving files or changing imports, re-run `pnpm lint`.

## Project Structure

```
apps/web/                    Nuxt application (app, server, shared, i18n, public, tests)
apps/extension/              Browser extension (Chrome / Edge, MV3) built with Vite
apps/dev-seed/               Seeds the local OpenProject / Redmine instances (`pnpm trackers:seed`)
apps/migrator/               SQL migrations + one-shot runner (`pnpm db:migrate`, prod `migrate` service)
packages/remote-trackers/    Provider adapters, neutral contracts, and package tests
packages/extension-protocol/ Message protocol shared by the web app and the extension
tools/                       Vendored tooling (anti-slop Oxlint plugin — do not edit rules unless asked)
docs/                        Project vision and work-breakdown notes
openspec/                    OpenSpec change/spec documents (behavioral source of truth)
vite.config.ts               Vite+ root config: shared lint/fmt settings and root test project
```

## Build and Deployment

Self-hosted via Docker. A multi-stage production `Dockerfile` and two Compose files are provided:

| File                      | Purpose                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `docker-compose.yml`      | Local development infrastructure: PostgreSQL 18 + PgAdmin, plus OpenProject and Redmine behind the `trackers` profile (seed them with `pnpm trackers:seed`). |
| `docker-compose.prod.yml` | Self-contained production stack (database, one-shot migrator, web app, PgAdmin). Trackers are the user's real instances.  |

- `docker compose --profile trackers up -d` / `down` starts and stops the local trackers alongside the dev database; `pnpm trackers:seed` makes them usable (accounts, keys, fixture). OpenProject: `http://localhost:8090`, `admin`/`admin`, API key `OPENPROJECT_DEV_API_KEY` from `.env` (HTTP Basic, user `apikey`). Redmine: `http://localhost:8091`, `admin`/`admin`, API key `REDMINE_DEV_API_KEY` (`X-Redmine-API-Key` header). Both keys are valid only on the local instances; details in `README.md`.
- Production build output lives in `apps/web/.output/`. The runtime image copies that output to `/app`.
- Migrations must be applied before serving traffic; the prod stack runs the migration step automatically. It refuses to start until `NUXT_SESSION_PASSWORD`, `POSTGRES_PASSWORD`, and `PGADMIN_DEFAULT_PASSWORD` are set.
- CI runs via GitHub Actions (`.github/workflows/ci.yml`).

## Pull Request Guidelines

- Keep one logical change per commit with a short, clear summary line.
- Update tests and i18n catalogs in the same change as the code they support.
- Before opening a PR, ensure these pass: `pnpm lint`, `pnpm format:check`, `pnpm type-check`, and the relevant test projects (`pnpm test:unit`, `pnpm test:nuxt`, and `pnpm test:e2e` when server behavior changes).
- Keep PRs focused and reasonably small.

## Additional Notes

- `openspec/` is the behavioral source of truth — consult existing specs/change proposals before implementing domain features, and align changes with them.
- The domain model is entry-first: tasks are derived automatically from time-entry titles (auto-created, matched, renamed, merged, garbage-collected); there is no separate task-management page.
- Never instantiate raw database drivers; always go through `getDb()`.
- Do not weaken, skip, or disable tests to force a green run.
- Never change the vendored anti-slop Oxlint plugin (`tools/oxlint/anti-slop/` index, rules, and shared helpers) unless the developer explicitly requests it. Do not rewrite, disable, or “fix” those rules on your own. Plugin tests live in `tools/oxlint/anti-slop/test/`.
