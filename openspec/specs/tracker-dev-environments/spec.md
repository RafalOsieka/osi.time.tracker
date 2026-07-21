# tracker-dev-environments Specification

## Purpose

Defines requirements for committed, reproducible local remote-tracker instances — provided via dedicated, opt-in Docker Compose files with built-in data — that developers can start on demand to build and test remote-tracker integration. It covers the per-provider dev environments (OpenProject and Redmine), each isolated from the application's dev stack and from each other.

## Requirements

### Requirement: REQ-078 Opt-in local OpenProject compose file
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

### Requirement: REQ-079 Demo data seeded on first boot
The OpenProject instance SHALL seed built-in demo data on first boot via
`OPENPROJECT_DEMO__DATA=true`, so a sample project, work packages, and
time-tracking activities exist without manual configuration.

#### Scenario: Sample content available after first boot
- **WHEN** the instance finishes its first-boot seeding
- **THEN** at least one sample project with work packages and time-tracking
  activities is present and visible after logging in

### Requirement: REQ-080 Local HTTP access without TLS
The instance SHALL be configured for plain-HTTP localhost access using
`OPENPROJECT_HTTPS=false` and a fixed host name/port, so login and redirects work
without TLS termination.

#### Scenario: Login over plain HTTP succeeds
- **WHEN** a developer opens the configured `http://localhost:<port>` URL and logs in
  with the default admin credentials
- **THEN** authentication succeeds and no HTTPS redirect breaks the session

### Requirement: REQ-081 Isolated persistent storage
The instance SHALL persist its data in dedicated named volumes separate from the
application's Postgres volumes, so tearing it down does not affect app dev data.

#### Scenario: Teardown removes only OpenProject data
- **WHEN** a developer runs `docker compose -f docker-compose.openproject.yml down -v`
- **THEN** only OpenProject's volumes are removed and `pg-osi-time-tracker` is untouched

### Requirement: REQ-082 Documented usage
The repository SHALL document, in `AGENTS.md`, how to start and stop the local
OpenProject instance and how to obtain an API key for later integration work.

#### Scenario: Docs describe bring-up, teardown, and API key
- **WHEN** a developer reads the "Docker Compose Files" section of `AGENTS.md`
- **THEN** they find the start/stop commands and the steps to obtain an API key

### Requirement: REQ-098 Opt-in local Redmine compose file
The project SHALL provide a dedicated `docker-compose.redmine.yml` that runs a
local Redmine instance (official image plus a dedicated PostgreSQL service) and is
NOT part of the default development stack started by `docker compose up`.

#### Scenario: Not started by the default stack
- **WHEN** a developer runs `docker compose up -d` (default file)
- **THEN** no Redmine container is started

#### Scenario: Started explicitly on demand
- **WHEN** a developer runs `docker compose -f docker-compose.redmine.yml up -d`
- **THEN** a local Redmine instance starts and becomes reachable on the
  configured host port

### Requirement: REQ-099 Default data seeded on first boot
The Redmine instance SHALL seed built-in default data on first boot via
`REDMINE_LOAD_DEFAULT_DATA=true`, so roles, issue statuses, workflows, and
time-entry activities exist without manual configuration. Sample projects and
issues are NOT seeded automatically and SHALL be covered by documented manual
steps instead.

#### Scenario: Default configuration available after first boot
- **WHEN** the instance finishes its first-boot seeding
- **THEN** default roles, issue statuses, and time-entry activities are present
  and visible after logging in

### Requirement: REQ-100 Local HTTP access on a non-conflicting port
The instance SHALL be reachable over plain HTTP on a fixed localhost port
(default `8091`, overridable via `REDMINE_PORT`) that does not conflict with the
default dev stack (PgAdmin) or the local OpenProject instance.

#### Scenario: Login over plain HTTP succeeds
- **WHEN** a developer opens the configured `http://localhost:<port>` URL and logs in
  with the default admin credentials
- **THEN** authentication succeeds and the forced first-login password change can
  be completed

#### Scenario: Runs alongside the other dev stacks
- **WHEN** the default dev stack, the OpenProject instance, and the Redmine
  instance are all running with default ports
- **THEN** no host-port conflict occurs

### Requirement: REQ-101 Isolated persistent storage
The instance SHALL persist its data in dedicated named volumes separate from the
application's Postgres volumes and from the OpenProject dev volumes, so tearing it
down does not affect other dev data.

#### Scenario: Teardown removes only Redmine data
- **WHEN** a developer runs `docker compose -f docker-compose.redmine.yml down -v`
- **THEN** only Redmine's volumes are removed and `pg-osi-time-tracker` and the
  OpenProject dev volumes are untouched

### Requirement: REQ-102 Documented usage and manual setup steps
The repository SHALL document, in `README.md`, how to start and stop the local
Redmine instance and the one-time manual steps required for integration work:
completing the forced admin password change, enabling the REST web service,
creating a sample project with issues, and obtaining the API access key.
`AGENTS.md` MAY mention the compose file only (e.g. in the Docker Compose table)
without extended setup instructions.

#### Scenario: Docs describe bring-up, teardown, and manual steps
- **WHEN** a developer reads the Deployment section of `README.md`
- **THEN** they find the start/stop commands and the steps to enable the REST API,
  create sample data, and obtain the API access key
