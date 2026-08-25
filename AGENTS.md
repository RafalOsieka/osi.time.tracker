# AGENTS.md

Guidance for AI coding agents working on **OSI Time Tracker**. This complements `README.md` (human-focused) and `CODING_STANDARDS.md` (authoritative style guide). When any of these conflict, prefer `CODING_STANDARDS.md` for style and this file for workflow.

## Project Overview

OSI Time Tracker is a self-hosted, open-source personal time tracker for IT consultants who work across multiple clients and projects. Each user works in a fully isolated, single-user workspace: time is tracked locally in a `Client → Project → Task` hierarchy and pushed to remote issue trackers (OpenProject in the MVP) on demand.

- **Status:** early MVP — the platform foundation (auth, sessions, database, i18n, security, testing) exists; most domain features are still being built. See `docs/wbs.md` and `openspec/` for the roadmap.
- **Rendering:** SSR via Nuxt/Nitro.

### Tech stack

- **Frontend / SSR:** Nuxt 4, Vue 3 (`<script setup lang="ts">`), Vue Router, TypeScript.
- **UI:** Nuxt UI v4 (Tailwind v4 utilities, Lucide icons) + `@nuxtjs/color-mode`.
- **Backend / API:** Nitro server routes under `server/api`.
- **Database:** PostgreSQL ≥ 18 (native `uuidv7()`) via Drizzle ORM + `postgres` driver.
- **Auth & security:** `nuxt-auth-utils` (sealed cookie sessions), `nuxt-security` (CSRF, rate limiting, CSP).
- **Validation:** `zod` `^4` — single source of truth for boundary types.
- **i18n:** `@nuxtjs/i18n` with `en` and `pl` catalogs kept in strict parity.
- **Testing:** Vitest 4 (`unit`, `e2e`, `nuxt` projects) + `@nuxt/test-utils`.
- **Tooling:** pnpm, Oxlint + leftover ESLint (Vue templates / a11y / i18n), Oxfmt, Docker Compose. Use `pnpm` / `pnpx`, not npm / npx.

## Setup Commands

The package manager is **pnpm** (`^11`). Do not use `npm` or `yarn`.

```bash
pnpm install            # install deps (also runs `nuxt prepare` via postinstall)
cp .env.example .env    # create env file, then set required secrets
docker compose up -d    # start local PostgreSQL 18 (+ PgAdmin)
pnpm db:migrate         # apply database migrations
pnpm dev                # dev server on http://localhost:3000
```

### Required environment variables

| Variable                | Description                                                                 |
| ----------------------- | --------------------------------------------------------------------------- |
| `DATABASE_URL`          | PostgreSQL connection string (e.g. `postgres://postgres:postgres@localhost:5432/osi_time_tracker`). |
| `NUXT_SESSION_PASSWORD` | 32+ character secret used by `nuxt-auth-utils` to seal session cookies.     |

Both the Drizzle client and the migration tooling fail fast when `DATABASE_URL` is missing. Never log or commit secrets.

## Development Workflow

```bash
pnpm dev            # start dev server (hot reload) on http://localhost:3000
pnpm build          # production build (output in .output/)
pnpm preview        # preview the production build locally
pnpm generate       # generate a static site
pnpm type-check     # nuxt typecheck (vue-tsc)
```

### Database

The schema lives in `server/db/schema`; migrations are committed SQL files under `server/db/migrations`.

```bash
pnpm db:generate        # generate a new migration after editing the schema
pnpm db:migrate         # apply pending migrations (tsx server/db/migrate.ts)
docker compose down     # stop the local database (keeps data)
docker compose down -v  # stop and delete the data volume
```

Always apply migrations before the app serves traffic.

## Testing Instructions

Vitest is configured with three projects (see `vitest.config.ts`):

```bash
pnpm test:unit      # unit tests    (test/unit/*.{test,spec}.ts, node env)
pnpm test:e2e:db    # Postgres-only (schema, migrator, server-util)
pnpm test:e2e:api   # HTTP against a booted Nuxt server
pnpm test:e2e:ui    # Playwright journeys (needs Chromium)
pnpm test:e2e       # db + api + ui
pnpm test:nuxt      # component/integration tests (test/nuxt/*, nuxt env)
pnpm test:coverage  # Vitest v8 coverage for unit + nuxt (exclude migrations/sql/json/warmup plugin); e2e-api Nitro coverage is collected in CI via c8, not this script. UI e2e is not in coverage.
```

- **Focus one test by name:** `pnpm exec vitest run -t "<test name>"`.
- **Naming:** test files use `*.spec.ts` under the matching `test/` project directory.
- **E2E layout:** `test/e2e/api`, `test/e2e/ui`, `test/e2e/db`, plus `harness/` and `helpers/`. HTTP/UI specs seed a unique user per mutating test. Missing Docker/Chromium skips locally and **fails in CI**.
- **E2E runtimes:** api/ui use a production build by default (`postgres:18-alpine`). `pnpm test:e2e:db` does not build Nuxt. Faster loop: `pnpm test:e2e:dev`. Reuse `.output` with `NUXT_TEST_SKIP_BUILD=1` (the CI `build` artifact is built with `IS_E2E=true` so login rate limits match local e2e).
- **Who owns a UI failure:** `test/nuxt` = component + mocks; `test/e2e/api` = HTTP contract; `test/e2e/ui` = journey + production wiring.
- **Remote trackers:** unit + e2e mock OpenProject/Redmine (fake HTTP / `page.route`). There is **no** live integration suite against `docker-compose.openproject.yml` / `docker-compose.redmine.yml`. See `docs/e2e-guideline.md` (“Follow-up: live OpenProject / Redmine e2e”).
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
- **UI:** prefer existing Nuxt UI components (`UButton`, `UForm`/`UFormField`, `UTable`, `UModal`, dashboard shell) over native elements; style with Tailwind utilities and `--ui-*` tokens; icons use `i-lucide-*`; provide accessibility affordances (`aria-label`, `role`, `aria-live`) targeting WCAG 2.1 AA.
- **Server/API:** one `defineEventHandler` per route file annotated with its response DTO; resolve the authenticated user via the shared auth helper before other work; validate bodies with a single zod schema and, on `ZodError`, throw a `422` `createError` mapped to a `{ messageKey, params }` contract (`params` may include `min`/`max`/`expected`/custom fields — never `received`). Never return rendered text — clients translate `messageKey`. Access the database only through the shared lazy client; emit timestamps as ISO strings.
- **Boundary types:** define each cross-boundary shape once in `shared/types`, decoupled from the DB schema; derive input types with `z.infer<typeof schema>`. Use the unified zod 4 `error` option and `z.uuid()` / `z.url()` / `z.iso.datetime()` for identifier and format fields.

### Linting & formatting

```bash
pnpm lint           # oxlint then ESLint (Vue i18n + accessibility stay on ESLint)
pnpm lint:fix       # auto-fix Oxlint + ESLint issues
pnpm format         # format with Oxfmt
pnpm format:check   # verify Oxfmt
```

`pnpm lint` includes vendored anti-slop rules (`tools/oxlint/anti-slop`). Explicit `any` is an Oxlint `typescript/no-explicit-any` error; justified exceptions use `// oxlint-disable-next-line typescript/no-explicit-any -- reason`. Do not use npm or npx; one-off CLIs use `pnpx`.

**Do not modify the anti-slop plugin.** Never edit `tools/oxlint/anti-slop/` (rules, shared helpers, plugin entry) unless the developer explicitly asks for that change. Agents may add or update tests under `test/unit/anti-slop/` and may change `.oxlintrc.json` enable/disable of `anti-slop/*` only when asked. Do not “fix” anti-slop by rewriting its rules.

Run lint, format check, and the relevant test projects before opening a PR. After moving files or changing imports, re-run `pnpm lint`.

## Project Structure

```
app/       Nuxt app source (pages, layouts, middleware, composables, plugins, utils)
server/    Nitro server: api/ handlers, db/ (Drizzle client, schema, migrations), utils, types
shared/    Cross-boundary code shared by client and server; boundary types live in shared/types
i18n/      Translation catalogs (en.json, pl.json)
test/      unit/ (including test/unit/anti-slop), e2e/, and nuxt/ test suites
tools/     Vendored tooling (anti-slop Oxlint plugin under tools/oxlint/anti-slop — do not edit unless asked)
docs/      Project vision and work-breakdown notes
openspec/  OpenSpec change/spec documents (behavioral source of truth)
```

## Build and Deployment

Self-hosted via Docker. A multi-stage production `Dockerfile` and several Compose files are provided:

| File                              | Purpose                                                                     |
| --------------------------------- | --------------------------------------------------------------------------- |
| `docker-compose.yml`              | Local development database (PostgreSQL 18) + PgAdmin.                        |
| `docker-compose.local-prod.yml`   | Build and run the production image against the dev database network.        |
| `docker-compose.standalone.yml`   | Fully self-contained stack (database, migrator, web app) for daily hosting. |
| `docker-compose.openproject.yml`  | Opt-in local OpenProject instance for remote-integration development.       |
| `docker-compose.redmine.yml`      | Opt-in local Redmine instance for remote-integration development.           |

- Production build output lives in `.output/`.
- Migrations must be applied before serving traffic; the standalone stack runs the migration step automatically.
- CI runs via GitHub Actions (`.github/workflows/ci.yml`).

## Pull Request Guidelines

- Keep one logical change per commit with a short, clear summary line.
- Update tests and i18n catalogs in the same change as the code they support.
- Before opening a PR, ensure these pass: `pnpm lint`, `pnpm format:check`, `pnpm type-check`, and the relevant test projects (`pnpm test:unit`, `pnpm test:nuxt`, and `pnpm test:e2e` when server behavior changes).
- Keep PRs focused and reasonably small.

## Additional Notes

- `openspec/` is the behavioral source of truth — consult existing specs/change proposals before implementing domain features, and align changes with them.
- The domain model is entry-first: tasks are derived automatically from time-entry titles (auto-created, matched, renamed, merged, garbage-collected); there is no separate task-management page.
- Never instantiate raw database drivers; always go through the shared lazy Drizzle client.
- Do not weaken, skip, or disable tests to force a green run.
- Never change the vendored anti-slop Oxlint plugin (`tools/oxlint/anti-slop/**`) unless the developer explicitly requests it. Do not rewrite, disable, or “fix” those rules on your own. Plugin tests live in `test/unit/anti-slop/`.
