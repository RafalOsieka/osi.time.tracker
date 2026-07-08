## Why

The project has reached a point where it is usable for real daily time tracking, even though the full MVP is not complete. Today, running the productive build locally requires two compose files in a fixed order: the dev `docker-compose.yml` (PostgreSQL + pgAdmin, owns the shared network) and `docker-compose.local-prod.yml` (migrate + app, joins that network as external). That coupling makes the "clone the repo, start one stack, start tracking" workflow awkward: the app stack cannot run on its own, and daily-use data lives in the dev database volume.

A single, self-contained compose file that starts the database, applies migrations, and runs the productive app — with state persisted across container and host restarts — turns the current build into a genuinely usable personal tool.

Note: upgrading to the newest Nuxt compatibility level (Nitro v3 / Vite 8) was considered alongside this change and explicitly postponed — that generation ships with Nuxt 5, which is not yet released (stable `nuxt` is 4.4.8, already in use; stable `nitropack` is still 2.x).

## What Changes

- Add a dedicated standalone compose file (`docker-compose.standalone.yml`) containing the complete daily-use stack: `db` (PostgreSQL 18), one-shot `migrate`, and `app` (productive image built from the existing `Dockerfile`).
- Make the stack fully self-contained: it creates its own network and named database volume, with no dependency on the dev `docker-compose.yml` or its external network.
- Persist database state across restarts: named volume for PostgreSQL data plus `restart: unless-stopped` on `db` and `app` so the tracker comes back up when Docker (or the PC) restarts.
- Require `NUXT_SESSION_PASSWORD` at startup (no insecure default); keep other settings overridable via environment with sensible defaults.
- Document the daily-use workflow (start, stop, upgrade after `git pull`, data-retention semantics) in the README.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `docker-deployment`: add requirements for a standalone self-contained compose stack, persistent database state across restarts, and daily-use startup ordering/configuration (REQ-NFR-016..018). Existing requirements are unchanged; the dev compose and `docker-compose.local-prod.yml` keep their current roles.

## Impact

- **New files**: `docker-compose.standalone.yml`.
- **Existing files**: `README.md` (daily-use workflow docs); no changes to `Dockerfile`, `docker-compose.yml`, or `docker-compose.local-prod.yml`.
- **Runtime**: same production image and migration flow as `docker-compose.local-prod.yml`; a separate named volume keeps daily-use data isolated from the dev database volume.
- **Dependencies**: none — no new npm packages or images beyond those already used (`postgres:18-alpine`, project image).

## Non-goals

- No Nuxt 5 / Nitro v3 / Vite 8 upgrade — postponed until Nuxt 5 is released (see Why).
- No reverse proxy, TLS, image publishing, registry, or CI/CD deployment work.
- No backup/restore tooling beyond Docker's named-volume persistence.
- No changes to application logic, schema, or the existing dev/local-prod compose files.
