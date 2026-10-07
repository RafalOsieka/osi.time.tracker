# core-authentication Specification

## Purpose
How users sign in and how private resources are protected: email and password login, sealed fixed-lifetime session cookies, CSRF protection and security headers, login throttling, and a bootstrap user seeded from environment variables.

## Requirements

### Requirement: REQ-006 Session-cookie authentication
The application SHALL authenticate users with a server-side session represented by a sealed cookie. The session cookie MUST be `HttpOnly`, MUST be `Secure` in production, and MUST use `SameSite=Lax`. The cookie sealing password SHALL be provided via the `NUXT_SESSION_PASSWORD` environment variable (32+ characters), and startup SHALL fail fast if it is missing in production.

#### Scenario: Authenticated request is recognized
- **WHEN** a request arrives carrying a valid, unexpired session cookie
- **THEN** the server SHALL treat the request as authenticated and expose its session user to the request

#### Scenario: Missing session password in production
- **WHEN** the application starts in production and `NUXT_SESSION_PASSWORD` is not set
- **THEN** startup SHALL fail fast with a clear error rather than issuing unsealed or insecure sessions

#### Scenario: Tampered or invalid cookie
- **WHEN** a request presents a session cookie that fails seal verification
- **THEN** the server SHALL treat the request as unauthenticated

### Requirement: REQ-007 Login and logout endpoints
The application SHALL expose a login endpoint that establishes a session and a logout endpoint that clears it. Logout SHALL invalidate the session immediately so subsequent requests are unauthenticated. Login SHALL accept an **email** and **password**; the email SHALL be trimmed and lowercased before the user is looked up, and the password SHALL be verified against the stored password hash. Invalid credentials SHALL return an error and SHALL NOT establish a session.

#### Scenario: Valid email and password logs in
- **WHEN** a client posts an email and password matching a stored user (after lowercase normalization)
- **THEN** the server SHALL verify the password, set a sealed session cookie with payload `{ id, email, displayName }` plus settings carrying a non-null timezone, and respond indicating the user is authenticated

#### Scenario: Email match is case-insensitive
- **WHEN** a client posts an email differing only in letter case from the stored (lowercased) email
- **THEN** the server SHALL normalize the input to lowercase, match the stored user, and authenticate successfully with a correct password

#### Scenario: Logout clears the session
- **WHEN** an authenticated client calls the logout endpoint
- **THEN** the server SHALL clear the session cookie and subsequent requests SHALL be unauthenticated

### Requirement: REQ-423 Failed logins are timing-safe and non-enumerating
A failed login SHALL NOT reveal whether the email exists. When the email is unknown, the server SHALL verify the password against a dummy hash, so "unknown email" and "wrong password" return the same generic invalid-credentials error with comparable timing.

#### Scenario: Wrong password is rejected
- **WHEN** a client posts a known email with an incorrect password
- **THEN** the server SHALL reject the request, SHALL NOT establish a session, and SHALL return a generic invalid-credentials error

#### Scenario: Unknown email is rejected indistinguishably
- **WHEN** a client posts an email that matches no stored user
- **THEN** the server SHALL verify against a dummy hash and SHALL return the same generic error and comparable timing as a wrong-password failure, without establishing a session

### Requirement: REQ-424 Session payload carries identity and settings
A session SHALL carry `{ id, email, displayName }` plus the user's settings (workspace-settings REQ-398), where `id` is the durable per-user scope key and `displayName` is the user's non-empty display name (workspace-settings REQ-397). Only a session under the current cookie name whose payload carries both the display name and the timezone SHALL authenticate; a cookie under the former `nuxt-session` name SHALL NOT.

#### Scenario: Session from an older cookie is not accepted
- **WHEN** a request carries only a session cookie under the former cookie name, or one whose payload lacks the display name or timezone
- **THEN** the request SHALL be treated as unauthenticated, so protected pages redirect to `/login` and protected API routes respond with HTTP 401

### Requirement: REQ-009 Client login-state detection
The client SHALL be able to determine whether a user is logged in and read the session user, so the UI can render authenticated vs. unauthenticated states.

#### Scenario: UI reflects logged-in state
- **WHEN** a user has a valid session
- **THEN** the client SHALL report the user as logged in and the session user SHALL be available to the UI

#### Scenario: UI reflects logged-out state
- **WHEN** no valid session exists
- **THEN** the client SHALL report the user as logged out

### Requirement: REQ-010 Fixed session lifetime
Sessions SHALL use a fixed, configured maximum age. Sessions SHALL NOT be renewed on activity (no sliding expiry).

#### Scenario: Session expires after fixed lifetime
- **WHEN** the configured maximum age has elapsed since the session cookie was issued
- **THEN** the cookie SHALL be considered expired and the request SHALL be unauthenticated

### Requirement: REQ-011 CSRF protection, security headers, and login rate limiting
The application SHALL protect state-changing requests against CSRF and SHALL apply baseline security response headers. CSRF validation SHALL apply to mutating HTTP methods (POST/PUT/PATCH/DELETE), and requests failing it SHALL be rejected without performing the action. `POST /api/auth/login` SHALL enforce a stricter rate limit than the global default to mitigate brute-force attacks (OWASP / NFR 8.3).

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

### Requirement: REQ-012 Env-var bootstrap user
The migrate step SHALL seed an initial user from environment variables. `BOOTSTRAP_USER_EMAIL` and `BOOTSTRAP_USER_PASSWORD` SHALL be required for seeding. `BOOTSTRAP_USER_DISPLAY_NAME` SHALL be optional, trimmed, and default to the email local part when unset or empty. `BOOTSTRAP_USER_TIMEZONE` SHALL be optional and default to `UTC`. The email SHALL be stored trimmed and lowercased. The password SHALL be stored only as a hash that login verification accepts, and SHALL NOT be logged.

#### Scenario: Fresh database with variables set creates the user
- **WHEN** the migrate step runs against a database with no matching user and `BOOTSTRAP_USER_EMAIL`, `BOOTSTRAP_USER_PASSWORD`, `BOOTSTRAP_USER_DISPLAY_NAME=Jan Kowalski`, and `BOOTSTRAP_USER_TIMEZONE=Europe/Warsaw` are set
- **THEN** the system SHALL insert a user with a lowercased email, a hashed password, display name `Jan Kowalski`, and timezone `Europe/Warsaw`

#### Scenario: Optional variables default
- **WHEN** the migrate step seeds `Admin@Example.com` with neither `BOOTSTRAP_USER_DISPLAY_NAME` nor `BOOTSTRAP_USER_TIMEZONE` set
- **THEN** the seeded user SHALL have display name `admin` and timezone `UTC`

#### Scenario: Seeded user can log in
- **WHEN** the migrate step has seeded the bootstrap user and that user submits the bootstrap email (in any letter case) and password to the login endpoint
- **THEN** the login SHALL succeed and establish a session carrying the seeded display name and timezone

#### Scenario: Password never appears in output
- **WHEN** the migrate step seeds the bootstrap user at any log verbosity
- **THEN** neither the plaintext password nor its hash SHALL appear in the migrator's output

### Requirement: REQ-425 Bootstrap seeding is validated and idempotent
When seeding is enabled and `BOOTSTRAP_USER_TIMEZONE` is neither `UTC` nor a supported IANA timezone, or the display name exceeds the workspace-settings REQ-397 limit, the migrate step SHALL exit non-zero before applying migrations or seeding, naming the offending variable. Seeding SHALL skip silently when the email or password variable is unset or empty, SHALL skip when a user with that email exists, and SHALL NOT overwrite an existing user's password, display name, or timezone.

#### Scenario: Invalid timezone fails the migrate step
- **WHEN** the migrate step runs with seeding enabled and `BOOTSTRAP_USER_TIMEZONE=Mars/Olympus`
- **THEN** the migrate step SHALL exit non-zero with an error naming `BOOTSTRAP_USER_TIMEZONE`, and SHALL apply no migrations and insert no user

#### Scenario: Too-long display name fails the migrate step
- **WHEN** the migrate step runs with seeding enabled and a `BOOTSTRAP_USER_DISPLAY_NAME` longer than 100 characters after trimming
- **THEN** the migrate step SHALL exit non-zero with an error naming `BOOTSTRAP_USER_DISPLAY_NAME`, and SHALL apply no migrations and insert no user

#### Scenario: Existing user is left untouched
- **WHEN** the migrate step runs and a user with the bootstrap email already exists
- **THEN** the system SHALL skip seeding and SHALL NOT modify the existing user's password, display name, or timezone

#### Scenario: Unset variables skip silently
- **WHEN** the migrate step runs and `BOOTSTRAP_USER_EMAIL` or `BOOTSTRAP_USER_PASSWORD` is unset
- **THEN** the system SHALL skip seeding without error, even if `BOOTSTRAP_USER_TIMEZONE` is invalid

### Requirement: REQ-013 Client-side validation of the login form
The login form SHALL validate credentials client-side with the same schema the server uses before submitting, so an empty email or password is caught without a request, showing the `errors.auth.credentialsRequired` key the server returns. The server SHALL stay authoritative. A failed server login SHALL render a translated form-level error announced to assistive technology, with both inputs marked `aria-invalid` and associated via `aria-describedby`.

#### Scenario: Empty credentials blocked client-side
- **WHEN** the user submits the login form with an empty email or password
- **THEN** the form SHALL show the `errors.auth.credentialsRequired` message and SHALL NOT send a request

#### Scenario: Failed server login shown as form-level error
- **WHEN** submitted credentials pass client-side validation but the server rejects them
- **THEN** the translated server error SHALL render as an announced form-level error and no session SHALL be established
