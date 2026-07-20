## Context

Remote integration currently lives across `shared/utils/openproject-adapter.ts` (pure builders/parsers), three composables (`useRemoteIssueSearch`, `useRemoteActivities`, `useOpenProjectClient`), `server/utils/remote-issue-proxy.ts`, and the `/api/remote/*` routes. Each tracker operation is written three times — a browser-direct path, a browser-proxied path, and a server proxy — so `encodeBasicAuth`, the 50-page time-log loop, and error mapping are each duplicated 2–3×. Two config columns describe one axis: `executionMode` (currently only `'client'`) and `transportMode` (`'direct' | 'proxied'`). Provider types (`AdapterFieldOption`, `OpenProjectAccount`) leak into UI/state code, and the "403 → empty activities" quirk exists only server-side, so the two modes can diverge.

Constraints: SSR (Nuxt/Nitro); the tracker credential must stay browser-only (never persisted server-side); `client` execution must never touch `$csrfFetch` (no OSI session/CSRF material to a third-party origin); the server must never accept an arbitrary target URL (same-origin guard). See REQ-TTR-102/106/111/112.

## Goals / Non-Goals

**Goals:**
- One neutral adapter seam so a second tracker or new sync feature does not touch composables and routes.
- Each cross-cutting concern (auth encoding, pagination, error→`messageKey` mapping, quirks) implemented exactly once.
- Identical behavior across `client` and `server` execution modes.
- A single config axis and vocabulary: `executionMode: 'client' | 'server'`.

**Non-Goals:**
- Adding a second tracker or server-side credential storage.
- Any user-facing behavior change beyond quirk unification and the rename.
- A generic HTTP pass-through proxy.

## Decisions

### D1 — Four layers with a use-case adapter interface
L1 feature composables (Vue state, caching, dedup, stale suppression) → L2 `RemoteTrackerAdapter` (use-case methods: `searchIssues`, `getIssueById`, `getActivityOptions`, `getCurrentAccount`, `fetchTimeLogs` (all pages), `createTimeEntry`; speaks only neutral DTOs) → L3 `OpenProjectClient` (one method ≈ one endpoint, folds today's builders/parsers in as private impl, applies Basic auth once) → L4 `Transport.execute(req): { status, payload }`.

*Alternative considered:* keep free functions and only extract shared helpers (proposal Option B). Rejected — it dedups plumbing but leaves no seam for a second tracker and keeps quirks scattered.

### D2 — Execution mode is the sole axis; `client`/`server` are two adapter arrangements
`createRemoteAdapter(config)` switches on `executionMode`: `client` → `OpenProjectAdapter(clientFetchTransport)` (selected by `systemType`); `server` → `ServerExecutionAdapter`, a thin `RemoteTrackerAdapter` whose methods each do one `$csrfFetch` to the matching `/api/remote/*` endpoint with the secret header. The route handler instantiates the *same* `OpenProjectAdapter(serverFetchTransport)`, so quirks and pagination run once, server-side, per use case (one round-trip per use case, not per page).

*Alternative considered:* model "proxied" as a Transport under the OpenProject client. Rejected — `/api/remote/*` is operation-level (not raw pass-through), and a raw transport would turn the 50-page loop into 50 CSRF round-trips and force arbitrary-URL forwarding.

### D3 — Quirks live in `OpenProjectAdapter`
403 → empty activities, 404-on-id → null, the pagination bound, and upstream-status → `messageKey` mapping move into the adapter. Both execution modes inherit them; this intentionally fixes today's divergence where `client` mode errors on a 403 that `server` mode swallows.

### D4 — Neutral types and a neutral error
`RemoteFieldOption`, `RemoteAccount` (renamed from `AdapterFieldOption`/`OpenProjectAccount`) move to `shared/types`; UI/state code stops importing the OpenProject module. The adapter throws a neutral `RemoteAdapterError { messageKey, status? }`; `client` mode reads `messageKey` directly, `server` mode routes convert it to `createError({ statusCode, data: { messageKey } })` and `ServerExecutionAdapter` maps it back via `extractMessageKey`.

### D5 — Vocabulary sweep and schema change
Drop `transportMode` entirely; `remoteExecutionModeSchema` becomes `z.enum(['client', 'server'])`, default `'client'`. Rename the wire header `x-remote-proxy-secret` → `x-remote-secret`, i18n keys (`transportMode*`/`remoteProxy*` → `executionMode*`/`remoteServerMode*`). Banned terms in identifiers/keys/specs going forward: *direct*, *proxied*, *browser* (as a mode), *transportMode*.

## Risks / Trade-offs

- [Behavior change: 403 now returns `[]` in client mode] → Intentional (D3); covered by a spec scenario and an adapter unit test.
- [One-way, data-preserving migration dropping `transportMode`] → Map `proxied` → `executionMode = 'server'` before dropping the column; rollback = restore column defaulting `'direct'` from `executionMode`.
- [Large blast radius across composables, routes, i18n, and ~15 tests] → Sequence the migration behavior-preservingly (see plan), retargeting builder/parser unit specs to the client via a fake transport before deleting old modules.
- [Header/key rename touches error-contract keys] → No external clients; secret is per-request from the same session, so the rename is free.

## Migration Plan

1. Add `shared/remote/` skeleton: `Transport`, `RemoteTrackerAdapter`, `RemoteAdapterError`, neutral DTOs in `shared/types`.
2. Build `OpenProjectClient` (folding builders/parsers) + `OpenProjectAdapter` (quirks, pagination); port unit specs to fake-transport style.
3. Rewrite `/api/remote/*` as thin shells over `OpenProjectAdapter(serverFetchTransport)`; delete `remote-issue-proxy.ts`.
4. Add `ServerExecutionAdapter` + `createRemoteAdapter(config)`; rewrite composables to state-only over the adapter; delete `shared/utils/openproject-adapter.ts`.
5. Migration + sweep: drop `transportMode`, `executionMode` → `['client','server']`, rename header/i18n keys, update REQ-TTR-101/102/106/111/112/113/124 wording.

Steps 1–4 are behavior-preserving except D3; step 5 is the only user/spec-visible change and can ship separately.

## Open Questions

- (none) — design settled across prior discussion.
