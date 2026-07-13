## Context

User stories 9–11 require a real remote issue tracker (OpenProject) to develop and
test against (config, browse/link issues, push time). The repo currently has no
local OpenProject; any such work would need manual, non-reproducible setup. This
change stands up a reproducible, opt-in local OpenProject dev environment.

The repo already uses Docker Compose for infra (`docker-compose.yml` for Postgres +
PgAdmin, plus `docker-compose.local-prod.yml` and `docker-compose.standalone.yml`).
This change adds a fourth, independent compose file, consistent with that pattern.

## Goals / Non-Goals

**Goals:**
- One-command, reproducible local OpenProject a developer starts on demand.
- Sample project + work packages + time-tracking activities present automatically.
- Works over plain HTTP on localhost without TLS friction.
- Fully isolated from the app's Postgres data; easy teardown.
- Documented bring-up/teardown and how to obtain an API key.

**Non-Goals:**
- No seed script or committed DB snapshot (rely on demo-data flag).
- No RemoteSystemConfig schema, adapters, or app API calls.
- No CORS/CSP changes in `nuxt.config.ts`.
- No Redmine instance. No user-story-9 implementation. No CI integration.

## Decisions

### D1: Official all-in-one image over multi-container compose
Use `openproject/openproject:<pinned-tag>` (all-in-one: web, worker, cron, Postgres,
memcached in one container). Alternative considered: the official multi-container
compose (`opf/openproject-docker-compose`). Rejected for dev because it is heavier
and more moving parts; the all-in-one is the documented "quick try" path and enough
for local integration work.

### D2: Built-in demo data over seed script
Set `OPENPROJECT_DEMO__DATA=true` (+ `OPENPROJECT_DEFAULT__LANGUAGE=en`) so a sample
project, work packages, and time-tracking activities exist on first boot. Alternative:
an idempotent API-v3 seed script (more control over IDs/activities, doubles as an
adapter smoke test). Deferred — chosen per prior decision to keep this change small;
a seed script can be added later when story 9/10a need deterministic fixtures.

### D3: Separate opt-in compose file
Add `docker-compose.openproject.yml` rather than a profile in `docker-compose.yml`.
Keeps the everyday dev stack lean; matches existing convention of purpose-specific
compose files. Started explicitly: `docker compose -f docker-compose.openproject.yml up -d`.

### D4: Local HTTP + fixed host/port
Set `OPENPROJECT_HTTPS=false`, `OPENPROJECT_HOST__NAME=localhost:<port>`, provide a
dev `SECRET_KEY_BASE`, and map a host port (default 8080 collides with PgAdmin, so
use a distinct default, e.g. 8090, overridable via env). Rationale: OpenProject
defaults to HTTPS and would break logins/redirects over plain localhost otherwise.

### D5: Dedicated isolated volumes
Mount OpenProject's `/var/openproject/pgdata` and `/var/openproject/assets` to
dedicated named volumes (e.g. `pg-openproject-dev`, `openproject-assets-dev`),
separate from `pg-osi-time-tracker`. Teardown with `-v` wipes only OpenProject data.

## Risks / Trade-offs

- [Port clash with PgAdmin (8080)] → default OpenProject to a different host port and
  make it env-overridable.
- [Slow first boot / heavy image] → acceptable for opt-in dev tooling; document that
  first boot seeds data and takes a few minutes.
- [Image tag drift / demo-data shape not deterministic] → pin an explicit image tag;
  accept that IDs are not guaranteed stable (documented; seed script deferred).
- [Manual API-key step] → default admin/admin login; document obtaining an API key
  from account settings; automating it is out of scope here.
- [OPENPROJECT_HTTPS=false is dev-only] → document that this file is for local dev
  only and must never be used in production.
