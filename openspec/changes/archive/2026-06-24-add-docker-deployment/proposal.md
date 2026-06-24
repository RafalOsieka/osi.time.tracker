## Why

The vision and WBS (8.6) require the full stack to be self-hostable via Docker, but the repository only ships a `docker-compose.yml` for local infrastructure (PostgreSQL + pgAdmin) and has no way to build or run the application itself as a container. Without a production image, the "self-hosted via Docker" promise is unverifiable and contributors cannot test a productive build locally.

## What Changes

- Add a multi-stage `Dockerfile` that installs dependencies, builds the Nuxt application, and produces a slim final runtime layer containing only the `.output/` Nitro server and the artifacts needed to run it.
- Add a separate production-verification compose file (`docker-compose.local-prod.yml`) that builds the image and runs the app container, applying database migrations on startup.
- Wire the app compose to the existing `osi-time-tracker` network so the production app container can reach the PostgreSQL container started by the existing `docker-compose.yml`.
- Document the required runtime environment variables (`DATABASE_URL`, `NUXT_SESSION_PASSWORD`) and the local verification workflow (DB compose + prod compose) in the README/AGENTS guidance.
- Add a `.dockerignore` to keep the build context (and final image) minimal and reproducible.

## Capabilities

### New Capabilities
- `docker-deployment`: Defines requirements for building a production container image of the application and running it via Docker Compose against the existing PostgreSQL service, including networking, configuration, migrations, and image-slimming expectations.

### Modified Capabilities
<!-- None: no existing spec-level behavior changes. -->

## Impact

- **New files**: `Dockerfile`, `docker-compose.local-prod.yml`, `.dockerignore`.
- **Existing files**: existing `docker-compose.yml` kept as the dev DB stack; its `osi-time-tracker` network is referenced (external) by the prod compose; README/AGENTS docs updated.
- **Runtime**: Node 24 Nitro server (`.output/server/index.mjs`) running as a non-root user with a fixed `NODE_ENV=production` and a fixed container port (`3000`); migrations run via `pnpm db:migrate` before serving traffic.
- **Dependencies**: no new npm dependencies; relies on Node + pnpm base images.

## Non-goals

- No production hosting/orchestration (Kubernetes, cloud provider, reverse proxy/TLS) — this only covers building the image and local verification.
- No changes to application logic, schema, or the existing dev DB compose services.
- No image publishing/registry/CI pipeline work.
