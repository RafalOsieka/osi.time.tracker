# Proposal

## Why

The production `migrate` service reuses the whole Docker build stage (toolchain, dev dependencies, Nuxt sources, `tsx`) to run a ~60-line script. That script lives inside the web app, where it relied on an undeclared dependency (`@adonisjs/hash`) that only resolved by accident.

## What Changes

- New workspace app `apps/migrator` (`@osi/migrator`) owns the committed SQL migrations, the migration runner and bootstrap-user seeding. The Drizzle schema stays in `apps/web`; `db:generate` there writes new migrations into `apps/migrator/migrations`.
- The migrator is bundled with `vp pack` into a single file with no runtime dependencies to install, and ships as its own Dockerfile target on a plain Node image (no pnpm, `tsx`, toolchain or web sources).
- The production compose `migrate` service runs that target instead of the build stage. Startup ordering and fail-fast behavior are unchanged.
- Bootstrap seeding keeps its behavior but inserts through plain SQL and stores the password in the scrypt format `nuxt-auth-utils` verifies; a new e2e test proves the seeded user can log in.
- `apps/web` drops `server/db/migrate.ts`, the migrations folder and the `@adonisjs/hash` dependency, and its database client loses the migrator-only `logger: false` option. The e2e harness imports the runner and SQL folder from `@osi/migrator`.
- `pnpm db:migrate` and `pnpm db:generate` keep their names and effect.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `platform-docker`: the build stage is described as the Vite+ image with `vp`, not pnpm (REQ-043), and the `migrate` service runs a dedicated migrator image instead of `pnpm db:migrate` in the build stage (REQ-048).
- `core-persistence`: committed migrations live in the dedicated migrator app and are applied by its runner (REQ-039).
- `core-authentication`: the bootstrap password is stored in the format `nuxt-auth-utils` verifies, rather than via the Nuxt-only `hashPassword` helper, and the seeded user must be able to log in (REQ-012).

## Impact

- **Code:** new `apps/migrator`; in `apps/web`, `server/db/*`, `drizzle.config.ts`, the e2e harness and `db` specs.
- **Build/deploy:** `Dockerfile`, `.dockerignore`, `docker-compose.prod.yml`, root scripts, CI.
- **Dependencies:** `@adonisjs/hash`, `drizzle-orm` and `postgres` move to `@osi/migrator`'s dependencies.
- **Docs:** README, AGENTS.md.

## Non-goals

- Moving the Drizzle schema or the shared `getDb()` client out of `apps/web`, or creating a shared `packages/db`.
- Changing migration content, the migration history or table conventions.
- Adding self-registration or changing how the running app hashes passwords.
- Adding a container `HEALTHCHECK` or publishing prebuilt images.
