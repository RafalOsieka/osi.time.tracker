## 1. Data model & shared types

- [x] 1.1 Add `transportMode` (`direct` | `proxied`, default `direct`) to the remote-system-config Drizzle schema
- [x] 1.2 Generate a forward migration for `transportMode`, backfilling existing rows to `direct`
- [x] 1.3 Extend the shared `remote-system-config` boundary type/DTO and zod schema with `transportMode`
- [x] 1.4 Define shared boundary schemas/types for proxied search request (config id, mode, query) and adapter-neutral result
- [x] 1.5 Unit test the config zod schema: default `direct`, accept `proxied`, reject invalid `transportMode`

## 2. Backend — config endpoint

- [x] 2.1 Update remote-system-config create/upsert handler to validate and persist `transportMode`
- [x] 2.2 Integration test: create/upsert with `direct`, `proxied`, omitted (defaults `direct`), and invalid mode (422)

## 3. Backend — proxy endpoints

- [x] 3.1 Add shared server-side helper that builds the OpenProject request from a resolved base URL and forwarded secret and maps the response via the existing adapter mapping
- [x] 3.2 Implement the proxied title-search route: `requireAuth`, CSRF, resolve owned config server-side, validate input, forward, return adapter-neutral results
- [x] 3.3 Implement the proxied issue-ID lookup route with the same guards and exact-lookup semantics
- [x] 3.4 Map upstream outcomes (auth rejected, connection/timeout/DNS failure, not-found) to distinct `{ messageKey, params }` errors; never leak raw upstream body or the secret
- [x] 3.5 Enforce narrow scope: reject client-supplied target URLs and any non-search operation
- [x] 3.6 Integration test title-search route: happy path + invalid input (422) + missing credential header
- [x] 3.7 Integration test issue-ID route: happy path + not-found + foreign/unknown config (concealed)
- [x] 3.8 Integration test security: unauthenticated, missing CSRF, and cross-user config are rejected without contacting upstream
- [x] 3.9 Integration test error mapping: upstream 401 → auth messageKey; connection failure → connection messageKey; assert secret never appears in response

## 4. Frontend — transport selection

- [x] 4.1 Add a `transportMode` control (`direct` | `proxied`) to the remote-system-config form with i18n labels (en/pl parity)
- [x] 4.2 Update the search composable to branch by `transportMode`: `direct` keeps browser fetch; `proxied` calls the OSI proxy route with the forwarded secret header
- [x] 4.3 Ensure proxied requests reuse existing supersede/cancel and translated loading/empty/error states
- [x] 4.4 Unit test the composable transport branching and secret-header forwarding (mocked fetch)
- [x] 4.5 E2E test: configure a `proxied` Client and complete a title search + issue-ID link flow against a mocked tracker

## 5. Security, i18n & docs

- [x] 5.1 Add en/pl catalog entries for new transport labels and proxy error `messageKey`s, keeping strict parity
- [x] 5.2 Confirm CSP `connect-src` is not widened for proxied users and cover the resulting policy expectation
- [x] 5.3 Document VPN internal-DNS as a standalone-deployment consideration (e.g. `dns:` on the app service) in deployment docs
- [x] 5.4 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`, and the relevant test projects; ensure the suite is green
