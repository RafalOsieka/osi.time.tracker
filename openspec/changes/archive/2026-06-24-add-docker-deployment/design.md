## Context

The repository ships only `docker-compose.yml`, which runs PostgreSQL 18 + pgAdmin on a Docker network named `osi-time-tracker`; there is no way to containerize the app itself. The app is Nuxt 4 (Vue 3) with a Nitro server. No custom `nitro.preset` is configured, so `nuxt build` emits the default **node-server** output at `.output/server/index.mjs`, runnable with plain Node. The package manager is pnpm `^11.6.0`; runtime config is provided via `DATABASE_URL` and `NUXT_SESSION_PASSWORD`. Migrations are committed SQL applied by `pnpm db:migrate` (`tsx server/db/migrate.ts`).

This design covers a production image and a separate compose (`docker-compose.local-prod.yml`) used only to verify the productive build locally, without disturbing the lightweight dev workflow (dev server + DB containers).

## Goals / Non-Goals

**Goals:**
- A multi-stage `Dockerfile` producing a slim final image containing only `.output/` plus a Node 24 runtime, run as a non-root user with `NODE_ENV=production` and the container port fixed at `3000`.
- A separate `docker-compose.local-prod.yml` that builds the image, runs the app, and connects to the existing DB compose via a shared network.
- Apply pending migrations before the app serves traffic.
- Keep the existing `docker-compose.yml` as a DB-only dev stack.

**Non-Goals:**
- Production orchestration, TLS/reverse proxy, registry/CI publishing.
- Application logic, schema, or dev-compose service changes.
- A container `HEALTHCHECK` — explicitly deferred to a future change.

## Decisions

- **Multi-stage build (deps → build → runtime).**
  - `base`: `node:24-alpine` with `npm install -g pnpm@latest` to install pnpm (avoids corepack semver-range rejection from `devEngines.packageManager`).
  - `build` stage: copy lockfile + manifest **and `pnpm-workspace.yaml`** before running `pnpm install --frozen-lockfile` (the workspace file is required for pnpm to resolve the install correctly), then copy source and run `pnpm build`.
  - `runtime` stage: copy only `.output/` from the build stage; entrypoint runs `node .output/server/index.mjs`. The runtime fixes `NODE_ENV=production`, exposes a fixed port (`3000`), and runs as a non-root user.
  - *Alternative considered*: single-stage image — rejected because it ships dev dependencies and source, bloating the image and widening attack surface.

- **Non-root runtime user.** The runtime stage creates (or reuses the base image's `node`) an unprivileged user and switches to it via `USER` before the entrypoint, so the app never runs as root. *Alternative considered*: running as root — rejected as a needless privilege/attack-surface increase.

- **Fixed `NODE_ENV` and fixed container port.** Both `NODE_ENV=production` and the container listening port (`3000`) are fixed in the image. The host-side port mapping in the compose file can still vary, so the same image can be published on different host ports.

- **Migrations require dev dependencies (`tsx`, `drizzle-kit` deps).** The slim runtime image intentionally lacks them, so migrations are NOT run from the runtime image. *Decision*: run migrations as a dedicated one-shot `migrate` compose service built from the **build stage** (which still has full `node_modules` + source). "One-shot" means the `migrate` service is a short-lived container that runs `pnpm db:migrate` exactly once and then **exits** — it is not a long-running service. The `app` service declares `depends_on` on `migrate` with `condition: service_completed_successfully`, so the app container only starts after the `migrate` container exits with status code 0; if migrations fail (non-zero exit), the app is never started.
  - *Alternative considered*: bundle `tsx`/dev deps into the runtime image and run migrations in the app entrypoint — rejected because it defeats the slim-image goal (REQ-NFR-011).
  - *Alternative considered*: compile migrations into the Nitro output — rejected as larger scope for MVP.

- **Cross-compose networking via external network.** `docker-compose.local-prod.yml` declares the `osi-time-tracker` network as `external: true`, matching the network the existing `docker-compose.yml` creates. The app connects to the DB by service name `db` (`DATABASE_URL=postgres://...@db:5432/...`).
  - *Alternative considered*: a single merged compose with profiles — rejected per the issue: local dev should run only dev server + DB, so the prod stack must be a separate file.
  - *Alternative considered*: `docker compose -f a.yml -f b.yml` merge — viable but still requires a shared network; external network is the clearest contract and lets the two stacks be started independently.

- **Build context hygiene.** A `.dockerignore` excludes `node_modules`, `.output`, `.nuxt`, `.git`, `test`, and local env files to speed builds and keep the context minimal.

## Risks / Trade-offs

- [External network must pre-exist] → If the prod compose starts before the DB compose created the network, `docker compose up` fails. Mitigation: document the order (bring up `docker-compose.yml` first) and/or note creating the network manually.
- [Network name coupling] → Compose may prefix network names per project. Mitigation: set an explicit `name: osi-time-tracker` on the network in both files so the external reference resolves deterministically.
- [Migration service duplicates build] → The `migrate` service reuses the build stage to access dev deps, adding startup time. Mitigation: target the existing build stage so no extra image layers are built.
- [Pinned base image drift] → Alpine/Node updates may change behavior. Mitigation: pin a specific Node major and keep it aligned with project engines.

## Resolved Decisions

- Runtime runs as a **non-root** user.
- `HEALTHCHECK` is **deferred** to a future change (out of scope here).
- `NODE_ENV=production` is **fixed** in the image; the container listening **port is fixed** at `3000`.
