<div align="center">

# OSI Time Tracker

**A self-hosted, open-source personal time tracker for IT specialists who juggle multiple clients and projects.**

[![CI](https://github.com/RafalOsieka/osi.time.tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/RafalOsieka/osi.time.tracker/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

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
- **Adapter model** — pluggable adapters run either browser-side (for trackers behind a VPN) or server-side; MVP ships the client-side OpenProject adapter.
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
| Tooling         | pnpm, ESLint, Prettier, Docker Compose                                  |

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) (latest LTS recommended)
- [pnpm](https://pnpm.io/) `^11`
- [Docker](https://www.docker.com/) (for a local PostgreSQL 18 instance)

### Installation

```bash
# 1. Install dependencies (also runs `nuxt prepare`)
pnpm install

# 2. Create your environment file and set the required secrets
cp .env.example .env

# 3. Start a local PostgreSQL 18 container (plus PgAdmin)
docker compose up -d

# 4. Apply database migrations
pnpm db:migrate

# 5. Start the dev server on http://localhost:3000
pnpm dev
```

### Environment variables

| Variable                | Description                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | PostgreSQL connection string, e.g. `postgres://postgres:postgres@localhost:5432/osi_time_tracker`. |
| `NUXT_SESSION_PASSWORD` | 32+ character secret used by `nuxt-auth-utils` to seal session cookies.                            |

> [!IMPORTANT]
> Both the Drizzle client and the migration tooling fail fast when `DATABASE_URL` is missing. Never log or commit these secrets.

## Development

```bash
pnpm dev            # start the dev server (http://localhost:3000)
pnpm build          # production build (output in .output/)
pnpm preview        # preview the production build locally
pnpm generate       # generate a static site

pnpm lint           # ESLint (includes Vue i18n + accessibility rules)
pnpm lint:fix       # auto-fix lint issues
pnpm format         # format with Prettier
pnpm format:check   # verify formatting
```

### Database

The schema lives in `server/db/schema` and migrations are committed SQL files under `server/db/migrations`.

```bash
pnpm db:generate    # generate a new migration after editing the schema
pnpm db:migrate     # apply pending migrations
docker compose down # stop the local database (keeps data)
docker compose down -v  # stop and delete the data volume
```

## Testing

Vitest is configured with three projects:

```bash
pnpm test:unit      # unit tests   (test/unit/*.{test,spec}.ts, node env)
pnpm test:e2e       # e2e tests    (test/e2e/*.{test,spec}.ts, node env)
pnpm test:nuxt      # component/integration tests (test/nuxt, nuxt env)
pnpm test:coverage  # coverage for unit + nuxt projects
```

Focus on a single test by name:

```bash
pnpm exec vitest run -t "<test name>"
```

> [!TIP]
> E2E tests run against a production build by default and require a running PostgreSQL (the harness uses `postgres:18-alpine`). For faster iteration, run them against the dev server with `NUXT_TEST_DEV=1` (`pnpm test:e2e:dev`).

## Deployment

OSI Time Tracker is designed to be self-hosted via Docker. A multi-stage production `Dockerfile` and several Compose files are provided:

| File                             | Purpose                                                                     |
| -------------------------------- | --------------------------------------------------------------------------- |
| `docker-compose.yml`             | Local development database (PostgreSQL 18) + PgAdmin.                       |
| `docker-compose.local-prod.yml`  | Build and run the production image against the dev database network.        |
| `docker-compose.standalone.yml`  | Fully self-contained stack (database, migrator, web app) for daily hosting. |
| `docker-compose.openproject.yml` | Opt-in local OpenProject instance for remote-integration development.       |

Database migrations (`pnpm db:migrate`) must be applied before the app serves traffic. The standalone stack runs the migration step automatically.

## Project structure

```
app/       Nuxt app source (pages, layouts, middleware, composables, plugins, utils)
server/    Nitro server: api/ handlers, db/ (Drizzle client, schema, migrations), utils, types
shared/    Cross-boundary code shared by client and server; boundary types live in shared/types
i18n/      Translation catalogs (en.json, pl.json)
test/      unit/, e2e/, and nuxt/ test suites
docs/      Project vision and work-breakdown notes
openspec/  OpenSpec change/spec documents (behavioral source of truth)
```

## Documentation

- [`docs/vision.md`](./docs/vision.md) — product vision, domain model, and non-functional goals.
- [`docs/wbs.md`](./docs/wbs.md) — work-breakdown structure and roadmap.
- [`openspec/`](./openspec/) — specifications and active change proposals.
- [`AGENTS.md`](./AGENTS.md) — conventions and workflow for automated agents.
- [`CODING_STANDARDS.md`](./CODING_STANDARDS.md) — code style and standards.
