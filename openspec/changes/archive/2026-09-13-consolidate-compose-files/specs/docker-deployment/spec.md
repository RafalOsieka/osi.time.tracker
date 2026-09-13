## ADDED Requirements

### Requirement: REQ-346 Single environment example grouped by audience
The repository SHALL provide one committed `.env.example`, grouped into sections for host development, dev compose overrides, and the production compose stack, with every variable documented next to the stack that reads it. It SHALL contain working development defaults so `pnpm dev` runs after copying it to `.env` unchanged, with `DATABASE_URL` pointing at `localhost` (the published dev database port). Production-only secrets (`POSTGRES_PASSWORD`, `PGADMIN_DEFAULT_PASSWORD`) SHALL be present only as commented-out entries with generation hints, and the development `NUXT_SESSION_PASSWORD` SHALL be marked as not for production use.

#### Scenario: Dev example works unchanged
- **WHEN** a developer copies `.env.example` to `.env`, starts the dev compose stack, and runs `pnpm db:migrate` then `pnpm dev`
- **THEN** the app starts and connects to the dev database without editing any value

#### Scenario: Unedited example does not start the production stack
- **WHEN** a self-hoster copies `.env.example` to `.env` without uncommenting the production secrets and starts the production stack
- **THEN** the stack refuses to start and names the first missing variable

#### Scenario: Example is committed, real env files are not
- **WHEN** the repository is inspected
- **THEN** `.env.example` is tracked while `.env` and every other `.env.*` file are git-ignored

## MODIFIED Requirements

### Requirement: REQ-049 Standalone daily-use compose stack
The system SHALL provide a dedicated, self-contained Docker Compose file (`docker-compose.prod.yml`, distinct from the dev `docker-compose.yml`) that runs the complete productive stack — a `db` service (PostgreSQL 18), a one-shot `migrate` service, the `app` service built from the existing `Dockerfile`, and a `pgadmin` service — without depending on any other compose file or pre-existing external network. The database port SHALL NOT be published to the host; only the app and pgadmin ports are. The stack SHALL NOT include local remote-tracker instances; the app connects to real OpenProject/Redmine instances configured in-app.

#### Scenario: Single command brings up the full stack
- **WHEN** `docker compose -f docker-compose.prod.yml up -d` is run on a machine with only the repository cloned (given required env vars)
- **THEN** the database starts, pending migrations are applied, the app starts, and the app and pgadmin are reachable on their published ports without any other compose file running

#### Scenario: No external network dependency
- **WHEN** the production compose file is brought up while the dev `docker-compose.yml` stack is not running
- **THEN** the stack creates and uses its own network and starts successfully

#### Scenario: Database is not exposed on the host
- **WHEN** the production stack is running
- **THEN** PostgreSQL is reachable from `app`, `migrate`, and `pgadmin` by service name but no host port is published for it

#### Scenario: Existing compose files keep their roles
- **WHEN** a developer runs `docker compose up -d` (default file)
- **THEN** no application image is built and no `app` or `migrate` container is started

### Requirement: REQ-050 Persistent state across restarts
The production stack SHALL persist database and pgadmin state across container, Docker daemon, and host restarts. PostgreSQL data SHALL be stored in a dedicated named volume (separate from the dev database volume), and the long-running services (`db`, `app`, `pgadmin`) SHALL use `restart: unless-stopped` so the stack resumes automatically when Docker starts.

#### Scenario: Data survives a stack restart
- **WHEN** the production stack is stopped with `docker compose -f docker-compose.prod.yml down` (without `-v`) and brought up again
- **THEN** previously stored users and tracking data are still present

#### Scenario: Stack resumes after Docker/host restart
- **WHEN** the Docker daemon or the host machine restarts
- **THEN** the `db`, `app`, and `pgadmin` containers restart automatically and the app serves traffic with the previous data intact

#### Scenario: Explicit data removal only
- **WHEN** the user runs `down -v` against the production compose file
- **THEN** only then are the production volumes deleted; the dev volumes are never affected

### Requirement: REQ-051 Standalone startup ordering and configuration
Within the production stack, the `migrate` service SHALL wait for the `db` service to be healthy (via the PostgreSQL healthcheck) before applying migrations, and the `app` service SHALL start only after `migrate` completes successfully. The stack SHALL require `NUXT_SESSION_PASSWORD`, `POSTGRES_PASSWORD`, and `PGADMIN_DEFAULT_PASSWORD` from the environment (no insecure defaults) while providing overridable defaults for the database user, database name, pgadmin e-mail, and the published app and pgadmin ports.

#### Scenario: Ordered cold start
- **WHEN** the production stack starts from scratch
- **THEN** `migrate` runs only after the database healthcheck passes, and `app` starts only after `migrate` exits with status 0

#### Scenario: Missing session secret fails fast
- **WHEN** the stack is started with any of `NUXT_SESSION_PASSWORD`, `POSTGRES_PASSWORD`, or `PGADMIN_DEFAULT_PASSWORD` unset or empty
- **THEN** compose refuses to start the stack and the error names the missing variable

#### Scenario: Defaults are overridable
- **WHEN** the user overrides the published ports, database user, or database name via environment variables (e.g. an `.env` file)
- **THEN** the stack uses the overridden values without editing the compose file

## REMOVED Requirements

### Requirement: REQ-046 Production verification compose
**Reason**: `docker-compose.local-prod.yml` duplicated the self-contained production stack minus the database. Verifying the production build locally is now `docker compose -f docker-compose.prod.yml up` against a prod-style `.env`.
**Migration**: Delete `docker-compose.local-prod.yml`; use `docker-compose.prod.yml` (optionally with `--env-file`) for local verification.

### Requirement: REQ-047 Cross-compose network connectivity
**Reason**: With the local-prod compose removed, no app container needs to join the dev stack's network. The production stack owns its network (REQ-049).
**Migration**: None; the dev `osi-time-tracker` network no longer needs to be referenced externally.
