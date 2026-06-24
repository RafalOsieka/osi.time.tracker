## 1. Build context & image (backend/infra)

- [x] 1.1 Add `.dockerignore` excluding `node_modules`, `.output`, `.nuxt`, `.git`, `test`, local env files, and other non-essential paths (REQ-NFR-011)
- [x] 1.2 Create multi-stage `Dockerfile`: `base` (`node:24-alpine` + `corepack enable`), `build` (copy lockfile + `package.json` **and `pnpm-workspace.yaml`** before `pnpm install --frozen-lockfile`, then copy source and `pnpm build`), `runtime` (copy only `.output/`) (REQ-NFR-010, REQ-NFR-011)
- [x] 1.3 Set runtime entrypoint to `node .output/server/index.mjs`; fix `NODE_ENV=production`, expose a fixed port (`3000`), and run as a non-root user; configure via `DATABASE_URL` and `NUXT_SESSION_PASSWORD` env (no baked secrets) (REQ-NFR-012)
- [ ] 1.4 Verify a successful `docker build` produces a runnable image and that a broken build fails the command (REQ-NFR-010)
- [ ] 1.5 Inspect the final image to confirm it contains `.output/` and excludes dev dependencies, `test/`, and source-only tooling (REQ-NFR-011)

## 2. Production compose & networking (infra)

- [x] 2.1 Add `docker-compose.local-prod.yml` with an `app` service that builds from the `Dockerfile` and publishes the app port (`3000`) (REQ-NFR-013)
- [x] 2.2 Declare the `osi-time-tracker` network as `external: true` in `docker-compose.local-prod.yml` and set explicit `name: osi-time-tracker` on the network in both compose files (REQ-NFR-014)
- [x] 2.3 Configure the `app` service `DATABASE_URL` to reach the DB by service name `db` over the shared network; pass `NUXT_SESSION_PASSWORD` (REQ-NFR-012, REQ-NFR-014)
- [x] 2.4 Confirm the existing `docker-compose.yml` remains DB-only (no app build) and still owns/creates the network (REQ-NFR-013)

## 3. Migrations (backend/infra)

- [x] 3.1 Add a one-shot `migrate` service in `docker-compose.local-prod.yml` built from the `build` stage that runs `pnpm db:migrate` once and exits (short-lived, not a long-running service) (REQ-NFR-015)
- [x] 3.2 Make the `app` service `depends_on` the `migrate` service with `condition: service_completed_successfully` so the app starts only after the `migrate` container exits with status 0 (REQ-NFR-015)

## 4. Verification

- [ ] 4.1 Bring up `docker-compose.yml` (DB), then `docker-compose.local-prod.yml`; verify the one-shot `migrate` service runs and exits 0, the app starts, and `db` is reachable over the shared network (REQ-NFR-014, REQ-NFR-015)
- [ ] 4.2 Verify the app responds on the published port (`3000`) and a request exercising the DB succeeds (REQ-NFR-012)
- [ ] 4.3 Negative test: start the app container without `DATABASE_URL` and confirm it fails fast with a clear error (REQ-NFR-012)
- [ ] 4.4 Negative test: start with the network/DB unavailable and confirm the app does not serve traffic and the failure is logged (REQ-NFR-015)

## 5. Documentation

- [x] 5.1 Update `README.md` with the production image build, the prod-compose verification workflow, startup order (DB compose first), and required env vars
- [x] 5.2 Document the runtime decisions: non-root user, fixed `NODE_ENV=production`, customizable port, and that `HEALTHCHECK` is deferred to a future change
