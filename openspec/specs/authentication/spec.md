# authentication Specification

## Purpose
TBD - created by archiving change add-authentication. Update Purpose after archive.
## Requirements
### Requirement: REQ-AUTH-001 Session-cookie authentication via nuxt-auth-utils
The application SHALL authenticate users with a server-side session represented by a sealed cookie issued through `nuxt-auth-utils`. The session cookie MUST be `HttpOnly`, MUST be `Secure` in production, and MUST use `SameSite=Lax`. The cookie sealing password SHALL be provided via the `NUXT_SESSION_PASSWORD` environment variable (32+ characters), and startup SHALL fail fast if it is missing in production.

**Status**: Not met
**Evidence** — none

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
The application SHALL expose a login endpoint that establishes a session via `setUserSession` and a logout endpoint that clears it via `clearUserSession`. Logout SHALL invalidate the session immediately so subsequent requests are unauthenticated. Credential verification against persisted users is out of scope for this change.

**Status**: Not met
**Evidence** — none

#### Scenario: Successful login establishes a session
- **WHEN** a client posts valid login input to the login endpoint
- **THEN** the server SHALL set a sealed session cookie and respond indicating the user is authenticated

#### Scenario: Logout clears the session
- **WHEN** an authenticated client calls the logout endpoint
- **THEN** the server SHALL clear the session cookie and subsequent requests SHALL be unauthenticated

### Requirement: REQ-AUTH-003 Protection of private endpoints
Endpoints that read or mutate user-scoped data SHALL require an authenticated session. Requests without a valid session SHALL be rejected with an unauthorized (401) response and SHALL NOT perform the requested action.

**Status**: Not met
**Evidence** — none

#### Scenario: Unauthenticated access is rejected
- **WHEN** a request without a valid session targets a protected endpoint
- **THEN** the server SHALL respond with HTTP 401 and SHALL NOT perform the action

#### Scenario: Authenticated access is allowed
- **WHEN** a request with a valid session targets a protected endpoint
- **THEN** the server SHALL allow the action to proceed for that user

### Requirement: REQ-AUTH-004 Client login-state detection
The client SHALL be able to determine whether a user is logged in via `useUserSession` (`loggedIn` / `user`) so the UI can render authenticated vs. unauthenticated states.

**Status**: Not met
**Evidence** — none

#### Scenario: UI reflects logged-in state
- **WHEN** a user has a valid session
- **THEN** `useUserSession().loggedIn` SHALL be `true` and the session user SHALL be available to the UI

#### Scenario: UI reflects logged-out state
- **WHEN** no valid session exists
- **THEN** `useUserSession().loggedIn` SHALL be `false`

### Requirement: REQ-AUTH-005 Fixed session lifetime
Sessions SHALL use a fixed maximum age configured via `runtimeConfig.session.maxAge`. Sliding/renew-on-activity expiry SHALL NOT be implemented in this change.

**Status**: Not met
**Evidence** — none

#### Scenario: Session expires after fixed lifetime
- **WHEN** the configured `maxAge` has elapsed since the session cookie was issued
- **THEN** the cookie SHALL be considered expired and the request SHALL be unauthenticated

### Requirement: REQ-NFR-014 CSRF protection and security headers via nuxt-security
The application SHALL protect state-changing requests against CSRF and SHALL apply baseline security response headers using `nuxt-security`. CSRF validation SHALL apply to mutating HTTP methods (POST/PUT/PATCH/DELETE), and requests failing CSRF validation SHALL be rejected without performing the action.

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

