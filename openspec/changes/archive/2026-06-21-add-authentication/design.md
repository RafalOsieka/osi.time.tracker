## Context

OSI Time Tracker is an early-MVP Nuxt 4 + PrimeVue app with a Drizzle/PostgreSQL persistence layer but no authentication. NFR 8.3 calls for "secure session cookies, HTTPS enforced" and NFR 8.7 requires strict per-user data isolation, both of which depend on a working auth mechanism. WBS 1.1 (Login / logout) is the only 🔴 MVP authentication item. This change introduces the minimal, secure session foundation; user storage and credential persistence are intentionally deferred (WBS 1.2+).

The decision direction was settled during prior exploration: a server-side session cookie (over JWT-in-localStorage) for XSS resistance and instant revocation, with CSRF protection layered on because cookies are auto-sent by the browser.

## Goals / Non-Goals

**Goals:**
- Provide a sealed, `HttpOnly`, `Secure`, `SameSite=Lax` session cookie via `nuxt-auth-utils`.
- Provide login/logout endpoints and a way to protect server routes.
- Let the client detect login state (`useUserSession`).
- Add CSRF protection and baseline security headers (CSP) via `nuxt-security`.
- Keep session lifetime fixed and simple for the MVP.

**Non-Goals:**
- Persisted users, registration, password reset, profile, 2FA, SSO.
- Sliding/"remember me" expiry.
- JWT / stateless tokens.
- Exhaustive CSP/rate-limit tuning beyond enabling sensible defaults.

## Decisions

### D1: Session cookies via `nuxt-auth-utils` (vs hand-rolled / DB-backed sessions)
`nuxt-auth-utils` provides `useUserSession`, `setUserSession`, `clearUserSession`, and `requireUserSession` with a sealed `HttpOnly` cookie out of the box — minimal code, aligned with NFR 8.3.
- *Alternative — DB-backed session table:* enables server-side revocation lists and ties to data isolation, but adds schema + storage work not needed for MVP. The sealed cookie already supports instant logout via `clearUserSession`. Revisit when multi-device revocation is required.
- *Alternative — hand-rolled Nitro cookies:* maximum control, more to maintain and easier to get wrong security-wise. Rejected for MVP.

### D2: CSRF + security headers via `nuxt-security` (vs `nuxt-csurf`)
`nuxt-security` provides CSRF token handling plus CSP, CORS, and rate limiting in one module. Chosen over the narrower `nuxt-csurf` because NFR 8.3 also requires CSP headers and rate limiting, so a single module reduces future churn.
- *Alternative — `nuxt-csurf`:* lighter, CSRF-only; would require adding more modules later for CSP/rate limiting. Rejected to avoid duplicate wiring.
- `SameSite=Lax` on the session cookie remains the first CSRF layer; `nuxt-security` adds the explicit token as defense-in-depth.

### D3: Fixed session lifetime (vs sliding expiry)
Use `runtimeConfig.session.maxAge` for a fixed lifetime. Sliding renewal is not first-class in `nuxt-auth-utils` (known issue where re-issuing the cookie does not reset expiry within the same request), so it is deferred to keep the MVP simple.

### D4: Secrets and config
`NUXT_SESSION_PASSWORD` (32+ chars) seals the cookie and is documented in `.env.example`. Modules and session/security options are registered in `nuxt.config.ts`. `Secure` cookies + HTTPS are required in production.

## Risks / Trade-offs

- **No server-side revocation list (sealed cookie)** → Mitigation: logout clears the cookie; short fixed `maxAge`; add a DB session/denylist post-MVP if multi-device revocation is needed.
- **`nuxt-security` is heavier and its defaults (CSP) can break assets/3rd-party calls** → Mitigation: start with permissive-but-safe CSP, verify the app loads, tighten iteratively.
- **CSRF token must be sent by the frontend on mutations** → Mitigation: use the module's provided fetch helper/composable and document the pattern; cover with an e2e test.
- **Module interplay (auth-utils + security) misconfiguration** → Mitigation: add tests asserting 401 on unauthenticated protected routes and rejection of missing-CSRF mutations.
- **PWA/offline (WBS 8.1) cannot refresh server sessions offline** → Mitigation: out of scope here; note as a constraint for the offline design.

## Open Questions (resolved)

- `[RESOLVED]` Exact `maxAge` value → **1 week** (`60 * 60 * 24 * 7` seconds), set in `runtimeConfig.session.maxAge`.
- `[RESOLVED]` `SameSite` choice → **`Strict`** (chosen over `Lax` for stronger CSRF defense-in-depth), set on the session cookie.
- `[RESOLVED]` `nuxt-security` rate limiting → **deferred** to a dedicated NFR change; this change enables CSRF + baseline headers/CSP only.
