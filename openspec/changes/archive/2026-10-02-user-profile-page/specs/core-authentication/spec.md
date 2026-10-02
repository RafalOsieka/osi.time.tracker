## MODIFIED Requirements

### Requirement: REQ-007 Login and logout endpoints
The application SHALL expose a login endpoint that establishes a session via `setUserSession` and a logout endpoint that clears it via `clearUserSession`. Logout SHALL invalidate the session immediately so subsequent requests are unauthenticated. Login SHALL accept an **email** and **password** (the prior `username` field is removed); the email SHALL be normalized to lowercase (`email.trim().toLowerCase()`) before lookup. Login SHALL look up the user by normalized email and SHALL verify the supplied password against the stored `passwordHash` using `nuxt-auth-utils` `verifyPassword`. Invalid credentials SHALL return an error and SHALL NOT establish a session. Authentication failure SHALL be timing-safe and non-enumerating: when the email is unknown, the server SHALL verify the password against a dummy hash so that "unknown email" and "wrong password" are indistinguishable in response and timing. On success the session payload SHALL contain `{ id, email, displayName }` plus the user's settings (workspace-settings REQ-398), where `id` is the durable per-user scope key and `displayName` is the user's non-empty display name (workspace-settings REQ-397). Session cookies issued before `displayName` and the timezone became required SHALL NOT authenticate, so every session in use carries both fields.

#### Scenario: Valid email and password logs in
- **WHEN** a client posts an email and password matching a stored user (after lowercase normalization)
- **THEN** the server SHALL verify the password, set a sealed session cookie with payload `{ id, email, displayName }` plus settings carrying a non-null timezone, and respond indicating the user is authenticated

#### Scenario: Wrong password is rejected
- **WHEN** a client posts a known email with an incorrect password
- **THEN** the server SHALL reject the request, SHALL NOT establish a session, and SHALL return a generic invalid-credentials error

#### Scenario: Unknown email is rejected indistinguishably
- **WHEN** a client posts an email that matches no stored user
- **THEN** the server SHALL verify against a dummy hash and SHALL return the same generic error and comparable timing as a wrong-password failure, without establishing a session

#### Scenario: Email match is case-insensitive
- **WHEN** a client posts an email differing only in letter case from the stored (lowercased) email
- **THEN** the server SHALL normalize the input to lowercase, match the stored user, and authenticate successfully with a correct password

#### Scenario: Logout clears the session
- **WHEN** an authenticated client calls the logout endpoint
- **THEN** the server SHALL clear the session cookie and subsequent requests SHALL be unauthenticated

#### Scenario: Pre-change session is not accepted
- **WHEN** a request carries only a session cookie issued before this change
- **THEN** the request SHALL be treated as unauthenticated, so protected pages redirect to `/login` and protected API routes respond with HTTP 401

### Requirement: REQ-012 Env-var bootstrap user
The system SHALL seed an initial user from environment variables during the dedicated migrate step, so MVP login is usable before self-registration exists. `BOOTSTRAP_USER_EMAIL` and `BOOTSTRAP_USER_PASSWORD` SHALL be required for seeding. `BOOTSTRAP_USER_DISPLAY_NAME` SHALL be optional: it is trimmed, and when it is unset or empty it defaults to the email local part. `BOOTSTRAP_USER_TIMEZONE` SHALL be optional and SHALL default to `UTC`. The password SHALL be stored only as a hash in the format the application's login verification accepts, and SHALL NOT be logged. The email SHALL be trimmed and stored normalized to lowercase.

When seeding is enabled and `BOOTSTRAP_USER_TIMEZONE` is neither `UTC` nor a member of `Intl.supportedValuesOf('timeZone')`, or the display name exceeds the workspace-settings REQ-397 limit, the migrate step SHALL fail with a non-zero exit before applying migrations or seeding, and SHALL name the offending variable. Seeding SHALL be idempotent: it SHALL skip silently when the email or password variable is unset or empty, SHALL skip when a user with that email already exists, and SHALL NOT overwrite an existing user's password, display name, or timezone.

#### Scenario: Fresh database with variables set creates the user
- **WHEN** the migrate step runs against a database with no matching user and `BOOTSTRAP_USER_EMAIL`, `BOOTSTRAP_USER_PASSWORD`, `BOOTSTRAP_USER_DISPLAY_NAME=Jan Kowalski`, and `BOOTSTRAP_USER_TIMEZONE=Europe/Warsaw` are set
- **THEN** the system SHALL insert a user with a lowercased email, a hashed password, display name `Jan Kowalski`, and timezone `Europe/Warsaw`

#### Scenario: Optional variables default
- **WHEN** the migrate step seeds `Admin@Example.com` with neither `BOOTSTRAP_USER_DISPLAY_NAME` nor `BOOTSTRAP_USER_TIMEZONE` set
- **THEN** the seeded user SHALL have display name `admin` and timezone `UTC`

#### Scenario: Invalid timezone fails the migrate step
- **WHEN** the migrate step runs with seeding enabled and `BOOTSTRAP_USER_TIMEZONE=Mars/Olympus`
- **THEN** the migrate step SHALL exit non-zero with an error naming `BOOTSTRAP_USER_TIMEZONE`, and SHALL apply no migrations and insert no user

#### Scenario: Too-long display name fails the migrate step
- **WHEN** the migrate step runs with seeding enabled and a `BOOTSTRAP_USER_DISPLAY_NAME` longer than 100 characters after trimming
- **THEN** the migrate step SHALL exit non-zero with an error naming `BOOTSTRAP_USER_DISPLAY_NAME`, and SHALL apply no migrations and insert no user

#### Scenario: Seeded user can log in
- **WHEN** the migrate step has seeded the bootstrap user and that user submits the bootstrap email (in any letter case) and password to the login endpoint
- **THEN** the login SHALL succeed and establish a session carrying the seeded display name and timezone

#### Scenario: Existing user is left untouched
- **WHEN** the migrate step runs and a user with the bootstrap email already exists
- **THEN** the system SHALL skip seeding and SHALL NOT modify the existing user's password, display name, or timezone

#### Scenario: Unset variables skip silently
- **WHEN** the migrate step runs and `BOOTSTRAP_USER_EMAIL` or `BOOTSTRAP_USER_PASSWORD` is unset
- **THEN** the system SHALL skip seeding without error, even if `BOOTSTRAP_USER_TIMEZONE` is invalid

#### Scenario: Password never appears in output
- **WHEN** the migrate step seeds the bootstrap user at any log verbosity
- **THEN** neither the plaintext password nor its hash SHALL appear in the migrator's output
