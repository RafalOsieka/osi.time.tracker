## Why

The Remote Sync page fails for `extension` trackers as soon as a day has three or more linked tasks: the page fires one activity fetch per task plus an account/log chain per tracker in the same tick, and the extension worker rejects the fifth concurrent operation with a `limit` error instead of queueing it (`maxInFlightOperationsPerDocument: 4`). The failing rows show a retry badge and the day cannot be reviewed without manual retries. Raising the limit would only move the threshold; the real problem is that the page issues more remote calls than the use case needs and nothing on the page side coordinates them.

## What Changes

- **Queue instead of reject.** The page-side extension adapter bounds its own concurrency to the protocol limit and queues excess operations, so the worker cap becomes a throughput bound, not a failure mode. Applies to every extension call site (sync page, reports, issue picker, project catalog).
- **Activity options are fetched once per provider-defined scope.** Redmine activities are a global enumeration, so all rows on one Redmine tracker share one fetch. OpenProject stays per work package (its form endpoint is per work package and also detects "time logging not allowed" for a type).
- **Drop the account round-trip from read paths.** Both providers filter time logs by the current user server-side (`me`), so the sync page and monthly report no longer call `getCurrentAccount` before fetching logs. The operation stays on the contract; it is simply no longer needed to scope logs.
- **Post-export refresh invalidates only the log cache.** After a task finalizes, the row's remote logs are refetched without discarding unrelated cached state; the explicit user retry still clears everything.

Resulting calls on page load for one tracker with N linked tasks: Redmine `N + 2 → 2`, OpenProject `N + 2 → N + 1`, and neither can hit the limit any more.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `browser-extension-execution`: the web app SHALL queue extension operations up to the protocol's in-flight bound rather than surfacing a limit error for a page-generated burst (REQ-310 companion on the page side).
- `remote-adapter-contract`: activity options SHALL be resolvable once per provider-defined scope; time-log fetches SHALL default to the current account without a prior account-resolution call.
- `remote-sync-review`: REQ-114 scope wording tightened to the provider-defined scope; REQ-118 reworded to the outcome (current-account logs only) instead of mandating account resolution.

## Non-goals

- Raising `maxInFlightOperationsPerDocument` or changing the extension protocol/worker.
- Scoping OpenProject activities per remote project (possible later; trades away the per-work-package "cannot log time" pre-check).
- Reducing the picker's scoped exact-lookup from two calls to one.
- A persistent per-document extension bridge (handshake per invoke is extension-local, not tracker traffic).
- Any change to export sequencing, provenance, or reconciliation.

## Impact

- `apps/web/app/utils/remote/extension-execution-adapter.ts` — module-level operation queue.
- `packages/remote-trackers` — activity scope key per provider; `userId` becomes optional/unused on the read path.
- `apps/web/app/composables/use-remote-activities.ts`, `use-remote-sync-client.ts`, `use-remote-day-logs.ts`, `apps/web/app/pages/reports/monthly.vue` — no account call; scope-keyed activity cache; split invalidation.
- Tests: extension adapter unit tests (queueing), remote-trackers package tests, web unit/nuxt tests for the composables, e2e-ui sync journey with ≥5 linked tasks on a mocked extension tracker.
