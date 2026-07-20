## 1. Compose file

- [ ] 1.1 Create `docker-compose.redmine.yml` with the pinned official `redmine:6` image and a dedicated PostgreSQL service
- [ ] 1.2 Configure env: `REDMINE_LOAD_DEFAULT_DATA=true`, `REDMINE_DB_POSTGRES`/`REDMINE_DB_DATABASE`/`REDMINE_DB_USERNAME`/`REDMINE_DB_PASSWORD` wired to the sibling database, `REDMINE_SECRET_KEY_BASE` dev default
- [ ] 1.3 Map a non-conflicting host port (`${REDMINE_PORT:-8091}`) and add healthchecks for both services
- [ ] 1.4 Mount dedicated named volumes (Redmine files + Redmine Postgres data), isolated from app and OpenProject volumes

## 2. Configuration overrides

- [ ] 2.1 Add optional overrides to `.env.example` (Redmine port, database password, secret key base)

## 3. Documentation

- [ ] 3.1 Add a "Local Redmine" subsection to the Docker Compose Files section in `AGENTS.md` (bring-up / teardown commands)
- [ ] 3.2 Document the one-time manual steps: log in `admin`/`admin` and complete the forced password change; enable the REST web service (Administration → Settings → API); create a sample project with a few issues; obtain the API access key (My account → API access key)

## 4. Verification

- [ ] 4.1 Manually verify `docker compose -f docker-compose.redmine.yml up -d` boots and `http://localhost:<port>` loads and login works
- [ ] 4.2 Manually verify default data is present (roles, issue statuses, and time-entry activities Design/Development)
- [ ] 4.3 After the manual steps, verify `GET /issues.json` succeeds with the `X-Redmine-API-Key` header
- [ ] 4.4 Verify `down -v` removes only Redmine volumes and leaves `pg-osi-time-tracker` and the OpenProject volumes intact
- [ ] 4.5 Verify the default dev stack (`docker compose up -d`) does not start Redmine
