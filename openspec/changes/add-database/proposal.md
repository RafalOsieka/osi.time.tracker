## Why

The repo is currently pure Nuxt 4 scaffolding with no persistence layer, yet every planned domain feature (Clients, Projects, Tasks, TimeEntries) needs server-side storage with strict per-user isolation. Before any domain feature can be built, the project must commit to a concrete data-access layer and a migration workflow that runs unattended under Docker Compose.

## What Changes

- Adopt **Drizzle** as the data-access layer: `drizzle-orm` runtime + `postgres` driver + `drizzle-kit` (dev) for the planned PostgreSQL database.
- Establish a **migration strategy**: `drizzle-kit generate` produces SQL migration files committed to the repo; they are applied at runtime via the `drizzle-orm` migrator.
- Add a server-side DB client module (Nitro context) and `db:generate` / `db:migrate` package scripts.
- Define how migrations execute under Docker Compose (a dedicated migrate step on `docker compose up`, before the app serves traffic).
- **Verification only:** generate a throwaway fake table migration to prove `generate` → `migrate` works end-to-end; it is removed before domain schema work begins.

## Capabilities

### New Capabilities
- `data-persistence`: Selection of Drizzle as the ORM/query layer, the committed-SQL migration workflow, the server-side DB client, and how migrations run unattended in Docker. Does **not** define the domain schema (tables/columns) — that is deferred to later changes.

### Modified Capabilities
<!-- None; no existing specs define database behavior yet. -->

## Non-goals

- Defining the domain schema (User/Client/Project/Task/TimeEntry tables and columns).
- Credential encryption-at-rest, Row-Level Security, or per-user isolation enforcement (separate later changes).
- Authoring the full Docker Compose stack; only the migration execution model is decided here.
- Choosing ID strategy (serial vs UUID) or an offline/sync engine.

## Impact

- **Dependencies:** adds `drizzle-orm`, `postgres`, `drizzle-kit`.
- **Config:** new `drizzle.config.ts`; `DATABASE_URL` environment variable.
- **Code:** new `server/db/` client module; new `server/db/migrations/` SQL files; `package.json` scripts.
- **Deployment:** Docker Compose gains a Postgres service and a migrate step (planned, defined here, wired when compose is added).
- **Out of band:** does not touch UI, auth, or domain logic.
