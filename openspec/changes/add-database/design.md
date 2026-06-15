## Context

The repo is fresh Nuxt 4 + PrimeVue scaffolding with no persistence. `docs/vision.md` commits to PostgreSQL and Docker Compose; Nuxt server routes act as the backend (Nitro context). Before any domain feature, the project needs a concrete data-access layer and an unattended migration workflow. This change decides the "how" of database access only — it does not define the domain schema.

## Goals / Non-Goals

**Goals:**
- Commit to Drizzle (`drizzle-orm` + `postgres` driver + `drizzle-kit`) as the data-access layer.
- Define a committed-SQL migration workflow with `db:generate` / `db:migrate` scripts.
- Define how migrations run unattended under Docker Compose.
- Prove the pipeline end-to-end with a throwaway fake table.

**Non-Goals:**
- Domain schema (tables/columns), ID strategy, credential encryption, RLS, per-user isolation enforcement.
- Authoring the full Compose stack; only the migration execution model is decided.

## Decisions

**D1 — Drizzle over Prisma / Kysely / raw `pg`.**
Drizzle has a minimal runtime (no separate query engine), is TS-native (schema doubles as domain types), and emits transparent SQL migrations — valuable for an OSS self-hosted app where users may inspect what runs. *Alternatives:* Prisma (mature migrations but heavier client/engine, less Nitro-friendly); Kysely (typed query builder, but BYO migrations); raw `pg` (max control, max boilerplate, no type safety).

**D2 — `postgres` (postgres.js) driver over `node-postgres` (`pg`).**
Lightweight, performant, first-class Drizzle support. *Alternative:* `pg` — broader ecosystem but heavier; not needed for a single-process Nitro app.

**D3 — Committed SQL migrations applied by the `drizzle-orm` migrator.**
`drizzle-kit generate` writes versioned SQL committed to the repo; the runtime migrator applies them. Transparent and reviewable. *Alternative:* `drizzle-kit push` (schema diffing, no migration history) — rejected: no audit trail, unsafe for self-hosted upgrades.

**D4 — Dedicated migrate step in Compose, before the app serves traffic.**
A separate migrate step (init/migrate container or pre-serve hook) runs `db:migrate` to completion, then the app starts. Keeps the request process free of migration concerns and halts startup on failure. *Alternative:* migrate inside the app boot hook — simpler but couples concerns and risks partial-migration serving under multiple replicas.

## Risks / Trade-offs

- [postgres.js less common than `pg`] → Well-supported by Drizzle; revisit only if a driver-specific need appears.
- [Migration step adds Compose complexity] → Mitigated by a single dedicated step; documented when the stack is authored.
- [Throwaway fake table leaking into history] → Mitigated by removing the verification migration before domain schema work.

## Open Questions

- Compose init/migrate container vs app-startup hook — finalize when the Compose stack is authored.
- ID strategy (serial vs UUID) — deferred to the domain schema change.
