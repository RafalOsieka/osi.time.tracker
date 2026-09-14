<div align="center">

# OSI Time Tracker

**A self-hosted, open-source personal time tracker for IT specialists who juggle multiple clients and projects.**

[![CI](https://github.com/RafalOsieka/osi.time.tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/RafalOsieka/osi.time.tracker/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![codecov](https://codecov.io/gh/RafalOsieka/osi.time.tracker/branch/main/graph/badge.svg)](https://codecov.io/gh/RafalOsieka/osi.time.tracker)

Built with [Nuxt 4](https://nuxt.com/) · [Vue 3](https://vuejs.org/) · [PrimeVue](https://primevue.org/) · [Drizzle ORM](https://orm.drizzle.team/) · [PostgreSQL](https://www.postgresql.org/)

</div>

> [!NOTE]
> **Status: early MVP.** The foundation (auth, sessions, database, i18n, security, testing) is in place, while most domain features described in the vision are still being built. See [`docs/wbs.md`](./docs/wbs.md) and [`openspec/`](./openspec/) for the roadmap and specifications.

## Overview

OSI Time Tracker gives independent IT consultants full ownership of their time data. Each user works in a fully isolated workspace — no teams, no shared data, no SaaS. You track time locally in a clean `Client → Project → Task` hierarchy, then push time entries to your clients' issue trackers **on demand**, so you never re-enter the same data twice.

It solves a recurring problem for multi-client work: your clients run different trackers (Redmine, OpenProject, …), and there is no lightweight, self-hosted tool that tracks time in a structured hierarchy, links local tasks to remote issues, and pushes entries to those systems without manual re-entry.

## Features

- **Time tracking** — start/stop a live timer or add manual entries; time entries are the primary objects you create.
- **Timer view** — your daily working page: entries listed per day, grouped by task and expandable to individual entries.
- **Entry-first data model** — tasks are derived automatically from entry titles (auto-created, matched, renamed, merged, garbage-collected); there is no separate task-management page.
- **Client & project organization** — group work under `Client → Project`, with soft-delete semantics.
- **Remote integration** — link local tasks to remote issues (OpenProject in MVP; Redmine deferred) and push a day's rounded totals with a single action.
- **Adapter model** — pluggable adapters run in the browser (`client`), on the OSI server (`server`), or through an optional Chrome/Edge extension when the hosted page cannot reach VPN-only trackers.
- **Internationalization** — English and Polish catalogs kept in strict parity, with browser-language detection.
- **Security baseline** — sealed cookie sessions, CSRF protection, rate limiting, and a Content-Security-Policy out of the box.
- **Accessibility** — WCAG 2.1 AA target, enforced through a lint gate.

## Tech stack

| Area            | Technology                                                              |
| --------------- | ----------------------------------------------------------------------- |
| Frontend / SSR  | Nuxt 4, Vue 3, Vue Router, TypeScript                                   |
| UI              | PrimeVue 4 (Aura theme), PrimeIcons                                     |
| Backend / API   | Nitro server routes (Nuxt)                                              |
| Database        | PostgreSQL ≥ 18 (native `uuidv7()`) via Drizzle ORM + `postgres` driver |
| Auth & sessions | `nuxt-auth-utils`, `nuxt-security`                                      |
| Validation      | `zod` (single source of truth for boundary types)                       |
| i18n            | `@nuxtjs/i18n` (`en`, `pl`)                                             |
| Testing         | Vitest 4 (`unit`, `e2e`, `nuxt` projects) + `@nuxt/test-utils`          |
| Tooling         | pnpm, Oxlint + leftover ESLint, Oxfmt, Docker Compose                   |

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) (latest LTS recommended)
- [pnpm](https://pnpm.io/) `^12`
- [Docker](https://www.docker.com/) (for a local PostgreSQL 18 instance)

### Installation

```bash
# 1. Install dependencies (also runs `nuxt prepare`)
pnpm install

# 2. Create your environment file (the defaults work for local development)
cp .env.example .env

# 3. Start a local PostgreSQL 18 container (plus PgAdmin)
docker compose up -d
#    ...or with local OpenProject + Redmine for adapter work, then seed them:
#    docker compose --profile trackers up -d && pnpm trackers:seed

# 4. Apply database migrations
pnpm db:migrate

# 5. Start the dev server on http://localhost:3000
pnpm dev
```

### Environment variables

A single `.env` (copied from `.env.example`) feeds the host tooling and both Compose files. The example is grouped by who reads each variable:

| Variable                                           | Read by                       | Description                                                                                           |
| -------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                     | `pnpm dev`, `pnpm db:migrate` | PostgreSQL connection string, e.g. `postgres://postgres:postgres@localhost:5432/osi_time_tracker`.    |
| `NUXT_SESSION_PASSWORD`                            | `pnpm dev`, prod compose      | 32+ character secret used by `nuxt-auth-utils` to seal session cookies. Required in prod.             |
| `BOOTSTRAP_USER_EMAIL` / `BOOTSTRAP_USER_PASSWORD` | migrator (host and prod)      | Optional; seeds the first user if it does not exist.                                                  |
| `POSTGRES_USER` / `POSTGRES_DB`                    | dev + prod compose            | Database overrides; defaults match `DATABASE_URL`.                                                    |
| `POSTGRES_PORT`                                    | dev compose                   | Published dev database port (default `5432`); prod never publishes the database.                      |
| `POSTGRES_PASSWORD`                                | dev + prod compose            | Defaults to `postgres` in dev; **required** in prod.                                                  |
| `PGADMIN_DEFAULT_EMAIL` / `PGADMIN_PORT`           | dev + prod compose            | pgAdmin overrides.                                                                                    |
| `PGADMIN_DEFAULT_PASSWORD`                         | dev + prod compose            | Defaults to `admin` in dev; **required** in prod.                                                     |
| `PORT`                                             | prod compose                  | Published app port (default `3000`).                                                                  |
| `CONSOLA_LEVEL`                                    | `pnpm dev`, prod compose      | Optional server log verbosity: `0` fatal … `3` info (default) … `5` trace. See Troubleshooting below. |
| `REDMINE_DEV_API_KEY` / `OPENPROJECT_DEV_API_KEY`  | dev compose + `trackers:seed` | Fixed API keys installed on the **local** trackers; paste them into the OSI tracker form.             |
| `REDMINE_ADMIN_PASSWORD`                           | dev compose (`trackers`)      | Local Redmine `admin` password (default `admin`), set on every boot.                                  |
| `OPENPROJECT_*` / `REDMINE_*`                      | dev compose (`trackers`)      | Other local tracker overrides (ports, secrets); never used in prod.                                   |

> [!IMPORTANT]
> Both the Drizzle client and the migration tooling fail fast when `DATABASE_URL` is missing, and the production stack refuses to start until its required secrets are set. Never log or commit these secrets.

## Development

```bash
pnpm dev            # start the dev server (http://localhost:3000)
pnpm build          # production build (output in apps/web/.output/)
pnpm preview        # preview the production build locally
pnpm generate       # generate a static site

pnpm lint           # oxlint then ESLint (Vue i18n + accessibility stay on ESLint)
pnpm lint:fix       # auto-fix Oxlint + ESLint issues
pnpm format         # format with Oxfmt
pnpm format:check   # verify Oxfmt
```

### Database

The schema lives in `apps/web/server/db/schema` and migrations are committed SQL files under `apps/web/server/db/migrations`.

```bash
pnpm db:generate    # generate a new migration after editing the schema
pnpm db:migrate     # apply pending migrations
docker compose --profile trackers down     # stop all dev containers (keeps data)
docker compose --profile trackers down -v  # stop and delete ALL dev volumes (db, pgAdmin, trackers)
```

To wipe a single service, remove only its named volume (`docker volume ls` / `docker volume rm`).

## Testing

Vitest is configured with three projects:

```bash
pnpm test:unit      # tracker/protocol/extension unit + web unit + anti-slop plugin tests
pnpm test:e2e:db    # Postgres schema/migrator/server-util tests
pnpm test:e2e:api   # HTTP tests against a booted Nuxt server
pnpm test:e2e:ui    # Playwright journeys (needs Chromium)
pnpm test:e2e       # db + api + ui
pnpm test:nuxt      # component/integration tests (test/nuxt, nuxt env)
pnpm test:coverage  # coverage for unit + nuxt projects
pnpm test:extension # build extension, run unit + unpacked browser tests (needs Chromium)
```

Focus on a single test by name:

```bash
pnpm exec vitest run -t "<test name>"
```

> [!TIP]
> API and UI e2e tests run against a production build by default and require PostgreSQL (the harness uses `postgres:18-alpine`). `pnpm test:e2e:db` does not build Nuxt. For faster API/UI iteration, use `NUXT_TEST_DEV=1` (`pnpm test:e2e:dev`). Set `NUXT_TEST_SKIP_BUILD=1` to reuse an existing `apps/web/.output`. Locally, missing Docker or Chromium skips those suites; in CI a missing prerequisite fails the job.

## Deployment

OSI Time Tracker is designed to be self-hosted via Docker. A multi-stage production `Dockerfile` and two Compose files are provided:

| File                      | Purpose                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `docker-compose.yml`      | Local development infrastructure: PostgreSQL 18 + pgAdmin, plus OpenProject and Redmine behind the `trackers` profile.    |
| `docker-compose.prod.yml` | Self-contained production stack (database, one-shot migrator, web app, pgAdmin). Trackers are your real remote instances. |

### Production (self-hosted)

```bash
cp .env.example .env
# set the "Production compose" section: POSTGRES_PASSWORD, PGADMIN_DEFAULT_PASSWORD,
# and replace NUXT_SESSION_PASSWORD / BOOTSTRAP_USER_PASSWORD with real secrets
docker compose -f docker-compose.prod.yml up -d --build   # builds the image, migrates, starts
docker compose -f docker-compose.prod.yml down            # stop (keeps volumes)
docker compose -f docker-compose.prod.yml down -v         # stop and delete prod volumes
```

The stack refuses to start until the required secrets are set. Migrations run in a one-shot `migrate` container before the app accepts traffic. The app is published on `PORT` (default `3000`) and pgAdmin on `PGADMIN_PORT` (default `8080`); the database port is not published.

> [!NOTE]
> Upgrading from the former `docker-compose.standalone.yml`: the stack now uses the fixed project name `osi-time-tracker-prod`, so its volumes are `osi-time-tracker-prod_pg-osi-time-tracker-standalone` and `osi-time-tracker-prod_pgadmin-osi-time-tracker-standalone`. Your existing data lives under `<clone-directory>_pg-osi-time-tracker-standalone`; copy it across once (e.g. `docker run --rm -v OLD:/from -v NEW:/to alpine cp -a /from/. /to/`) before the first `up`.

#### Troubleshooting: reading container logs

`docker compose -f docker-compose.prod.yml logs -f app` shows every failing request as one line: `[METHOD] /path -> status` plus the response's `messageKey` when there is one (e.g. `[POST] /api/trackers/.../import -> 422 error.remoteLogImportProjectNotBound`). A successful request never logs anything, so the log stays quiet in normal operation.

For more detail — including every SQL statement Drizzle executes — set `CONSOLA_LEVEL=4` (`debug`) in `.env` and restart just the app container:

```bash
docker compose -f docker-compose.prod.yml up -d app
```

No rebuild or migration re-run is needed; unset it (or set it back to `3`) and restart `app` again to return to normal verbosity.

### Local trackers (development only)

Two commands turn the local trackers into a ready-to-use environment. **Never use them in production.**

```bash
docker compose --profile trackers up -d   # OpenProject :8090 + Redmine :8091 (first boot ~2 min)
pnpm trackers:seed                        # bootstrap accounts + seed the fixture (~30 s)
pnpm trackers:seed --dry-run              # show what would be created, write nothing
pnpm trackers:seed --reset                # delete fixture time logs first, then re-seed
docker compose --profile trackers down    # stop (keeps volumes)
docker compose --profile trackers down -v # wipe EVERY dev volume, including the app database
```

`pnpm trackers:seed` waits for both healthchecks, makes the `admin` accounts usable without any UI step (Redmine does this on boot; the OpenProject API token is installed through `rails runner`), removes OpenProject's stock demo projects, and seeds the fixture. It is idempotent: re-running creates only what is missing and never touches projects, issues or logs you made by hand. It ends by printing what to paste into the OSI tracker form:

| Tracker     | URL                     | Login           | API key                                               |
| ----------- | ----------------------- | --------------- | ----------------------------------------------------- |
| Redmine     | `http://localhost:8091` | `admin`/`admin` | `REDMINE_DEV_API_KEY` (sent as `X-Redmine-API-Key`)   |
| OpenProject | `http://localhost:8090` | `admin`/`admin` | `OPENPROJECT_DEV_API_KEY` (HTTP Basic, user `apikey`) |

**What gets seeded.** One consultant, two clients: **Nordwind Logistics** on Redmine (`fleet-platform` → `dispatch`/`telemetry` → four leaf projects, plus `warehouse-scanner` and `internal-it`) and **Helios Energy** on OpenProject (`solar-portal` → `customer-app`/`gateway` → four leaf projects, plus `grid-analytics` and `helios-internal`). Every leaf and sibling project has 6–8 issues (older ones closed, two never logged), and the `admin` account has three months of weekday time logs: Monday/Tuesday on Nordwind, Wednesday/Thursday on Helios, Friday on both, with one holiday week. Runs in the same calendar week produce identical logs; on a new week the window slides.

**Trying import.** In OSI add both trackers with the keys above, create a Project scoped to `fleet-platform` (Redmine) and one scoped to `solar-portal` (OpenProject), then use **Import history** for the last three months. Every routing rule shows up: the same note across days reuses one Task, two notes on one issue become sibling Tasks, a blank note becomes the Task `empty`, and the `internal-it` / `helios-internal` logs are reported as unmatched until you scope a Project to them.

### VPN reachability

The OSI server does not contact your tracker. Direct browser access and the extension both require **this device** to reach the tracker (publicly or over VPN). Direct browser access additionally requires the tracker to allow cross-origin requests from the OSI origin; disable it (require the extension) when CORS would otherwise block those requests. If your tracker is only on a VPN, connect the browser (or the desktop that hosts the extension) to that VPN.

### Browser extension (Chrome / Edge)

Turn off **Direct browser connection allowed** when the hosted website cannot call your tracker (no CORS) but your desktop browser can. Transport is then always the extension; there is no automatic fallback. The production web image does **not** include the extension; each person loads it unpacked locally.

```bash
pnpm --filter @osi/remote-trackers build
pnpm --filter @osi/extension-protocol build
pnpm --filter @osi/extension build
```

Load `apps/extension/dist` as an unpacked extension in Chrome or Edge (`chrome://extensions` → Developer mode → Load unpacked). After rebuilding, click **Reload** on the extension card, then refresh the OSI tab.

In the extension options page, approve:

1. The OSI website origin (for example `https://time.example.com` or `http://localhost:3000`).
2. Each tracker base URL (OpenProject or Redmine). HTTP destinations show a credential-risk warning.

If the website reports an incompatible extension, rebuild/reload the extension and refresh the page. Workplace policy that blocks unpacked extensions or host-permission prompts cannot be bypassed. Tracker API secrets stay in the website's `localStorage` and are sent only for the current operation; they are never stored in the extension.

To stop using the extension, turn **Direct browser connection allowed** back on (if the tracker permits it) and remove the unpacked extension. Local time entries are unchanged.

Isolated fake trackers for development/tests live in `apps/extension/test/browser/harness`; do not point the unpacked extension at live production trackers from CI.

## Project structure

```
apps/web/                 Nuxt application (app, server, shared, i18n, public, tests)
apps/extension/           Optional Chrome/Edge companion (unpacked load)
packages/remote-trackers/ Provider adapters and neutral contracts
packages/extension-protocol/ Versioned website/extension envelopes
tools/                    Vendored tooling (anti-slop Oxlint plugin and its tests)
docs/                     Project vision and work-breakdown notes
openspec/                 OpenSpec change/spec documents (behavioral source of truth)
```

## Documentation

- [`docs/vision.md`](./docs/vision.md) — product vision, domain model, and non-functional goals.
- [`docs/wbs.md`](./docs/wbs.md) — work-breakdown structure and roadmap.
- [`openspec/`](./openspec/) — specifications and active change proposals.
- [`AGENTS.md`](./AGENTS.md) — conventions and workflow for automated agents.
- [`CODING_STANDARDS.md`](./CODING_STANDARDS.md) — code style and standards.
