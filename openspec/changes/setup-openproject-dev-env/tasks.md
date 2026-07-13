## 1. Compose file

- [ ] 1.1 Create `docker-compose.openproject.yml` using the pinned `openproject/openproject` all-in-one image
- [ ] 1.2 Configure env: `OPENPROJECT_HTTPS=false`, `OPENPROJECT_HOST__NAME=localhost:<port>`, `OPENPROJECT_DEFAULT__LANGUAGE=en`, `OPENPROJECT_DEMO__DATA=true`, dev `SECRET_KEY_BASE`
- [ ] 1.3 Map a non-conflicting host port (default 8090, env-overridable) and add a healthcheck
- [ ] 1.4 Mount dedicated named volumes for `/var/openproject/pgdata` and `/var/openproject/assets`

## 2. Configuration overrides

- [ ] 2.1 Add optional overrides to `.env.example` (OpenProject port, admin password / secret key)

## 3. Documentation

- [ ] 3.1 Add a "Local OpenProject" subsection to the Docker Compose Files section in `AGENTS.md` (bring-up / teardown commands)
- [ ] 3.2 Document obtaining the API key and the demo-data note (first boot seeds data, may take minutes)

## 4. Verification

- [ ] 4.1 Manually verify `docker compose -f docker-compose.openproject.yml up -d` boots and `http://localhost:<port>` loads and login works
- [ ] 4.2 Manually verify demo project, work packages, and time-tracking activities are present
- [ ] 4.3 Verify `down -v` removes only OpenProject volumes and leaves `pg-osi-time-tracker` intact
- [ ] 4.4 Verify the default dev stack (`docker compose up -d`) does not start OpenProject
