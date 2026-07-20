## Context

The upcoming `add-redmine-adapter` change needs a real Redmine instance to develop and test against, mirroring what `docker-compose.openproject.yml` provides for OpenProject (spec `openproject-dev-environment`, REQ-TTR-401..405). The repo convention is purpose-specific, opt-in compose files (`docker-compose.openproject.yml`, `docker-compose.local-prod.yml`, `docker-compose.standalone.yml`); this change adds one more, consistent with that pattern.

Two Redmine-specific wrinkles differ from OpenProject and shape this design:
1. Redmine has no demo-data flag equivalent to `OPENPROJECT_DEMO__DATA`; `REDMINE_LOAD_DEFAULT_DATA=true` seeds only enumerations, roles, statuses, and workflows — notably including time-entry activities — but **not** a sample project or issues.
2. Redmine's REST API is disabled by default and has no env-var toggle; it must be enabled in Administration → Settings → API.

## Goals / Non-Goals

**Goals:**
- One-command, reproducible local Redmine a developer starts on demand.
- Default data (roles, statuses, workflows, time-entry activities) present automatically via `REDMINE_LOAD_DEFAULT_DATA=true`.
- Works over plain HTTP on localhost; port does not clash with PgAdmin (8080) or OpenProject (8090).
- Fully isolated volumes; easy teardown without touching app or OpenProject data.
- Documented bring-up/teardown and the one-time manual steps in `README.md` (password change, REST API enablement, sample project/issues, API access key).

**Non-Goals:**
- No automated seed script (`rails runner`) for projects/issues or REST enablement — deferred; manual steps are documented instead (per decision).
- No Redmine adapter or app code changes.
- No CI integration; developer-invoked only.

## Decisions

### D1: Official `redmine` image + dedicated PostgreSQL container
Use the pinned official `redmine:6` image with a sibling `postgres` container (Redmine has no all-in-one image with a production-grade DB). SQLite was considered for a single-container setup but rejected: the Postgres pairing matches the image's documented usage and the rest of the repo's infrastructure.

### D2: `REDMINE_LOAD_DEFAULT_DATA=true` + documented manual steps
Default data gives us the crucial time-entry activities (Design/Development) without clicking. Sample project/issues, REST API enablement, and the API key remain documented manual steps in `README.md`. Alternative: a `rails runner` seed step in the compose file (would make future e2e-against-Redmine feasible) — deferred to keep this change small, mirroring how the OpenProject seed script was deferred.

### D3: Separate opt-in compose file
Add `docker-compose.redmine.yml` rather than a profile in `docker-compose.yml`, matching `docker-compose.openproject.yml`. Started explicitly: `docker compose -f docker-compose.redmine.yml up -d`.

### D4: Distinct default host port `8091`, env-overridable
8080 is PgAdmin, 8090 is OpenProject; default Redmine to `${REDMINE_PORT:-8091}` so all three dev stacks can run simultaneously. Redmine serves plain HTTP natively, so no HTTPS toggle is needed (unlike OpenProject).

### D5: Dedicated isolated volumes
Named volumes for Redmine files/plugins and its Postgres data (e.g. `redmine-files-dev`, `pg-redmine-dev`), separate from `pg-osi-time-tracker` and the OpenProject volumes. Teardown with `-v` wipes only Redmine data.

## Risks / Trade-offs

- [Forced admin password change on first login (`admin`/`admin`)] → document it as step one of the manual setup.
- [REST API disabled by default] → documented admin toggle; without it every adapter call fails — called out prominently in `README.md`.
- [No sample project/issues out of the box] → documented manual creation; deterministic fixtures via `rails runner` deferred until e2e-against-Redmine is needed.
- [Image tag drift] → pin an explicit major tag (`redmine:6`-series) like OpenProject's pinned tag.
- [Dev-only configuration] → document that this file is for local dev only and must never be used in production.
