## ADDED Requirements

### Requirement: REQ-NFR-016 Standalone daily-use compose stack
The system SHALL provide a dedicated, self-contained Docker Compose file (`docker-compose.standalone.yml`, distinct from the dev `docker-compose.yml` and the verification `docker-compose.local-prod.yml`) that runs the complete productive stack — a `db` service (PostgreSQL 18), a one-shot `migrate` service, and the `app` service built from the existing `Dockerfile` — without depending on any other compose file or pre-existing external network.

#### Scenario: Single command brings up the full stack
- **WHEN** `docker compose -f docker-compose.standalone.yml up -d` is run on a machine with only the repository cloned (given required env vars)
- **THEN** the database starts, pending migrations are applied, the app starts, and the app is reachable on the published port without any other compose file running

#### Scenario: No external network dependency
- **WHEN** the standalone compose file is brought up while the dev `docker-compose.yml` stack is not running
- **THEN** the stack creates and uses its own network and starts successfully

#### Scenario: Existing compose files keep their roles
- **WHEN** a developer uses the dev or local-prod workflows
- **THEN** `docker-compose.yml` (dev DB + pgAdmin) and `docker-compose.local-prod.yml` (prod verification against the dev network) SHALL continue to work unchanged

### Requirement: REQ-NFR-017 Persistent state across restarts
The standalone stack SHALL persist database state across container, Docker daemon, and host restarts. PostgreSQL data SHALL be stored in a dedicated named volume (separate from the dev database volume), and the long-running services (`db`, `app`) SHALL use `restart: unless-stopped` so the stack resumes automatically when Docker starts.

#### Scenario: Data survives a stack restart
- **WHEN** the standalone stack is stopped with `docker compose -f docker-compose.standalone.yml down` (without `-v`) and brought up again
- **THEN** previously stored users and tracking data are still present

#### Scenario: Stack resumes after Docker/host restart
- **WHEN** the Docker daemon or the host machine restarts
- **THEN** the `db` and `app` containers restart automatically and the app serves traffic with the previous data intact

#### Scenario: Explicit data removal only
- **WHEN** the user runs `down -v` against the standalone compose file
- **THEN** only then is the standalone data volume deleted; the dev database volume is never affected

### Requirement: REQ-NFR-018 Standalone startup ordering and configuration
Within the standalone stack, the `migrate` service SHALL wait for the `db` service to be healthy (via the PostgreSQL healthcheck) before applying migrations, and the `app` service SHALL start only after `migrate` completes successfully. The stack SHALL require `NUXT_SESSION_PASSWORD` from the environment (no insecure default) while providing overridable defaults for database credentials, database name, and the published app port.

#### Scenario: Ordered cold start
- **WHEN** the standalone stack starts from scratch
- **THEN** `migrate` runs only after the database healthcheck passes, and `app` starts only after `migrate` exits with status 0

#### Scenario: Missing session secret fails fast
- **WHEN** the stack is started without `NUXT_SESSION_PASSWORD` set
- **THEN** the app SHALL NOT serve traffic with a baked-in or empty session secret, and the failure is surfaced to the user

#### Scenario: Defaults are overridable
- **WHEN** the user overrides the published port or database credentials via environment variables (e.g. an `.env` file)
- **THEN** the stack uses the overridden values without editing the compose file
