## Why

The app currently has no way to authenticate requests or know who is logged in, yet data isolation between users (NFR 8.7) and OWASP-aligned security (NFR 8.3) depend on it. WBS 1.1 (Login / logout) is the only 🔴 MVP item in Authentication & Identity, so a minimal, secure session mechanism is the foundation every other feature builds on.

## What Changes

- Introduce server-side session authentication using **`nuxt-auth-utils`**: a sealed, `HttpOnly`, `Secure`, `SameSite=Lax` session cookie with a **fixed** lifetime (`maxAge`, no sliding expiry for the MVP).
- Add login and logout server endpoints that establish and clear the session (`setUserSession` / `clearUserSession`); credential verification against stored users is out of scope here (no user storage yet).
- Protect mutating/private endpoints by requiring an authenticated session; unauthenticated requests are rejected.
- Add **CSRF protection** and baseline security headers via **`nuxt-security`** (chosen over `nuxt-csurf` to also cover CSP, rate limiting, and CORS needed by NFR 8.3 in future work).
- Expose login state to the client (`useUserSession`) so the UI can tell whether a user is logged in.
- Require `NUXT_SESSION_PASSWORD` (32+ chars) configuration and document it in `.env.example`.

## Capabilities

### New Capabilities
- `authentication`: Session-cookie based login/logout, request authentication, login-state detection, and CSRF/security-header protection for the app.

### Modified Capabilities
<!-- None: no existing capability's requirements change. -->

## Impact

- **Dependencies**: adds `nuxt-auth-utils` and `nuxt-security`.
- **Config**: `nuxt.config.ts` (register modules, session `maxAge`, security options); new `NUXT_SESSION_PASSWORD` env var in `.env.example`.
- **Server**: new `server/api` login/logout routes and route protection (middleware/utility).
- **Frontend**: login state available app-wide; mutating client requests must send the CSRF token.

## Non-goals

- User storage, registration, password reset, profile, 2FA, SSO (WBS 1.2–1.7) — not in this change.
- Sliding/"remember me" session renewal (not first-class in `nuxt-auth-utils` today).
- JWT / token-in-localStorage authentication.
- Full hardening of every NFR 8.3 item (CSP tuning, rate-limit policies) beyond enabling `nuxt-security` defaults.
