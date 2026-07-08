## Context

The repo already has three Docker artifacts: a multi-stage `Dockerfile` (build + runtime stages), a dev `docker-compose.yml` (PostgreSQL + pgAdmin, owns the shared `osi-time-tracker` external network), and `docker-compose.local-prod.yml` (migrate + app, joins that network as external). None of them alone provides a "clone → one command → usable app with durable data" experience for daily personal use.

## Goals / Non-Goals

- Goal: one self-contained compose file for daily productive use on the user's PC, with database state surviving container/daemon/host restarts.
- Non-goal: replacing the dev or local-prod compose files, remote hosting, TLS, registries, or the Nuxt 5 / Nitro v3 / Vite 8 upgrade (postponed — Nuxt 5 is unreleased; the project is already on the latest stable Nuxt 4.4.8).

## Decisions

### D1: New standalone file instead of evolving `docker-compose.local-prod.yml`

A third file, `docker-compose.standalone.yml`, keeps concerns separated: dev infra (`docker-compose.yml`), prod-image verification against dev DB (`docker-compose.local-prod.yml`), and daily use (standalone). Evolving local-prod was rejected because its documented purpose (REQ-NFR-013/014: verify the prod image against the dev database over the shared network) differs from daily use, and merging the roles would couple daily data to the dev stack.

### D2: Dedicated volume and network, isolated from dev

The standalone stack defines its own named volume (e.g. `pg-osi-time-tracker-standalone`) and its own non-external network. Reusing the dev volume was rejected: dev experiments (`down -v`, schema resets) must never destroy real tracking data. The compose project name also differs, so containers do not collide with the dev stack.

### D3: Restart policy and one-shot migrate

`db` and `app` use `restart: unless-stopped` so the tracker resumes after Docker Desktop or the PC restarts. `migrate` stays `restart: 'no'` (one-shot); `depends_on` conditions (`service_healthy` for db → migrate, `service_completed_successfully` for migrate → app) apply on `compose up`. After a daemon restart, `app` restarts directly without re-running `migrate` — safe, because migrations already applied are idempotent no-ops and new migrations only arrive via a new `compose up --build` after `git pull`.

### D4: Build from local source, no registry

The stack builds the image from the local checkout (`build: { context: ., target: runtime }`), matching the "download source code on my PC" workflow. Publishing images is out of scope; upgrading = `git pull` + `docker compose -f docker-compose.standalone.yml up -d --build`.

### D5: Secrets and defaults

`NUXT_SESSION_PASSWORD` is required with no default (compose `${NUXT_SESSION_PASSWORD:?...}` syntax fails fast with a clear message). Database credentials/name and the published app port default sensibly and are overridable via `.env`. The database port is NOT published to the host by default — the app reaches it over the internal network; users who want SQL access can use the dev stack or override.

## Risks / Trade-offs

- Two PostgreSQL volumes (dev + standalone) can confuse: mitigated by distinct volume names and README docs.
- No automated backups: acceptable for now; named-volume persistence plus standard `pg_dump` guidance in README. A backup capability can be a future change.
- Running dev stack and standalone stack simultaneously requires distinct host ports (defaults: dev DB 5432 published, standalone DB unpublished; app 3000 — documented, overridable).
