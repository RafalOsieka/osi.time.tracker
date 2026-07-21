# docker-deployment Specification

## Purpose

Defines requirements for containerising the OSI Time Tracker application for production use with Docker, including the multi-stage image build, runtime configuration, a local production verification compose file, cross-compose network connectivity, and pre-startup database migration.

## Requirements

### Requirement: REQ-043 Multi-stage production image build
The system SHALL provide a `Dockerfile` that builds the application in stages: a dependency/build stage that installs all dependencies with pnpm and runs the Nuxt production build, and a final runtime stage that contains only the artifacts required to run the application in production.

#### Scenario: Successful image build
- **WHEN** `docker build` is run against the repository root
- **THEN** the build installs dependencies, executes `nuxt build`, and completes successfully producing a runnable image

#### Scenario: Build fails fast on broken build
- **WHEN** the Nuxt production build fails during image build
- **THEN** the `docker build` command exits non-zero and no runtime image is produced

### Requirement: REQ-044 Slim final runtime layer
The final image stage SHALL include only the production runtime artifacts — the generated Nitro server output (`.output/`) and the Node 24 runtime — and MUST NOT include development dependencies, source build caches, test files, or the local build context excluded via `.dockerignore`.

#### Scenario: Final image excludes build-only artifacts
- **WHEN** the final image is inspected
- **THEN** it contains the `.output/` server bundle and does not contain `node_modules` dev dependencies, `test/`, or source-only tooling needed solely for building

#### Scenario: Build context is minimized
- **WHEN** the image is built
- **THEN** a `.dockerignore` SHALL exclude `node_modules`, `.output`, `.nuxt`, `.git`, and other non-essential paths from the build context

### Requirement: REQ-045 Container runtime configuration
The application container SHALL be configured entirely through environment variables and MUST require `DATABASE_URL` and `NUXT_SESSION_PASSWORD` at runtime, without baking secrets into the image. The image SHALL fix both `NODE_ENV=production` and the container listening port (`3000`). The container SHALL run as a non-root user.

#### Scenario: App starts with required configuration
- **WHEN** the container is started with valid `DATABASE_URL` and `NUXT_SESSION_PASSWORD`
- **THEN** the Nitro server starts as a non-root user with `NODE_ENV=production` and serves HTTP on port `3000`

#### Scenario: Missing required configuration
- **WHEN** the container is started without `DATABASE_URL`
- **THEN** the application SHALL fail fast with a clear error rather than starting in a broken state

### Requirement: REQ-046 Production verification compose
The system SHALL provide a separate Docker Compose file (`docker-compose.local-prod.yml`, distinct from the existing dev database compose) that builds the production image and runs the application container for local verification of the productive build.

#### Scenario: Production stack runs the built image
- **WHEN** the production compose file is brought up
- **THEN** it builds the image from the `Dockerfile`, starts the app container, and exposes the app port on the host

#### Scenario: Dev compose remains DB-only
- **WHEN** a developer wants only the local dev workflow
- **THEN** the existing `docker-compose.yml` SHALL continue to start only PostgreSQL (and pgAdmin) without building the app image

### Requirement: REQ-047 Cross-compose network connectivity
The production app container SHALL join the same Docker network used by the existing PostgreSQL compose (`osi-time-tracker`) so the app can resolve and connect to the database container by service name.

#### Scenario: App reaches the database
- **WHEN** the existing database compose and the production compose are both running
- **THEN** the app container resolves the `db` service over the shared `osi-time-tracker` network and establishes a database connection

#### Scenario: Shared network referenced as external
- **WHEN** the production compose is started while the database compose owns the network
- **THEN** the production compose references the `osi-time-tracker` network as external rather than creating a conflicting duplicate

### Requirement: REQ-048 Database migrations before serving traffic
Pending database migrations SHALL be applied before the production application begins serving traffic, via a dedicated one-shot `migrate` compose service.

The `migrate` service is a short-lived container (not a long-running service) that runs the project migration command (`pnpm db:migrate`) exactly once and then exits. It is built from the build stage (which retains the full dev `node_modules` and source needed by `tsx`), connects to the same database over the shared network, and applies any pending SQL migrations. The `app` service declares `depends_on` the `migrate` service with `condition: service_completed_successfully`, so the app container is only started after the `migrate` container has exited with a zero (success) status code.

#### Scenario: Migrations applied on startup
- **WHEN** the production stack starts with pending migrations
- **THEN** the one-shot `migrate` service runs `pnpm db:migrate` to completion, exits successfully, and only then does the `app` service start and accept requests

#### Scenario: Startup blocked on migration failure
- **WHEN** the one-shot `migrate` service exits with a non-zero status
- **THEN** the `app` service SHALL NOT start (its `service_completed_successfully` condition is unmet) and the failure is surfaced in container logs

### Requirement: REQ-049 Standalone daily-use compose stack
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

### Requirement: REQ-050 Persistent state across restarts
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

### Requirement: REQ-051 Standalone startup ordering and configuration
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

## Out of Scope

- A container `HEALTHCHECK` is intentionally deferred to a future change and is NOT part of this proposal.
