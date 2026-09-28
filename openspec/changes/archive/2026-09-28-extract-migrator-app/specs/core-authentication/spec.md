## MODIFIED Requirements

### Requirement: REQ-012 Env-var bootstrap user
The system SHALL seed an initial user from the `BOOTSTRAP_USER_EMAIL` and `BOOTSTRAP_USER_PASSWORD` environment variables during the dedicated migrate step, so MVP login is usable before self-registration exists. The password SHALL be stored only as a hash in the format the application's login verification accepts, and SHALL NOT be logged. The email SHALL be trimmed and stored normalized to lowercase. Seeding SHALL be idempotent: it SHALL skip silently when either variable is unset or empty, SHALL skip when a user with that email already exists, and SHALL NOT overwrite or reset an existing user's password.

#### Scenario: Fresh database with variables set creates the user
- **WHEN** the migrate step runs against a database with no matching user and both `BOOTSTRAP_USER_EMAIL` and `BOOTSTRAP_USER_PASSWORD` are set
- **THEN** the system SHALL insert a user with a lowercased email and a hashed password

#### Scenario: Seeded user can log in
- **WHEN** the migrate step has seeded the bootstrap user and that user submits the bootstrap email (in any letter case) and password to the login endpoint
- **THEN** the login SHALL succeed and establish a session

#### Scenario: Existing user is left untouched
- **WHEN** the migrate step runs and a user with the bootstrap email already exists
- **THEN** the system SHALL skip seeding and SHALL NOT modify the existing user's password

#### Scenario: Unset variables skip silently
- **WHEN** the migrate step runs and `BOOTSTRAP_USER_EMAIL` or `BOOTSTRAP_USER_PASSWORD` is unset
- **THEN** the system SHALL skip seeding without error

#### Scenario: Password never appears in output
- **WHEN** the migrate step seeds the bootstrap user at any log verbosity
- **THEN** neither the plaintext password nor its hash SHALL appear in the migrator's output
