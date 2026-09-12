## Why

Running the project currently involves five Docker Compose files (`docker-compose.yml`, `local-prod`, `standalone`, `openproject`, `redmine`) with overlapping service definitions. The `local-prod` and `standalone` stacks are ~80% identical, the tracker stacks need extra `-f` flags, and the production stack accepts default database and pgadmin passwords. Two files with a clear audience each are enough.

## What Changes

- **BREAKING** Remove `docker-compose.local-prod.yml`, `docker-compose.standalone.yml`, `docker-compose.openproject.yml`, and `docker-compose.redmine.yml`.
- `docker-compose.yml` becomes the **dev** file: infrastructure only (`db`, `pgadmin`) plus OpenProject and Redmine behind a `trackers` compose profile. Starting the dev server and applying migrations stay host-side (`pnpm dev`, `pnpm db:migrate`).
- New `docker-compose.prod.yml`: the self-contained production stack (`db`, one-shot `migrate`, `app`, `pgadmin`) with its own network and volumes. The app connects to real remote trackers configured in-app; no local tracker instances.
- Production stack requires `NUXT_SESSION_PASSWORD`, `POSTGRES_PASSWORD`, and `PGADMIN_DEFAULT_PASSWORD` from the environment (no defaults).
- Keep the single `.env.example`, regrouped by audience (host dev / dev compose / prod compose). `DATABASE_URL` example points at `localhost`, not `host.docker.internal`.
- Update `README.md`, `AGENTS.md`, `docs/e2e-guideline.md`.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `docker-deployment`: remove the local-prod verification compose and cross-compose external network (REQ-046, REQ-047); rewrite the standalone stack requirements (REQ-049, REQ-050, REQ-051) around `docker-compose.prod.yml`, including pgadmin and mandatory credentials; add a requirement for the env example file.
- `tracker-dev-environments`: OpenProject and Redmine move from dedicated compose files (REQ-078, REQ-098) into the dev `docker-compose.yml` behind the `trackers` profile; port and volume isolation (REQ-100, REQ-101) and documentation pointers (REQ-082, REQ-102) are updated accordingly.

## Impact

- Compose files, `.env.example`; `Dockerfile` unchanged.
- Docs: `README.md`, `AGENTS.md`, `docs/e2e-guideline.md`.
- No CI or e2e-harness impact: the harness provisions its own PostgreSQL and CI builds via `pnpm build`.
- `data-persistence` REQ-040 (dedicated migrate step) is preserved: the `migrate` service moves unchanged into the prod file.

## Non-goals

- Slimming the `migrate` service image (it still builds from the `build` stage).
- Running migrations on app boot.
- Publishing a prebuilt image to a registry; prod still builds from the checkout.
- Live e2e tests against the local trackers.
- Secret management tooling for `.env` files (dotenvx/SOPS).
