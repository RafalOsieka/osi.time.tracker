# Design

## Context

- `RemoteTimeLogDto` (`packages/remote-trackers/src/contracts/remote-time-log.ts`) has `remoteIssueTitle?: string`. OpenProject fills it from `_links.entity.title` / `_links.workPackage.title` (`openproject/client.ts` time-log mapping); Redmine never does (`redmine/client.ts`).
- Both adapters page through logs in `fetchTimeLogs` / `fetchTimeLogsInRange` (bounded page loops in `*/adapter.ts`) and wrap failures with `rethrowAsAdapterError(err, 'error.remoteTimeLogsFetchFailed')`.
- Both clients already know how to filter issues by id: Redmine `findIssueInScope` uses `/issues.json?issue_id=…&status_id=*`; OpenProject `findIssueInScope` uses a `filters=[{"id":{"operator":"=","values":[…]}}]` query.
- The extension runs the same adapter code for every operation; the page validates results with `remoteTimeLogSchema` in `packages/extension-protocol/src/operations.ts`, and `EXTENSION_PROTOCOL_VERSION = 1` is checked as a `z.literal` in the handshake.
- Consumers: Remote Sync (`use-remote-day-logs`), monthly report, import (`use-remote-log-import` → `POST /api/trackers/[id]/import`, which caches `remoteIssueTitle ?? null`).

## Goals / Non-Goals

**Goals:**
- Every caller receives `remoteIssueTitle: string | null` with identical semantics for both providers.
- Enrichment is invisible to callers and runs identically in client and extension mode.

**Non-Goals:**
- Exposing a lookup-by-ids operation to the page or the bridge.
- Title caching, or changing the import endpoint body.

## Decisions

### D1. Enrich inside the adapter's fetch methods, after paging
After the page loop, each adapter collects distinct `remoteIssueId`s whose mapped log has no title, calls a provider-private `getIssuesByIds(ids)` in chunks of 100, and fills titles (`null` for ids not returned). The client-layer mappers keep producing `remoteIssueTitle?: string` internally; the adapter is the only place the public `string | null` is produced.
- *Alternative — enrich in a shared contract-level decorator around any adapter:* one implementation, but it would need a public lookup operation on every adapter and would run on the page side of the extension bridge (secret crossing the bridge twice). Rejected.
- *Alternative — caller-side lookup (report fetches titles itself):* keeps the contract weak and repeats the logic in every caller; this is precisely what the change removes.

### D2. `getIssuesByIds` is a provider adapter method, not part of `RemoteTrackerAdapter`
Each adapter class gets `getIssuesByIds(ids: string[]): Promise<Map<string, string>>` (id → title) backed by a new client method:
- Redmine: `GET /issues.json?issue_id=<csv>&status_id=*&limit=100`.
- OpenProject: `GET /api/v3/work_packages?filters=[{"id":{"operator":"=","values":[…]}}]&pageSize=100`.
Keeping it off the neutral interface means no bridge operation, no handshake capability, and no `contract-agreement` entry. Promote it to the contract when a page-side caller needs it.
- *Alternative — add a tenth neutral operation now:* symmetric, but it adds bridge/handshake work with no caller (YAGNI).

### D3. A failed lookup fails the fetch
The lookup runs inside the same `try` that wraps the page loop, so it maps to `error.remoteTimeLogsFetchFailed`. A `null` title therefore always means "not disclosed", never "unknown".
- *Alternative — degrade to `null` on failure:* friendlier for Remote Sync, but conflates failure with absence and would let the client report silently print issue ids without titles.

### D4. Bump the extension protocol to version 2
`remoteTimeLogSchema` changes `remoteIssueTitle` to `z.string().nullable()` (required key). Bumping `EXTENSION_PROTOCOL_VERSION` makes an outdated extension fail at the handshake, which already renders the update state (REQ-309), instead of failing result validation on the first fetch.
- *Alternative — keep v1 and make the page schema accept both shapes:* avoids a reinstall, but keeps the weak contract alive on the bridge and needs a dual-shape schema forever.

### D5. Import keeps its body shape
`use-remote-log-import` sends `remoteIssueTitle` only when it is a string (`null` → omitted). The server's optional field and the `?? null` cache fallback stay valid; Redmine imports simply start receiving titles.

## Risks / Trade-offs

- [Redmine fetches gain requests] → bounded at ⌈distinct issues / 100⌉ per fetch; a typical month is 1 request. Remote Sync's same-day fetch already filters by a handful of issues, so it is 1 request at most.
- [URL length with 100 ids] → 100 numeric ids ≈ 700 characters in Redmine CSV, ≈ 1.5 kB URL-encoded in OpenProject JSON filters; both well under common 8 kB limits.
- [Redmine `limit` caps at 100 by default] → chunk size equals the cap, so one page per chunk; no pagination needed.
- [Users must reload the unpacked extension] → the handshake update state tells them; the extension is self-installed (REQ-367), so there is no store review delay.
- [OpenProject hides work packages from the filter for unprivileged accounts] → yields `null`, which is the specified meaning.

## Migration Plan

Ship web app and extension from the same commit. After deploy, users reload the unpacked extension when the sidebar shows the update state. Rollback: revert the commit; v1 extensions keep working with the reverted app.
