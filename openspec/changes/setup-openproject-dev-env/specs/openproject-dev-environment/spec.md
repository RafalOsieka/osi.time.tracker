## ADDED Requirements

### Requirement: REQ-TTR-401 Opt-in local OpenProject compose file
The project SHALL provide a dedicated `docker-compose.openproject.yml` that runs a
local OpenProject instance and is NOT part of the default development stack started
by `docker compose up`.

#### Scenario: Not started by the default stack
- **WHEN** a developer runs `docker compose up -d` (default file)
- **THEN** no OpenProject container is started

#### Scenario: Started explicitly on demand
- **WHEN** a developer runs `docker compose -f docker-compose.openproject.yml up -d`
- **THEN** a local OpenProject instance starts and becomes reachable on the
  configured host port

### Requirement: REQ-TTR-402 Demo data seeded on first boot
The OpenProject instance SHALL seed built-in demo data on first boot via
`OPENPROJECT_DEMO__DATA=true`, so a sample project, work packages, and
time-tracking activities exist without manual configuration.

#### Scenario: Sample content available after first boot
- **WHEN** the instance finishes its first-boot seeding
- **THEN** at least one sample project with work packages and time-tracking
  activities is present and visible after logging in

### Requirement: REQ-TTR-403 Local HTTP access without TLS
The instance SHALL be configured for plain-HTTP localhost access using
`OPENPROJECT_HTTPS=false` and a fixed host name/port, so login and redirects work
without TLS termination.

#### Scenario: Login over plain HTTP succeeds
- **WHEN** a developer opens the configured `http://localhost:<port>` URL and logs in
  with the default admin credentials
- **THEN** authentication succeeds and no HTTPS redirect breaks the session

### Requirement: REQ-TTR-404 Isolated persistent storage
The instance SHALL persist its data in dedicated named volumes separate from the
application's Postgres volumes, so tearing it down does not affect app dev data.

#### Scenario: Teardown removes only OpenProject data
- **WHEN** a developer runs `docker compose -f docker-compose.openproject.yml down -v`
- **THEN** only OpenProject's volumes are removed and `pg-osi-time-tracker` is untouched

### Requirement: REQ-TTR-405 Documented usage
The repository SHALL document, in `AGENTS.md`, how to start and stop the local
OpenProject instance and how to obtain an API key for later integration work.

#### Scenario: Docs describe bring-up, teardown, and API key
- **WHEN** a developer reads the "Docker Compose Files" section of `AGENTS.md`
- **THEN** they find the start/stop commands and the steps to obtain an API key

## Open Questions

- [UNCONFIRMED] Exact default host port (proposed 8090 to avoid the PgAdmin 8080 clash).
- [UNCONFIRMED] Exact pinned OpenProject image tag.
