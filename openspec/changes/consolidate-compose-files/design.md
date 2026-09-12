## Context

See proposal.md — Why. Constraints that shape the approach:

- Nothing automated depends on the compose files: the e2e harness provisions its own `postgres:18-alpine` container and CI builds with `pnpm build`. This is a human-workflow and docs change.
- Nuxt (`nuxt.config.ts`) and the migrator (`migrate.ts`) hard-code `<repo>/.env`; Docker Compose auto-loads the same file. Any env-file layout must keep `.env` as the single file every tool reads.
- `data-persistence` REQ-040 requires migrations to run as a dedicated step, separate from the request-handling process.
- In dev the app and the migrator run on the host; only infrastructure runs in Docker.

## Goals / Non-Goals

**Goals:**

- One compose file per audience: contributor (`docker-compose.yml`) and self-hoster (`docker-compose.prod.yml`).
- Plain `docker compose up -d` stays light for daily dev work.
- The production stack cannot start with a known secret.

**Non-Goals:**

- Changing the `Dockerfile` or the shape of the `migrate` service.
- Any compose-driven dev server or dev migration step.

## Decisions

### D1: Trackers live in the dev file behind a `trackers` profile

OpenProject and Redmine are moved into `docker-compose.yml` with `profiles: [trackers]`. `docker compose up -d` starts `db` + `pgadmin`; `docker compose --profile trackers up -d` adds the three tracker services.

- *Alternative — always start everything:* simplest mental model, but OpenProject alone needs ~2 min and several GB to boot and adapter work is occasional. Rejected.
- *Alternative — keep separate files:* what we have today; the extra `-f` flags and per-file docs are the problem being solved. Rejected.

Service names stay distinct (`db` vs `redmine-db`) since all services share one network now. Volumes stay per-service so a tracker can be wiped without losing the dev app DB (`docker volume rm`), even though `down -v` on the dev file wipes all dev state — acceptable because nothing in dev is precious.

### D2: Prod stack = today's standalone file, renamed and tightened

`docker-compose.prod.yml` is `docker-compose.standalone.yml` with: `POSTGRES_PASSWORD` and `PGADMIN_DEFAULT_PASSWORD` switched to `${VAR:?message}`, pgadmin kept, tracker services absent, no database host port. `local-prod` is dropped because a prod-style `.env` plus the prod file on a dev machine covers "verify the production build locally".

- *Alternative — bring-your-own Postgres (app + migrate only):* leaner but every self-hoster must run Postgres 18 themselves; contradicts `docs/wbs.md` 8.6 ("full stack deployable via `docker compose up`"). Rejected.

The name `prod` describes intent (what you run for real) rather than topology (`standalone`).

### D3: One `.env.example`, grouped by audience

The single `.env.example` stays and is regrouped into three sections: host dev (`DATABASE_URL`, `NUXT_SESSION_PASSWORD`, optional `BOOTSTRAP_USER_*`), dev compose overrides (`POSTGRES_*`, `PGADMIN_*`, `OPENPROJECT_*`, `REDMINE_*`, all commented), and prod compose (`POSTGRES_PASSWORD`, `PGADMIN_DEFAULT_PASSWORD`, `PORT`, `PGADMIN_PORT`, commented with generation hints). `cp .env.example .env` keeps working for dev unchanged.

- *Alternative — `.env.example` + `.env.prod.example`:* cleaner per-audience read and lets prod secrets ship empty, but two files to keep in sync for a ~70% overlapping variable set. Rejected as not worth the second file.
- *Alternative — `.env.dev` / `.env.prod` with `--env-file`:* Nuxt and the migrator read only `.env`, so host tooling could not follow. Rejected.

Since dev needs a working `NUXT_SESSION_PASSWORD`, the example must ship one; protection against running prod with it rests on a loud comment plus the `:?` guards on `POSTGRES_PASSWORD` and `PGADMIN_DEFAULT_PASSWORD`, which are commented out in the example and therefore blank until a self-hoster sets them.

`host.docker.internal` is dropped from `DATABASE_URL`: only host processes read it (containers get a compose-built `@db:5432` URL), and the name does not resolve on Linux hosts.

### D4: `migrate` service unchanged

It still builds from the `build` stage and runs `pnpm db:migrate` once. Slimming it (bundling the migrator into the runtime image, or running migrations on app boot) is a separate change; the latter would also conflict with REQ-040.

## Risks / Trade-offs

- [Existing users of `docker-compose.standalone.yml` lose their volume names (`pg-osi-time-tracker-standalone`)] → Keep the same named volumes in `docker-compose.prod.yml` so data survives the rename; document the file rename in the README.
- [`down -v` on the dev file now wipes the dev app DB together with trackers] → Documented; per-service volumes allow targeted `docker volume rm`.
- [A self-hoster copies `.env.example` and keeps the dev `NUXT_SESSION_PASSWORD`] → The example marks it as dev-only with a generation hint, and the prod stack still refuses to start until the database and pgadmin passwords are set, which forces a pass over the file.
- [Port `8080` (pgadmin) and `3000` (app) collide if dev and prod stacks run on one machine] → Not a supported setup; the prod ports are overridable (`PORT`, `PGADMIN_PORT`) for ad-hoc local verification.

## Migration Plan

1. Add `docker-compose.prod.yml`; rewrite `docker-compose.yml`; regroup `.env.example`.
2. Delete the four retired compose files and update README / AGENTS.md / e2e-guideline in the same commit.
3. Rollback: revert the commit; volume names are unchanged so no data is affected either way.
