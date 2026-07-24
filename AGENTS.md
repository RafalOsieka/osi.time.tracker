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
- **Validation:** `zod` — single source of truth for boundary types.
- **i18n:** `@nuxtjs/i18n` with `en` and `pl` catalogs kept in strict parity.
- **Testing:** Vitest 4 (`unit`, `e2e`, `nuxt` projects) + `@nuxt/test-utils`.
- **Tooling:** pnpm, ESLint, Prettier, Docker Compose.

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
pnpm test:e2e       # e2e tests     (test/e2e/*.{test,spec}.ts, node env)
pnpm test:nuxt      # component/integration tests (test/nuxt/*, nuxt env)
pnpm test:coverage  # coverage for the unit + nuxt projects
```

- **Focus one test by name:** `pnpm exec vitest run -t "<test name>"`.
- **Naming:** test files use `*.spec.ts` under the matching `test/` project directory.
- **E2E:** run against a production build by default and require a running PostgreSQL (the harness uses `postgres:18-alpine`). For faster iteration use `pnpm test:e2e:dev` (`NUXT_TEST_DEV=1`).
- **Determinism:** prefer deterministic tests; seed any randomness. Assert against stable `data-testid` selectors, not fragile markup.
- Add or update tests alongside any code change, and keep the whole suite green.

## Code Style

Follow `CODING_STANDARDS.md` — key rules summarized here:

- **TypeScript everywhere**; Vue 3 SFCs use `<script setup lang="ts">`, ordered `<script setup>` → `<template>` → `<style scoped>`.
- **No explicit `any`.** Prefer `unknown` and narrow. If unavoidable, disable the rule on a single line with a justifying comment.
- **Formatting:** 2-space indentation, single quotes, semicolons, trailing commas on multi-line literals, ~100-char lines, UTF-8 with a trailing newline. Let Prettier/ESLint own whitespace.
- **Naming:** `camelCase` for variables/functions, `useXxx()` composables, `PascalCase` components/types, `PascalCase` + `Dto` for response DTOs, `camelCase` + `Schema` for zod schemas, `UPPER_SNAKE_CASE` constants. Server route files are `name.<method>.ts` (e.g. `entity.post.ts`).
- **i18n:** never hard-code user-facing text; use `t(...)` and keep `en`/`pl` catalogs in parity.
- **UI:** prefer existing Nuxt UI components (`UButton`, `UForm`/`UFormField`, `UTable`, `UModal`, dashboard shell) over native elements; style with Tailwind utilities and `--ui-*` tokens; icons use `i-lucide-*`; provide accessibility affordances (`aria-label`, `role`, `aria-live`) targeting WCAG 2.1 AA.
- **Server/API:** one `defineEventHandler` per route file annotated with its response DTO; resolve the authenticated user via the shared auth helper before other work; validate bodies with a single zod schema and, on `ZodError`, throw a `422` `createError` mapped to a `{ messageKey, params }` contract. Never return rendered text — clients translate `messageKey`. Access the database only through the shared lazy client; emit timestamps as ISO strings.
- **Boundary types:** define each cross-boundary shape once in `shared/types`, decoupled from the DB schema; derive input types with `z.infer<typeof schema>`.

### Linting & formatting

```bash
pnpm lint           # ESLint (includes Vue i18n + accessibility rules)
pnpm lint:fix       # auto-fix lint issues
pnpm format         # format with Prettier
pnpm format:check   # verify formatting
```

Run lint, format check, and the relevant test projects before opening a PR. After moving files or changing imports, re-run `pnpm lint`.

## Project Structure

```
app/       Nuxt app source (pages, layouts, middleware, composables, plugins, utils)
server/    Nitro server: api/ handlers, db/ (Drizzle client, schema, migrations), utils, types
shared/    Cross-boundary code shared by client and server; boundary types live in shared/types
i18n/      Translation catalogs (en.json, pl.json)
test/      unit/, e2e/, and nuxt/ test suites
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
