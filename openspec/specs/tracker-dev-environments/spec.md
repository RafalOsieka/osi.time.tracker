# tracker-dev-environments Specification

## Purpose

Defines requirements for committed, reproducible local remote-tracker instances — provided in the dev `docker-compose.yml` behind an opt-in `trackers` compose profile with built-in data — that developers can start on demand to build and test remote-tracker integration. It covers the per-provider dev environments (OpenProject and Redmine), each isolated from the application's dev database, from each other, and from the production stack.

## Requirements

### Requirement: REQ-078 Opt-in local OpenProject compose file
The dev `docker-compose.yml` SHALL define a local OpenProject service assigned to the
`trackers` compose profile, so it is NOT started by the default `docker compose up -d`
and requires the profile to be activated explicitly.

#### Scenario: Not started by the default stack
- **WHEN** a developer runs `docker compose up -d` (default file, no profile)
- **THEN** only the app development infrastructure (database, pgadmin) starts and no OpenProject container is started

#### Scenario: Started explicitly on demand
- **WHEN** a developer runs `docker compose --profile trackers up -d`
- **THEN** a local OpenProject instance starts alongside the default services and becomes reachable on the configured host port

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
The OpenProject service SHALL persist its data in dedicated named volumes separate from
the app dev database volume and from every production stack volume, so its data can be
inspected and wiped independently.

#### Scenario: Teardown of the dev stack never touches production
- **WHEN** a developer runs `docker compose --profile trackers down -v`
- **THEN** the dev volumes (including OpenProject's) are removed and the production stack's volumes are untouched

#### Scenario: Teardown removes only OpenProject data
- **WHEN** a developer removes only OpenProject's named volumes
- **THEN** the app dev database volume keeps its data

### Requirement: REQ-082 Documented usage
The repository SHALL document, in `AGENTS.md`, how to start and stop the local
OpenProject instance via the `trackers` profile and how to obtain an API key for
integration work.

#### Scenario: Docs describe bring-up, teardown, and API key
- **WHEN** a developer reads the "Build and Deployment" section of `AGENTS.md`
- **THEN** they find the profile-based start/stop commands and the steps to obtain an API key

### Requirement: REQ-098 Opt-in local Redmine compose file
The dev `docker-compose.yml` SHALL define a local Redmine instance (official image plus a
dedicated PostgreSQL service) assigned to the `trackers` compose profile, so it is NOT
started by the default `docker compose up -d` and requires the profile to be activated
explicitly.

#### Scenario: Not started by the default stack
- **WHEN** a developer runs `docker compose up -d` (default file, no profile)
- **THEN** no Redmine or Redmine database container is started

#### Scenario: Started explicitly on demand
- **WHEN** a developer runs `docker compose --profile trackers up -d`
- **THEN** a local Redmine instance starts alongside the default services and becomes reachable on the configured host port

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
The Redmine instance SHALL be reachable over plain HTTP on a fixed localhost port
(default `8091`, overridable via `REDMINE_PORT`) that does not conflict with the
default dev services (database, pgadmin) or the local OpenProject instance.

#### Scenario: Login over plain HTTP succeeds
- **WHEN** a developer opens the configured `http://localhost:<port>` URL and logs in
  with the default admin credentials
- **THEN** authentication succeeds and the forced first-login password change can
  be completed

#### Scenario: Runs alongside the other dev stacks
- **WHEN** the dev stack is started with the `trackers` profile and default ports
- **THEN** database, pgadmin, OpenProject, and Redmine all start and no host-port conflict occurs

### Requirement: REQ-101 Isolated persistent storage
The Redmine services SHALL persist their data in dedicated named volumes separate from
the app dev database volume, from the OpenProject dev volumes, and from every production
stack volume.

#### Scenario: Teardown removes only Redmine data
- **WHEN** a developer removes only Redmine's named volumes
- **THEN** the app dev database volume and the OpenProject volumes keep their data

#### Scenario: Teardown of the dev stack never touches production
- **WHEN** a developer runs `docker compose --profile trackers down -v`
- **THEN** the production stack's volumes are untouched

### Requirement: REQ-102 Documented usage and manual setup steps
The repository SHALL document, in `README.md`, how to start and stop the local
Redmine instance via the `trackers` profile and the one-time manual steps required for
integration work: completing the forced admin password change, enabling the REST web
service, creating a sample project with issues, and obtaining the API access key.
`AGENTS.md` MAY mention the profile only (e.g. in the Docker Compose table)
without extended setup instructions.

#### Scenario: Docs describe bring-up, teardown, and manual steps
- **WHEN** a developer reads the Deployment section of `README.md`
- **THEN** they find the profile-based start/stop commands and the steps to enable the REST API,
  create sample data, and obtain the API access key
