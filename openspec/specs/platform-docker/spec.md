# platform-docker Specification

## Purpose

Defines how OSI Time Tracker is packaged with Docker: the application and migrator images, their runtime configuration, the health endpoint, the committed environment example, and migrations applied before the app serves traffic.

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
The application container SHALL be configured entirely through environment variables and MUST require `DATABASE_URL` and `NUXT_APP_SECRET` at runtime, without baking secrets into the image. The image SHALL fix both `NODE_ENV=production` and the container listening port (`3000`). The container SHALL run as a non-root user.

#### Scenario: App starts with required configuration
- **WHEN** the container is started with valid `DATABASE_URL` and `NUXT_APP_SECRET`
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

### Requirement: REQ-528 Environment example for local development
The repository SHALL commit one environment example, grouped into host development and dev compose overrides, with every variable documented where it is read. Copied unchanged, it SHALL run the app from source against the dev database on `localhost`.

#### Scenario: Dev example works unchanged
- **WHEN** a developer copies the example to the real environment file, starts the dev compose stack, applies migrations and starts the app from source
- **THEN** the app starts and connects to the dev database without editing any value

#### Scenario: Example is committed, real env files are not
- **WHEN** the repository is inspected
- **THEN** the environment example is tracked while every real environment file is git-ignored

### Requirement: REQ-529 Health endpoint reports database health and the running build
`GET /healthz` SHALL answer `200` with `{ commit }` while the database answers, without requiring a session. `commit` SHALL be the Git commit the running image was built from, or `dev` when the build named none. While the database does not answer, the endpoint SHALL answer `503` using the API error contract.

#### Scenario: Healthy instance
- **WHEN** a client requests `GET /healthz` without a session and the database answers
- **THEN** the response SHALL be `200` with the `commit` the image was built from

#### Scenario: Build without a commit
- **WHEN** the running image was built without naming a commit
- **THEN** `GET /healthz` SHALL report `commit` as `dev`

#### Scenario: Database unavailable
- **WHEN** a client requests `GET /healthz` and the database does not answer
- **THEN** the response SHALL be `503` with a `messageKey` and SHALL NOT include `commit`
