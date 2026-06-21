## 1. Dependencies & Configuration

- [ ] 1.1 Add `nuxt-auth-utils` and `nuxt-security` to `package.json` and install via pnpm
- [ ] 1.2 Register both modules in `nuxt.config.ts`
- [ ] 1.3 Configure session: `runtimeConfig.session.maxAge` (fixed) and cookie `sameSite: 'lax'`, `httpOnly`, `secure` (prod)
- [ ] 1.4 Configure `nuxt-security` CSRF and baseline headers (CSP) options
- [ ] 1.5 Add `NUXT_SESSION_PASSWORD` to `.env.example` with guidance (32+ chars)
- [ ] 1.6 Verify `pnpm lint` and `pnpm build` pass with the new modules

## 2. Backend — Authentication

- [ ] 2.1 Implement login endpoint (`server/api/auth/login.post.ts`) that validates input and calls `setUserSession`
- [ ] 2.2 Implement logout endpoint (`server/api/auth/logout.post.ts`) that calls `clearUserSession`
- [ ] 2.3 Add a session/me endpoint (`server/api/auth/session.get.ts`) returning current login state
- [ ] 2.4 Add a route-protection utility/middleware using `requireUserSession` for private endpoints
- [ ] 2.5 Add a sample protected endpoint to demonstrate/verify 401 behavior

## 3. Backend — Tests

- [ ] 3.1 Integration test: login endpoint sets a session cookie (happy path) and rejects invalid input (error path)
- [ ] 3.2 Integration test: logout clears the session; subsequent request is unauthenticated
- [ ] 3.3 Integration test: protected endpoint returns 401 without a session and succeeds with a valid session
- [ ] 3.4 Integration test: mutating request without a valid CSRF token is rejected; with a valid token it succeeds
- [ ] 3.5 Test: responses include baseline security headers (incl. CSP)

## 4. Frontend — Login State & Flow

- [ ] 4.1 Use `useUserSession` to expose `loggedIn`/`user` to the UI (composable usage / wrapper if needed)
- [ ] 4.2 Add a minimal login form/page that posts to the login endpoint using the CSRF-aware fetch helper
- [ ] 4.3 Add logout action that calls the logout endpoint and updates login state
- [ ] 4.4 Conditionally render authenticated vs. unauthenticated UI based on `loggedIn`

## 5. Frontend — Tests

- [ ] 5.1 E2E test: login flow logs the user in and UI reflects logged-in state
- [ ] 5.2 E2E test: logout flow logs the user out and UI reflects logged-out state
- [ ] 5.3 Unit test: any non-UI login-state helper/wrapper logic

## 6. Documentation

- [ ] 6.1 Update `AGENTS.md` (Technology + commands/env) to note auth modules and `NUXT_SESSION_PASSWORD`
- [ ] 6.2 Resolve open questions (`maxAge` value, `SameSite` choice) and record the decision
