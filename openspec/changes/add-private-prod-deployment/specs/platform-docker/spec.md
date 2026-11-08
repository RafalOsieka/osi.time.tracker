# Spec Delta

## ADDED Requirements

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

## REMOVED Requirements

### Requirement: REQ-049 Standalone daily-use compose stack
**Reason**: The project no longer ships a production stack for self-hosters. The single production instance is deployed from a private template that is not a product contract.
**Migration**: Build the images from the Dockerfile (REQ-043, REQ-426) and write your own stack.

### Requirement: REQ-050 Persistent state across restarts
**Reason**: It described the removed production stack.
**Migration**: A self-written stack owns its own persistence. Existing volumes are not touched.

### Requirement: REQ-051 Standalone startup ordering and configuration
**Reason**: It described the removed production stack. Migration ordering stays covered by REQ-048 and required runtime configuration by REQ-045.
**Migration**: A self-written stack follows REQ-048 and REQ-045.

### Requirement: REQ-346 Single environment example grouped by audience
**Reason**: The environment example has no production section once the production stack is gone, so its scenarios for production secrets no longer apply.
**Migration**: REQ-528 replaces it for local development.

### Requirement: REQ-354 Optional runtime log level variable
**Reason**: It described a pass-through in the removed production stack. The server's own log level behavior stays in `core-logging`.
**Migration**: Set the log level variable on the application container, as `core-logging` defines.
