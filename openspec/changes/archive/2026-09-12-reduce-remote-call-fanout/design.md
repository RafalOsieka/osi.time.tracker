## Context

The extension worker caps in-flight operations at `EXTENSION_RESOURCE_LIMITS.maxInFlightOperationsPerDocument` (4) per sender document and answers the fifth with a `limit` error (`apps/extension/src/worker/dispatch.ts`). On the page, `ExtensionExecutionAdapter.invoke()` opens a fresh `ExtensionDocumentBridge` per call, so the bridge's own `pending.size` guard never sees more than one operation and nothing coordinates concurrency across call sites.

On `/sync/[date]` two `rows` watchers dispatch synchronously in one tick: `useRemoteActivities.ensureLoaded` per linked row (cache key `configId:remoteIssueId`) and, per tracker, `useRemoteSyncClient.fetchTimeLogs` which first awaits `getCurrentAccount`. Both providers already send `user_id=me` when no `userId` is supplied, and the account is used for nothing else (`use-remote-sync-client.ts`, `reports/monthly.vue`). Redmine's `getActivityOptions` ignores `remoteIssueId` (global enumeration); OpenProject's is a per-work-package form call that also reports 403 for types that cannot log time.

The fake extension used by e2e-ui (`apps/web/test/e2e/helpers/fake-extension.ts`) does not model the in-flight cap, so today's failure has no automated reproduction.

## Goals / Non-Goals

**Goals:**

- A day with any number of linked tasks on an extension tracker loads without a `limit` error.
- Remove remote calls the use case does not need: N Redmine activity calls → 1; account resolution → 0 on read paths.
- Keep the adapter contract, extension protocol, and worker unchanged.

**Non-Goals:**

- OpenProject per-project activity scoping (deferred; see Risks).
- Persistent per-document bridge / handshake reuse.
- Any change to export orchestration, pending-create markers, or reconciliation.

## Decisions

### D1. Bound concurrency on the page in the extension adapter, not in the composables

A small FIFO gate (`limit = EXTENSION_RESOURCE_LIMITS.maxInFlightOperationsPerDocument`) lives in `apps/web/app/utils/remote/` as a module-level singleton and wraps the whole of `ExtensionExecutionAdapter.invoke` (open bridge → handshake → request → close). The adapter accepts an optional `gate` in its options so unit tests inject a fresh one.

- Why the adapter: it is the single choke point every extension call site already goes through (sync page, reports, picker, project catalog). Composable-level throttling would fix one page and leave the picker racing a page load.
- Why the exact protocol constant, not `limit - 1`: the worker decrements its counter in `finally` before the reply is posted, so by the time the page releases a slot the worker has already freed its own. No headroom needed; the worker's own guard stays as defence in depth and its `limit` error is still surfaced if it ever fires.
- Why wrap the handshake too: handshakes are not counted by the worker, so excluding them would let more slots be useful for a few milliseconds, at the cost of two nested async boundaries. Simplicity wins; the handshake is local and fast.
- Alternative considered: raising the limit. Rejected — it moves the threshold and the burst is still unbounded (5 trackers, or an issue search during page load).
- Alternative considered: making `openExtensionBridge` a document singleton and using the bridge's existing `pending.size` guard. Rejected for this change — it changes lifecycle/close semantics of the bridge and REQ-312 unknown-create handling on close; the gate achieves the goal without touching that.

The dead `pending.size` check in `ExtensionDocumentBridge.request` is left as-is; it remains a correct invariant for a single bridge.

### D2. Provider-defined activity scope as a pure dispatch table

Add `resolveActivityScope(systemType, remoteIssueId): string` in `packages/remote-trackers/src/contracts/activity-scope.ts`, mirroring `deriveIssueUrl` (REQ-205 style, no `systemType` conditionals in shared code):

```
openproject: (remoteIssueId) => remoteIssueId   // per work package
redmine:     ()              => '*'             // tracker-wide
```

`useRemoteActivities` keys its cache and in-flight map by `${config.id}:${scope}` and still passes the row's own `remoteIssueId` to `getActivityOptions` (any issue in the scope yields the same options). `stateFor` takes the config surface (needs `systemType`) instead of a bare `configId`. `retry` refetches the scope, so every row sharing it leaves the error state together.

- Why not a new adapter method: scope resolution must not cost a remote call and must work identically under `extension` without a protocol bump. A pure function in the contracts package does that; adding it to `RemoteTrackerAdapter` would force a wire operation.
- Alternative considered: OpenProject scoped by `remoteProjectId` (rows already carry it) using the form endpoint with `_links.project`. Deferred: it drops the per-work-package 403 → "no activities" pre-check, so a task whose type cannot log time would show Ready and fail only at export. Needs a live-instance spike; not needed to fix the limit once D1 lands.

### D3. Drop account resolution from read paths; keep the operation on the contract

`useRemoteSyncClient` loses `resolveAccount`/`accountCache`; `fetchTimeLogs` and `fetchTimeLogsInRange` call the adapter without `userId` and key their caches without the account id. `validateExistingTimeLog` fetches with `me` and drops the redundant `remoteUserId === account.id` comparison (the tracker already filtered). `reports/monthly.vue` calls `fetchTimeLogsInRange` directly. `getCurrentAccount` stays on `RemoteTrackerAdapter` and the protocol (REQ-200 still lists it; removing is a protocol bump for no gain).

- Both clients already implement the fallback: OpenProject `user_id = [input.userId ?? 'me']`, Redmine `user_id: input.userId ?? 'me'`. This is a call-site change, not a provider change.
- Consequence for D (proposal): with the account cache gone, `invalidateCaches()` clears exactly the log caches, so no separate "logs-only" invalidation is needed. `retryRemoteLogs` after finalization now costs one `fetchTimeLogs`, satisfying REQ-118's post-finalization scenario without new code.

### D4. Make the fake extension enforce the cap

`fake-extension.ts` gains the same per-document in-flight counter and `limit` error as the worker, plus a per-operation call counter exposed through `readFakeExtensionState`. The e2e-ui sync journey then (a) reproduces today's failure without D1 and (b) asserts call counts for D2/D3 (Redmine tracker with 5 linked tasks → 1 `getActivityOptions`, 1 `fetchTimeLogs`, 0 `getCurrentAccount`).

## Risks / Trade-offs

- **Queue head-of-line blocking.** A user action (issue search, export create) queued behind a page-load burst waits for a slot. With D2/D3 the burst is ≤ N+1 for OpenProject and ~2 for Redmine, and the reads are short; no priority lane is added (YAGNI). Revisit if OpenProject days with many tasks feel sluggish — the per-project scope (D2 alternative) is the next lever.
- **Queued create on document close.** A create still waiting in the gate has not been dispatched, so no unknown-create marker is *warranted*; however `useSyncExport` writes its `unknown` pending-create marker before invoking the adapter (existing behaviour for any pre-dispatch failure such as a failed handshake). Export is serial and user-initiated, so a queued create only occurs if reads are still loading; the existing recovery UI already handles that marker. No new handling.
- **Explicit `userId` path becomes untested in the app.** Adapters keep honouring it (REQ-333) and package tests cover it; only the app stops passing it.
- **OpenProject days stay N+1 calls.** Correct and no longer failing, but not minimal; tracked as the deferred D2 alternative.
