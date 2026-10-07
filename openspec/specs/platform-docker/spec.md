# platform-docker Specification

## Purpose

Defines how OSI Time Tracker is shipped for self-hosting with Docker: the application and migrator images, their runtime configuration, the self-contained production compose stack, the committed environment example, and migrations applied before the app serves traffic.

## Requirements

### Requirement: REQ-043 Multi-stage production image build
The system SHALL provide a `Dockerfile` that builds the application in stages: a build stage that installs the web application's dependencies with the project toolchain and runs the Nuxt production build, and a final runtime stage that contains only the artifacts required to run the application in production. The same `Dockerfile` SHALL also produce the dedicated migrator image (REQ-426) as a separately addressable target, while building the application runtime image by default.

#### Scenario: Successful image build
- **WHEN** `docker build` is run against the repository root without selecting a target
- **THEN** the build installs dependencies, executes `nuxt build`, and completes successfully producing a runnable application image

#### Scenario: Build fails fast on broken build
- **WHEN** the Nuxt production build fails during image build
- **THEN** the `docker build` command exits non-zero and no runtime image is produced

#### Scenario: Migrator image is built from the same Dockerfile
- **WHEN** `docker build` is run against the repository root selecting the migrator target
- **THEN** it produces the migrator image without running the Nuxt production build

### Requirement: REQ-044 Slim final runtime layer
The final image stage SHALL include only the production runtime artifacts — the generated Nitro server output and the Node runtime — and MUST NOT include development dependencies, source build caches, test files, or other build-only context.

#### Scenario: Final image excludes build-only artifacts
- **WHEN** the final image is inspected
- **THEN** it contains the `.output/` server bundle and does not contain `node_modules` dev dependencies, `test/`, or source-only tooling needed solely for building

### Requirement: REQ-045 Container runtime configuration
The application container SHALL be configured entirely through environment variables and MUST require `DATABASE_URL` and `NUXT_SESSION_PASSWORD` at runtime, without baking secrets into the image. The image SHALL fix both `NODE_ENV=production` and the container listening port (`3000`). The container SHALL run as a non-root user.

#### Scenario: App starts with required configuration
- **WHEN** the container is started with valid `DATABASE_URL` and `NUXT_SESSION_PASSWORD`
- **THEN** the Nitro server starts as a non-root user with `NODE_ENV=production` and serves HTTP on port `3000`

#### Scenario: Missing required configuration
- **WHEN** the container is started without `DATABASE_URL`
- **THEN** the application SHALL fail fast with a clear error rather than starting in a broken state

### Requirement: REQ-048 Database migrations before serving traffic
Pending database migrations SHALL be applied before the production application serves traffic, by a one-shot `migrate` compose service. It SHALL run the migrator image (REQ-426) exactly once against the stack's database, apply pending migrations, run the bootstrap-user seeding (core-authentication REQ-012), and exit. The `app` service SHALL start only after `migrate` exits with status 0 (`depends_on` with `condition: service_completed_successfully`).

#### Scenario: Migrations applied on startup
- **WHEN** the production stack starts with pending migrations
- **THEN** the one-shot `migrate` service applies them to completion, exits successfully, and only then does the `app` service start and accept requests

#### Scenario: Startup blocked on migration failure
- **WHEN** the one-shot `migrate` service exits with a non-zero status
- **THEN** the `app` service SHALL NOT start (its `service_completed_successfully` condition is unmet) and the failure is surfaced in container logs

### Requirement: REQ-426 Dedicated migrator image
The migrator image SHALL contain only the Node runtime, the bundled migration runner and the committed SQL migrations. It MUST NOT contain a package manager, the build toolchain, development dependencies, or web application sources. Without `DATABASE_URL` it SHALL exit non-zero naming the variable, before attempting a connection.

#### Scenario: Missing database configuration
- **WHEN** the migrator image is started without `DATABASE_URL`
- **THEN** it SHALL exit non-zero with a clear error naming the missing variable, without attempting a connection

#### Scenario: Migrator image carries no build tooling
- **WHEN** the migrator image is inspected
- **THEN** it contains the Node runtime, the bundled runner and the SQL migrations, and does not contain a package manager, `node_modules`, the build toolchain, or web application sources

### Requirement: REQ-049 Standalone daily-use compose stack
The system SHALL provide a self-contained `docker-compose.prod.yml`, separate from the dev `docker-compose.yml`, running a `db` service (PostgreSQL 18), the one-shot `migrate` service, the `app` service built from the `Dockerfile`, and `pgadmin`, without depending on another compose file or a pre-existing external network. Only the app and pgadmin ports SHALL be published, never the database port. The stack SHALL NOT include local tracker instances.

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
In the production stack, `migrate` SHALL wait for the `db` healthcheck before applying migrations, and `app` SHALL start only after `migrate` completes successfully. The stack SHALL require `NUXT_SESSION_PASSWORD`, `POSTGRES_PASSWORD` and `PGADMIN_DEFAULT_PASSWORD` (no insecure defaults) and SHALL provide overridable defaults for the database user and name, the pgadmin e-mail, and the published ports.

#### Scenario: Ordered cold start
- **WHEN** the production stack starts from scratch
- **THEN** `migrate` runs only after the database healthcheck passes, and `app` starts only after `migrate` exits with status 0

#### Scenario: Missing session secret fails fast
- **WHEN** the stack is started with any of `NUXT_SESSION_PASSWORD`, `POSTGRES_PASSWORD`, or `PGADMIN_DEFAULT_PASSWORD` unset or empty
- **THEN** compose refuses to start the stack and the error names the missing variable

#### Scenario: Defaults are overridable
- **WHEN** the user overrides the published ports, database user, or database name via environment variables (e.g. an `.env` file)
- **THEN** the stack uses the overridden values without editing the compose file

### Requirement: REQ-346 Single environment example grouped by audience
The repository SHALL commit one `.env.example`, grouped into host development, dev compose overrides and the production stack, with every variable documented where it is read. Copied unchanged to `.env`, it SHALL run `pnpm dev` against the dev database on `localhost`. Production-only secrets (`POSTGRES_PASSWORD`, `PGADMIN_DEFAULT_PASSWORD`) SHALL appear only commented out with generation hints, and the development `NUXT_SESSION_PASSWORD` SHALL be marked as not for production.

#### Scenario: Dev example works unchanged
- **WHEN** a developer copies `.env.example` to `.env`, starts the dev compose stack, and runs `pnpm db:migrate` then `pnpm dev`
- **THEN** the app starts and connects to the dev database without editing any value

#### Scenario: Unedited example does not start the production stack
- **WHEN** a self-hoster copies `.env.example` to `.env` without uncommenting the production secrets and starts the production stack
- **THEN** the stack refuses to start and names the first missing variable

#### Scenario: Example is committed, real env files are not
- **WHEN** the repository is inspected
- **THEN** `.env.example` is tracked while `.env` and every other `.env.*` file are git-ignored

### Requirement: REQ-354 Optional runtime log level variable
The production compose stack SHALL pass an optional `CONSOLA_LEVEL` environment variable to the application container, defaulting to the `info` level when unset, so the server's log verbosity (core-logging REQ-357) can be raised for troubleshooting without rebuilding the image. `.env.example` SHALL document the variable, its accepted values and the default in the production section (REQ-346). The variable SHALL be optional: the stack SHALL start without it.

#### Scenario: Stack starts without the variable
- **WHEN** the production stack is started with `.env` not defining `CONSOLA_LEVEL`
- **THEN** the application starts and logs at the `info` level

#### Scenario: Raising verbosity without a rebuild
- **WHEN** a self-hoster sets `CONSOLA_LEVEL` to the `debug` level in `.env` and restarts only the `app` service
- **THEN** the container logs include debug output (including database statements) without the image being rebuilt
