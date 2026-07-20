## 1. Shared remote skeleton (L2/L4 + neutral types)

- [ ] 1.1 Add `shared/types/remote-field-option.ts` (`RemoteFieldOption`) and `shared/types/remote-account.ts` (`RemoteAccount`), re-exported from a barrel; keep old `AdapterFieldOption`/`OpenProjectAccount` as temporary aliases.
- [ ] 1.2 Create `shared/remote/types.ts`: `Transport` (`execute(req: RemoteRequest): Promise<{ status: number; payload: unknown }>`), `RemoteTrackerAdapter` interface (`searchIssues`, `getIssueById`, `getActivityOptions`, `getCurrentAccount`, `fetchTimeLogs`, `createTimeEntry`), and `RemoteAdapterError { messageKey, status? }`.
- [ ] 1.3 Unit test `shared/remote/types` construction/guards for `RemoteAdapterError` (message key + optional status).

## 2. OpenProject client (L3)

- [ ] 2.1 Create `shared/remote/openproject/client.ts` `OpenProjectClient` composing the existing `buildXxx`/`parseXxx` logic (moved from `shared/utils/openproject-adapter.ts`) as private impl; apply `apikey:<key>` Basic auth in exactly one place.
- [ ] 2.2 Keep `formatOpenProjectDuration`, `parseOpenProjectDuration`, `deriveIssueUrl`, `normalizeBaseUrl` as exported utilities under `shared/remote/openproject/`.
- [ ] 2.3 Port builder/parser unit specs to drive `OpenProjectClient` through a fake `Transport` that records the request and returns a canned payload (asserts URL, method, body, auth header).

## 3. OpenProject adapter (L2 impl) with quirks

- [ ] 3.1 Create `shared/remote/openproject/adapter.ts` `OpenProjectAdapter` implementing `RemoteTrackerAdapter` over `OpenProjectClient`; own the pagination loop (bound 50), 403 → empty activities, 404-on-id → null, and upstream-status → `RemoteAdapterError` mapping.
- [ ] 3.2 Unit test `OpenProjectAdapter` over a fake transport: pagination across pages, 403 → `[]` activities, 404 → null issue, and each error-status → `messageKey` mapping.

## 4. Transports (L4)

- [ ] 4.1 Add `clientFetchTransport` (browser `fetch` + Basic auth header, no `$csrfFetch`) under `app/` and `serverFetchTransport` (server `$fetch.raw` + same-origin guard) under `server/`.
- [ ] 4.2 Unit test `serverFetchTransport` same-origin guard rejects a foreign origin with the origin-rejected `messageKey`.

## 5. Server routes over the adapter (backend)

- [ ] 5.1 Rewrite `/api/remote/search`, `/activities`, `/account`, `/time-logs`, `/time-entries` as thin handlers: validate body (zod), resolve owned config, `createRemoteAdapter(config)` with `serverFetchTransport`, call the matching adapter method, map `RemoteAdapterError` to `createError({ statusCode, data: { messageKey } })`.
- [ ] 5.2 Delete `server/utils/remote-issue-proxy.ts` and its now-unused helpers.
- [ ] 5.3 Integration tests per endpoint: happy path returning the neutral DTO, plus at least one error (missing secret / auth rejected / not-found / foreign origin) and cross-user 404.

## 6. Registry + server-execution adapter (backend/shared)

- [ ] 6.1 Add `ServerExecutionAdapter` (`RemoteTrackerAdapter` that `$csrfFetch`es each `/api/remote/*` op with the secret header and maps errors back via `extractMessageKey`).
- [ ] 6.2 Add `createRemoteAdapter(config)` registry: `client` → `OpenProjectAdapter(clientFetchTransport)` by `systemType`; `server` → `ServerExecutionAdapter`.
- [ ] 6.3 Unit test the registry selects the correct adapter per `executionMode` and `systemType`.

## 7. Feature composables (frontend, state-only)

- [ ] 7.1 Rewrite `useRemoteIssueSearch` to state-only (loading/results/errorKey, stale suppression) over the adapter from the registry; drop the direct/proxied branch and local `encodeBasicAuth`.
- [ ] 7.2 Rewrite `useRemoteActivities` over the adapter (activities quirk now handled in the adapter).
- [ ] 7.3 Rename/rewrite `useOpenProjectClient` → `useRemoteSyncClient`: keep account/logs caches, in-flight dedup, and `invalidateCaches`; delegate all I/O to the adapter.
- [ ] 7.4 Nuxt component/unit tests for the three composables (results, stale suppression, error keys, caching/dedup) using a fake adapter.

## 8. Execution-mode schema + migration (backend)

- [ ] 8.1 Update `shared/types/remote-system-config.ts`: `remoteExecutionModeSchema = z.enum(['client','server'])` default `'client'`; remove `remoteTransportModeSchema`, `RemoteTransportMode`, and `transportMode` from schemas and `RemoteSystemConfigDto`.
- [ ] 8.2 Update `server/db/schema/remote-system-configs.ts`: drop the `transportMode` column and its import.
- [ ] 8.3 Generate and commit a migration: `UPDATE remote_system_configs SET "executionMode"='server' WHERE "transportMode"='proxied';` then `DROP COLUMN "transportMode"`.
- [ ] 8.4 Update `remote-config.get/put`, `sync/day.get`, and `shared/types/remote-sync-day.ts`/`remote-export` to stop selecting/serializing `transportMode`.
- [ ] 8.5 Unit/integration tests: config create defaults to `executionMode='client'`, rejects invalid mode, and the DTO no longer exposes `transportMode`.

## 9. Vocabulary sweep (wire header + i18n)

- [ ] 9.1 Rename `shared/config/remote-proxy.ts` → `shared/config/remote-secret.ts`; `REMOTE_PROXY_SECRET_HEADER` (`x-remote-proxy-secret`) → `REMOTE_SECRET_HEADER` (`x-remote-secret`); update all references.
- [ ] 9.2 Replace i18n keys in `i18n/en.json` and `i18n/pl.json` in parity: `transportModeDirect/Proxied` → `executionModeClient/Server`, `remoteConfigTransportModeRequired` → `remoteConfigExecutionModeRequired`, `error.remoteProxy*` → `error.remoteServerMode*`.
- [ ] 9.3 Lint check for banned terms (`transportMode`, `proxied`, `direct` as a mode, `browser` prefix) in identifiers and i18n keys.

## 10. UI (frontend)

- [ ] 10.1 Update `app/pages/clients.vue`: replace the transport-mode dropdown with an execution-mode dropdown (`client`/`server`); remove the `.omit({ executionMode: true })` resolver hack.
- [ ] 10.2 Update `app/pages/sync/[date].vue` and `shared/utils/remote-sync-row-state.ts` to stop passing `transportMode` and to import neutral types from `shared/types`.
- [ ] 10.3 E2E test in `remote-system-config.spec.ts`: create/edit config choosing each execution mode, and validation error on an invalid execution mode.

## 11. Cleanup + full verification

- [ ] 11.1 Delete `shared/utils/openproject-adapter.ts` and remove the temporary type aliases from 1.1 once all imports are migrated.
- [ ] 11.2 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`.
- [ ] 11.3 Run `pnpm test:unit`, `pnpm test:nuxt`, and `pnpm test:e2e`; ensure the whole suite is green.
- [ ] 11.4 Run `openspec validate refactor-remote-adapter-layers` and confirm it passes.
