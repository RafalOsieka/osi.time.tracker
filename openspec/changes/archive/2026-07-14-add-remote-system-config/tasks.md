## 1. Boundary types & validation (shared)

- [x] 1.1 Add `shared/types/remote-system-config.ts`: zod enums (`systemType`, `executionMode` = only `client`, `roundingRule`), `createRemoteSystemConfigSchema` (baseUrl url-validated, `requiredFieldDefaults` optional `Record<string,string>`, **no secret field**), and `RemoteSystemConfigDto` (id + non-secret fields, timestamps as `string`, no `any`)
- [x] 1.2 Unit test: schema accepts valid input, rejects invalid/missing `baseUrl` and unknown `systemType`, strips/rejects any secret field, and `mapZodError` maps to `{ messageKey, params }`

## 2. Database (backend)

- [x] 2.1 Add `server/db/schema/remote-system-configs.ts` (uuidv7 id, `userId` FK, `clientId` FK with **unique index**, systemType, baseUrl, executionMode, roundingRule, `requiredFieldDefaults` jsonb, createdAt/updatedAt/deletedAt) and export it from `server/db/schema/index.ts`
- [x] 2.2 Generate and commit the Drizzle migration (`pnpm db:generate`) and verify it applies (`pnpm db:migrate`)

## 3. API endpoints (backend)

- [x] 3.1 `server/api/clients/[id]/remote-config.get.ts`: `requireAuth`, user+client-scoped read returning the DTO (never a secret) or not-found
- [x] 3.2 `server/api/clients/[id]/remote-config.put.ts`: `requireAuth` + CSRF, validate via zod, upsert one config per Client (reject Clients the user does not own), return the DTO
- [x] 3.3 `server/api/clients/[id]/remote-config.delete.ts`: `requireAuth` + CSRF, delete the config for an owned Client
- [x] 3.4 Integration (e2e) test GET: returns config for owner; not-found/hidden for non-owner; 401 unauthenticated
- [x] 3.5 Integration (e2e) test PUT: happy-path create; upsert updates the single config; rejects invalid body; rejects another user's Client; response contains no secret
- [x] 3.6 Integration (e2e) test DELETE: owner deletes; non-owner cannot; cross-user isolation holds

## 4. Browser-held secret (frontend logic)

- [x] 4.1 Add a composable (e.g. `useRemoteConfigSecret`) that reads/writes the API secret in `localStorage` keyed by config id (`rsc:<configId>`) and clears it on demand; never includes it in any request payload
- [x] 4.2 Unit test: secret persists per config id, is retrievable after reload, is cleared on delete, and is never part of the outgoing request body

## 5. Configuration UI (frontend)

- [x] 5.1 Add a remote-config form on the Client edit surface using PrimeVue (`Select` for systemType/roundingRule, `InputText` for baseUrl, `Password` for the secret bound to `localStorage`, `Button` for save/remove); submit config via `$csrfFetch`/`useCsrfFetch` without the secret
- [x] 5.2 Wire remove action to delete the server config and clear the browser-held secret for that config id
- [x] 5.3 Add all new user-facing strings and `error.*` keys to `i18n/locales/en.json` and `pl.json`, keeping parity (verified by `i18n-catalog-parity` test)
- [x] 5.4 E2E test: user creates, edits, and removes a Client's remote config through the form; secret is entered but never sent to the server; config survives reload

## 6. Verification

- [x] 6.1 Run `pnpm lint`, `pnpm format:check`, `pnpm test:unit`, `pnpm test:nuxt`, and the new `pnpm test:e2e` cases; keep the suite green
- [x] 6.2 Validate the change with `openspec validate --change add-remote-system-config`
