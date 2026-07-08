## 1. Standalone compose stack (infra)

- [x] 1.1 Create `docker-compose.standalone.yml` with `db` (`postgres:18-alpine`), one-shot `migrate` (build stage, `pnpm db:migrate`), and `app` (runtime stage) services, its own non-external network, and a dedicated named volume (e.g. `pg-osi-time-tracker-standalone`) (REQ-NFR-016, REQ-NFR-017)
- [x] 1.2 Wire startup ordering: `db` healthcheck (`pg_isready`), `migrate` `depends_on` db with `condition: service_healthy`, `app` `depends_on` migrate with `condition: service_completed_successfully` (REQ-NFR-018)
- [x] 1.3 Set `restart: unless-stopped` on `db` and `app`, `restart: 'no'` on `migrate` (REQ-NFR-017)
- [x] 1.4 Require `NUXT_SESSION_PASSWORD` via `${NUXT_SESSION_PASSWORD:?...}` (fail fast, no default); provide overridable defaults for `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` and the published app port; do not publish the DB port by default (REQ-NFR-018)

## 2. Verification

- [x] 2.1 Cold start: with only the standalone file (dev stack down), run `docker compose -f docker-compose.standalone.yml up -d --build`; verify db becomes healthy, `migrate` exits 0, app serves on the published port, and login/registration works (REQ-NFR-016, REQ-NFR-018)
- [x] 2.2 Persistence: create data, `down` (without `-v`), `up -d` again, and verify the data is still present (REQ-NFR-017)
- [x] 2.3 Restart resilience: restart Docker Desktop (or the host) and verify `db` and `app` come back automatically with data intact (REQ-NFR-017)
- [x] 2.4 Negative test: start without `NUXT_SESSION_PASSWORD` and confirm compose fails fast with a clear error (REQ-NFR-018)
- [x] 2.5 Isolation: verify the dev `docker-compose.yml` and `docker-compose.local-prod.yml` workflows still work unchanged and use a different volume than the standalone stack (REQ-NFR-016, REQ-NFR-017)

## 3. Documentation

- [x] 3.1 Add a "Daily use (standalone stack)" section to `README.md`: prerequisites, `.env` setup (`NUXT_SESSION_PASSWORD`), start/stop commands, upgrade flow (`git pull` + `up -d --build`), and data-retention semantics (`down` vs `down -v`)
- [x] 3.2 Update `AGENTS.md` Docker notes to mention the third compose file and its purpose
