# authentication Specification

## Purpose
Define how the application authenticates users and protects server-side resources. Authentication is based on a sealed, server-side session cookie issued via `nuxt-auth-utils`, with email/password login, timing-safe and non-enumerating credential verification, logout, fixed-lifetime sessions, and client-side login-state detection. It also covers protection of private endpoints, CSRF protection, baseline security headers, login rate limiting via `nuxt-security`, and an environment-variable bootstrap user so MVP login is usable before self-registration exists.
## Requirements
### Requirement: REQ-AUTH-001 Session-cookie authentication via nuxt-auth-utils
The application SHALL authenticate users with a server-side session represented by a sealed cookie issued through `nuxt-auth-utils`. The session cookie MUST be `HttpOnly`, MUST be `Secure` in production, and MUST use `SameSite=Lax`. The cookie sealing password SHALL be provided via the `NUXT_SESSION_PASSWORD` environment variable (32+ characters), and startup SHALL fail fast if it is missing in production.

#### Scenario: Authenticated request is recognized
- **WHEN** a request arrives carrying a valid, unexpired session cookie
- **THEN** the server SHALL treat the request as authenticated and expose the session via `requireUserSession` / `getUserSession`

#### Scenario: Missing session password in production
- **WHEN** the application starts in production and `NUXT_SESSION_PASSWORD` is not set
- **THEN** startup SHALL fail fast with a clear error rather than issuing unsealed or insecure sessions

#### Scenario: Tampered or invalid cookie
- **WHEN** a request presents a session cookie that fails seal verification
- **THEN** the server SHALL treat the request as unauthenticated

### Requirement: REQ-AUTH-002 Login and logout endpoints
The application SHALL expose a login endpoint that establishes a session via `setUserSession` and a logout endpoint that clears it via `clearUserSession`. Logout SHALL invalidate the session immediately so subsequent requests are unauthenticated. Login SHALL accept an **email** and **password** (the prior `username` field is removed); the email SHALL be normalized to lowercase (`email.trim().toLowerCase()`) before lookup. Login SHALL look up the user by normalized email and SHALL verify the supplied password against the stored `passwordHash` using `nuxt-auth-utils` `verifyPassword`. Invalid credentials SHALL return an error and SHALL NOT establish a session. Authentication failure SHALL be timing-safe and non-enumerating: when the email is unknown, the server SHALL verify the password against a dummy hash so that "unknown email" and "wrong password" are indistinguishable in response and timing. On success the session payload SHALL contain `{ id, email, displayName }`, where `id` is the durable per-user scope key and `displayName` MAY be null.

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

### Requirement: REQ-AUTH-003 Protection of private endpoints
Endpoints that read or mutate user-scoped data SHALL require an authenticated session. Requests without a valid session SHALL be rejected with an unauthorized (401) response and SHALL NOT perform the requested action.

#### Scenario: Unauthenticated access is rejected
- **WHEN** a request without a valid session targets a protected endpoint
- **THEN** the server SHALL respond with HTTP 401 and SHALL NOT perform the action

#### Scenario: Authenticated access is allowed
- **WHEN** a request with a valid session targets a protected endpoint
- **THEN** the server SHALL allow the action to proceed for that user

### Requirement: REQ-AUTH-004 Client login-state detection
The client SHALL be able to determine whether a user is logged in via `useUserSession` (`loggedIn` / `user`) so the UI can render authenticated vs. unauthenticated states.

#### Scenario: UI reflects logged-in state
- **WHEN** a user has a valid session
- **THEN** `useUserSession().loggedIn` SHALL be `true` and the session user SHALL be available to the UI

#### Scenario: UI reflects logged-out state
- **WHEN** no valid session exists
- **THEN** `useUserSession().loggedIn` SHALL be `false`

### Requirement: REQ-AUTH-005 Fixed session lifetime
Sessions SHALL use a fixed maximum age configured via `runtimeConfig.session.maxAge`. Sliding/renew-on-activity expiry SHALL NOT be implemented in this change.

#### Scenario: Session expires after fixed lifetime
- **WHEN** the configured `maxAge` has elapsed since the session cookie was issued
- **THEN** the cookie SHALL be considered expired and the request SHALL be unauthenticated

### Requirement: REQ-NFR-014 CSRF protection, security headers, and login rate limiting via nuxt-security
The application SHALL protect state-changing requests against CSRF and SHALL apply baseline security response headers using `nuxt-security`. CSRF validation SHALL apply to mutating HTTP methods (POST/PUT/PATCH/DELETE), and requests failing CSRF validation SHALL be rejected without performing the action. Additionally, `POST /api/auth/login` SHALL enforce a stricter rate limit than the global default to mitigate brute-force attacks (OWASP / NFR 8.3), implemented via the `nuxt-security` `rateLimiter` as a per-route override.

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

### Requirement: REQ-AUTH-006 Env-var bootstrap user
The system SHALL seed an initial user from the `BOOTSTRAP_USER_EMAIL` and `BOOTSTRAP_USER_PASSWORD` environment variables during the dedicated migrate step, so MVP login is usable before self-registration exists. The password SHALL be hashed with `hashPassword` before insert and SHALL NOT be logged. The email SHALL be stored normalized to lowercase. Seeding SHALL be idempotent: it SHALL skip silently when the variables are unset, SHALL skip when a user with that email already exists, and SHALL NOT overwrite or reset an existing user's password.

#### Scenario: Fresh database with variables set creates the user
- **WHEN** the migrate step runs against a database with no matching user and both `BOOTSTRAP_USER_EMAIL` and `BOOTSTRAP_USER_PASSWORD` are set
- **THEN** the system SHALL insert a user with a lowercased email and a hashed password

#### Scenario: Existing user is left untouched
- **WHEN** the migrate step runs and a user with the bootstrap email already exists
- **THEN** the system SHALL skip seeding and SHALL NOT modify the existing user's password

#### Scenario: Unset variables skip silently
- **WHEN** the migrate step runs and `BOOTSTRAP_USER_EMAIL` or `BOOTSTRAP_USER_PASSWORD` is unset
- **THEN** the system SHALL skip seeding without error
