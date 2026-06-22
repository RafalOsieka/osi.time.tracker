## MODIFIED Requirements

### Requirement: REQ-AUTH-002 Login and logout endpoints
The application SHALL expose a login endpoint that establishes a session via `setUserSession` and a logout endpoint that clears it via `clearUserSession`. Logout SHALL invalidate the session immediately so subsequent requests are unauthenticated. Login SHALL accept an **email** and **password** (the prior `username` field is removed); the email SHALL be normalized to lowercase (`email.trim().toLowerCase()`) before lookup. Login SHALL look up the user by normalized email and SHALL verify the supplied password against the stored `passwordHash` using `nuxt-auth-utils` `verifyPassword`. Invalid credentials SHALL return an error and SHALL NOT establish a session. Authentication failure SHALL be timing-safe and non-enumerating: when the email is unknown, the server SHALL verify the password against a dummy hash so that "unknown email" and "wrong password" are indistinguishable in response and timing. On success the session payload SHALL contain `{ id, email, displayName }`, where `id` is the durable per-user scope key and `displayName` MAY be null.

**Status**: Not met
**Evidence** — none

#### Scenario: Valid email and password logs in
- **WHEN** a client posts an email and password matching a stored user (after lowercase normalization)
- **THEN** the server SHALL verify the password, set a sealed session cookie with payload `{ id, email, displayName }`, and respond indicating the user is authenticated

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

### Requirement: REQ-NFR-014 CSRF protection, security headers, and login rate limiting via nuxt-security
The application SHALL protect state-changing requests against CSRF and SHALL apply baseline security response headers using `nuxt-security`. CSRF validation SHALL apply to mutating HTTP methods (POST/PUT/PATCH/DELETE), and requests failing CSRF validation SHALL be rejected without performing the action. Additionally, `POST /api/auth/login` SHALL enforce a stricter rate limit than the global default to mitigate brute-force attacks (OWASP / NFR 8.3), implemented via the `nuxt-security` `rateLimiter` as a per-route override.

**Status**: Not met
**Evidence** — none

#### Scenario: Mutating request without valid CSRF token is rejected
- **WHEN** a state-changing request arrives without a valid CSRF token
- **THEN** the server SHALL reject the request and SHALL NOT perform the action

#### Scenario: Mutating request with valid CSRF token succeeds
- **WHEN** a state-changing request includes a valid CSRF token matching the issued token
- **THEN** CSRF validation SHALL pass and the request SHALL proceed

#### Scenario: Security headers present on responses
- **WHEN** the application serves a response
- **THEN** baseline security headers (including a Content-Security-Policy) SHALL be present

#### Scenario: Excessive login attempts are throttled
- **WHEN** a client exceeds the configured login rate limit on `POST /api/auth/login` within the configured interval
- **THEN** further attempts SHALL be rejected with a rate-limit response until the interval resets

#### Scenario: Normal login usage is unaffected
- **WHEN** a client makes login attempts within the configured limit
- **THEN** requests SHALL be processed normally without rate-limit rejection

## ADDED Requirements

### Requirement: REQ-AUTH-006 Env-var bootstrap user
The system SHALL seed an initial user from the `BOOTSTRAP_USER_EMAIL` and `BOOTSTRAP_USER_PASSWORD` environment variables during the dedicated migrate step, so MVP login is usable before self-registration exists. The password SHALL be hashed with `hashPassword` before insert and SHALL NOT be logged. The email SHALL be stored normalized to lowercase. Seeding SHALL be idempotent: it SHALL skip silently when the variables are unset, SHALL skip when a user with that email already exists, and SHALL NOT overwrite or reset an existing user's password.

**Status**: Not met
**Evidence** — none

#### Scenario: Fresh database with variables set creates the user
- **WHEN** the migrate step runs against a database with no matching user and both `BOOTSTRAP_USER_EMAIL` and `BOOTSTRAP_USER_PASSWORD` are set
- **THEN** the system SHALL insert a user with a lowercased email and a hashed password

#### Scenario: Existing user is left untouched
- **WHEN** the migrate step runs and a user with the bootstrap email already exists
- **THEN** the system SHALL skip seeding and SHALL NOT modify the existing user's password

#### Scenario: Unset variables skip silently
- **WHEN** the migrate step runs and `BOOTSTRAP_USER_EMAIL` or `BOOTSTRAP_USER_PASSWORD` is unset
- **THEN** the system SHALL skip seeding without error
