## Why

The remote-integration slice implements every tracker operation three times (a browser-direct path, a browser-proxied path, and a server proxy), duplicating auth encoding, pagination, and error mapping. There is no neutral adapter seam, provider types leak into UI code, and the "403 → empty activities" quirk exists only server-side, so `direct` and `proxied` modes can diverge. Before a second tracker (or more sync features) lands, the layering must be fixed.

## What Changes

- Introduce a layered remote architecture: feature composables (L1) → `RemoteTrackerAdapter` interface (L2) → provider `OpenProjectClient` (L3) → `Transport` (L4), with a `createRemoteAdapter(config)` registry selecting by `systemType`/`executionMode`.
- Collapse the three copies of each operation: `encodeBasicAuth`, the paginated time-log loop, and upstream-status→`messageKey` mapping each exist exactly once, inside the adapter/client.
- Move provider quirks (403 → empty activities, 404-on-id → null, pagination bound) into `OpenProjectAdapter` so **client and server execution modes behave identically**.
- **BREAKING** Remove the `transportMode` column/field entirely; the sole axis becomes `executionMode: 'client' | 'server'` (`direct` → `client`, `proxied` → `server`), swept through code, DB, i18n, specs, and the wire header.
- Adopt one vocabulary everywhere: `clientFetchTransport`/`serverFetchTransport`, `RemoteSecretHeader` (no "proxy"/"direct"/"browser" terms); move neutral types (`RemoteFieldOption`, `RemoteAccount`) to `shared/types`.

## Capabilities

### New Capabilities
- (none — this is an internal re-layering; behavior is preserved except the intentional quirk unification)

### Modified Capabilities
- `remote-system-config`: replace `transportMode` with `executionMode: 'client' | 'server'`; validation, default, and credential-handling wording updated.
- `remote-issue-linking`: REQ-TTR-106 restated in client/server execution-mode terms instead of `direct`/`proxied` transport.
- `remote-issue-proxy`: REQ-TTR-111/112/113 restated as server-execution-mode operation endpoints; secret header renamed.
- `remote-sync-review`: REQ-TTR-124 restated for client/server execution modes with mode-agnostic quirk behavior.

## Impact

- Schema + data migration dropping `transportMode`, mapping `proxied` rows to `executionMode = 'server'`.
- New `shared/remote/` module; `shared/utils/openproject-adapter.ts` and `server/utils/remote-issue-proxy.ts` removed.
- Rewrites of remote composables, `/api/remote/*` routes, `clients.vue`/`sync/[date].vue`, i18n `en`/`pl` keys, and remote unit/e2e tests.

## Non-goals

- Adding a second tracker (Jira/GitLab) or server-side credential storage.
- Any user-facing behavior change beyond the quirk unification and the execution-mode rename.
