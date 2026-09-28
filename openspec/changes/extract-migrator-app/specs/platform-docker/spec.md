## MODIFIED Requirements

### Requirement: REQ-043 Multi-stage production image build
The system SHALL provide a `Dockerfile` that builds the application in stages: a build stage that installs the web application's dependencies with the project toolchain and runs the Nuxt production build, and a final runtime stage that contains only the artifacts required to run the application in production. The same `Dockerfile` SHALL also produce the dedicated migrator image (REQ-048) as a separately addressable target, while building the application runtime image by default.

#### Scenario: Successful image build
- **WHEN** `docker build` is run against the repository root without selecting a target
- **THEN** the build installs dependencies, executes `nuxt build`, and completes successfully producing a runnable application image

#### Scenario: Build fails fast on broken build
- **WHEN** the Nuxt production build fails during image build
- **THEN** the `docker build` command exits non-zero and no runtime image is produced

#### Scenario: Migrator image is built from the same Dockerfile
- **WHEN** `docker build` is run against the repository root selecting the migrator target
- **THEN** it produces the migrator image without running the Nuxt production build

### Requirement: REQ-048 Database migrations before serving traffic
Pending database migrations SHALL be applied before the production application begins serving traffic, via a dedicated one-shot `migrate` compose service.

The `migrate` service is a short-lived container (not a long-running service) that runs the migrator exactly once and then exits. It SHALL run the dedicated migrator image (REQ-043), which contains only the Node runtime, the bundled migration runner and the committed SQL migrations. That image MUST NOT contain a package manager, the build toolchain, development dependencies, or web application sources. The service connects to the same database over the shared network, applies any pending SQL migrations, and runs the bootstrap-user seeding (core-authentication REQ-012). The `app` service declares `depends_on` the `migrate` service with `condition: service_completed_successfully`, so the app container is only started after the `migrate` container has exited with a zero (success) status code.

#### Scenario: Migrations applied on startup
- **WHEN** the production stack starts with pending migrations
- **THEN** the one-shot `migrate` service applies them to completion, exits successfully, and only then does the `app` service start and accept requests

#### Scenario: Startup blocked on migration failure
- **WHEN** the one-shot `migrate` service exits with a non-zero status
- **THEN** the `app` service SHALL NOT start (its `service_completed_successfully` condition is unmet) and the failure is surfaced in container logs

#### Scenario: Missing database configuration
- **WHEN** the migrator image is started without `DATABASE_URL`
- **THEN** it SHALL exit non-zero with a clear error naming the missing variable, without attempting a connection

#### Scenario: Migrator image carries no build tooling
- **WHEN** the migrator image is inspected
- **THEN** it contains the Node runtime, the bundled runner and the SQL migrations, and does not contain a package manager, `node_modules`, the build toolchain, or web application sources
