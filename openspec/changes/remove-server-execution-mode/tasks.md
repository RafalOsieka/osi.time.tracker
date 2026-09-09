## 1. Backend Data and Contracts

- [ ] 1.1 Add a Drizzle SQL migration that changes persisted `server` tracker modes to `client` without altering other columns, and verify it with migration-history and database E2E assertions for changed and unchanged rows.
- [ ] 1.2 Narrow the shared tracker execution-mode schema, type, and display order to `client | extension`, and verify unit/API validation tests cover the default plus rejection of `server` and unknown values.
- [ ] 1.3 Remove the six Nitro remote-operation endpoints and server-side adapter utilities, and verify API E2E coverage confirms the former routes are unavailable while unrelated authenticated APIs still work.

## 2. Frontend Runtime and Configuration

- [ ] 2.1 Remove `ServerExecutionAdapter` and server-mode selection from the browser adapter factory, and verify focused unit tests cover direct provider selection, extension selection, and no silent fallback.
- [ ] 2.2 Update the tracker form to offer only localized `client` and `extension` options with concise CORS and desktop-only guidance, and verify Nuxt component tests cover create/edit seeding and both options.
- [ ] 2.3 Update remote linking and Remote Sync tests to exercise `client` and `extension` behavior, including extension-unavailable mobile-sized journeys and direct-mode failures, and verify the focused Nuxt test project passes.
- [ ] 2.4 Update tracker-management UI E2E coverage to confirm only two modes are selectable, `client` works on a mobile viewport, and `extension` persists without installation.

## 3. Cleanup and Documentation

- [ ] 3.1 Delete proxy-only unit, Nuxt, and API E2E specs plus unused request/response schemas and i18n keys, and verify repository search finds no runtime `server` execution branch or `/api/remote/*` operation route reference.
- [ ] 3.2 Align `docs/vision.md`, `docs/wbs.md`, `docs/user-stories.md`, and remote-test guidance with the two-mode model, CORS policy, VPN reachability, and desktop-only extension support; verify documentation search finds no claim that proxied execution is supported.
- [ ] 3.3 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:nuxt`, and relevant database/API/UI E2E projects, resolving all failures before completion.