## Context

See proposal.md – Why. Current state that shapes the approach:

- `RemoteTrackerAdapter.fetchTimeLogsInRange({ from, to })` (REQ-296) already returns the current account's logs across a range as `RemoteTimeLogDto = { remoteLogId, remoteIssueId, spentOn, durationSeconds, activityId, activityName, comment, remoteUserId }`. `pages/reports/monthly.vue` calls it once per tracker per month with the browser-held secret via `createRemoteAdapter(config, secret)`.
- Both parsers already see the remote project on each log — OpenProject `_links.project.href` (and the work-package subject in `_links.entity.title`), Redmine `project.id` — but drop them. Redmine logs without an issue are dropped by `parseTimeLogsPage` today.
- `listProjects()` (REQ-318) returns `{ remoteProjectId, title, parentId? }`, enough to walk ancestors client-side. Scope semantics are "root and all descendants" (REQ-319).
- A Project carries at most one scope (`projects.remoteProjectId/remoteProjectTitle`, REQ-325). Several Projects may be bound to one tracker.
- `POST /api/sync/link` (REQ-305) turns one remote log into `remote_exports` + `remote_export_entries` without a remote write. Identity is `(userId, trackerId, remoteLogId)` (unique index, REQ-304). Nothing enforces one provenance row per task/day.
- `resolveTaskId(tx, userId, title, projectId, { remoteIssueId, trackerId, cachedTitle, cachedRemoteProjectTitle })` find-or-creates a linked task on the four-part key; `cachedTitle` falls back to the issue id.
- `computeDayBoundary(date, timezone)` gives the `[from, to)` instants of a local day; `POST /api/time-entries` accepts explicit `startedAt/stoppedAt` pairs for stopped entries, and overlap is permitted (REQ-143).
- Export sends the task name as the remote log comment by default (REQ-232). The extension bridge validates operation results with `remoteTimeLogSchema`, a `z.object` that strips unknown keys.
- The Trackers page (`pages/trackers.vue`) renders `RowActions` (edit/delete) per row; the secret is readable there through `useTrackerSecret()`.

## Goals / Non-Goals

**Goals:**
- One user-triggered operation per tracker that backfills any date range, safe to run repeatedly.
- Imported history indistinguishable from app-exported history for Remote Sync and Reports (Linked / App).
- No secret through OSI; no new adapter operation; no schema migration.

**Non-Goals:**
- Reconciling or updating already-imported entries; catch-all routing; a server-side job model.

## Decisions

### 1. Import lives on the tracker and routes by scope, client-side

| Option | Notes |
|---|---|
| **Tracker-level import, ancestor-walk routing (chosen)** | One catalog fetch + one range fetch per month for the whole tracker. For each log, walk `remoteProjectId → parentId → …` and stop at the first id that is some Project's scope; nested scopes resolve to the most specific Project automatically. Unmatched logs are reported, never imported. |
| Per-Project import | N× the remote calls, the user runs it per Project, and a Project without a scope has no meaningful filter. Rejected. |
| Server-side routing | The server stores scope roots but never sees the catalog (it holds no secret), so subtree membership cannot be decided there. Rejected. |

The client sends logs already grouped by `projectId`; the server validates each Project is owned, not deleted, and bound to the route's tracker — the same trust boundary as `link.post.ts` (remote facts are client-reported because the server has no secret). An unscoped tracker-bound Project never receives logs: silent catch-all is the one outcome that is expensive to undo.

### 2. Task name is the remote comment, `"empty"` when blank

Mirrors REQ-232 in reverse, so export → import round-trips a task name. Same comment on the same issue collapses into one task through the `(userId, projectId, name, remoteIssueId)` key; different comments become sibling tasks with the same `#id`, which is the intended grain. No issue-title lookup: `remoteIssueTitle` is used only as `remoteIssueCachedTitle` when the provider supplies it for free (OpenProject); Redmine tasks fall back to the issue id as cached title (already `resolveTaskId` behaviour). `"empty"` is a literal stored value, not UI text, so it stays out of the i18n catalogs. Alternative — name by issue title — rejected by the user: it loses the per-comment task grain they work in.

### 3. Entries are placed after the day's last stopped entry, never overlapping

Remote logs have a date and a duration, no start time. Server-side, per `(user, localDate)` inside the import transaction:

```
dayStart, dayEnd = computeDayBoundary(localDate, user.timezone ?? 'UTC')
cursor = max(dayStart + 08:00, max(stoppedAt) of stopped entries with startedAt in [dayStart, dayEnd))
if cursor + sum(durations) > dayEnd:  cursor = max(dayStart, that same max(stoppedAt))
for log in logs ordered by numeric remoteLogId asc:
    startedAt = cursor; stoppedAt = cursor + duration; cursor = stoppedAt
```

The invariant ("after whatever is already on that day, whoever created it") makes two trackers imported in either order, and the overlap month with real local entries, come out non-overlapping. Spill past midnight is fine — entries bucket on `startedAt`'s local day (REQ-291, REQ-150); the anchor only drops to `00:00` when a day would otherwise push a `startedAt` onto the next day. More than 24 h on one day is bad data and may overlap. Running entries are ignored (null `stoppedAt`). The rule is a pure function (`placeImportedEntries`) unit-tested with the two-tracker example. Alternatives — fixed `08:00` for every entry (overlaps), or spreading across the day proportionally (arbitrary and still overlaps across runs) — rejected.

### 4. Preview is a dry run of the same request

`POST /api/trackers/[id]/import` accepts `{ dryRun: boolean, groups: [{ projectId, logs: [...] }] }`. Both paths run identical validation and the existing-identity check (`remoteLogId IN (...)` on `remote_exports` for the tracker); only the write path inserts. The response is per-Project counts `{ imported | wouldImport, skippedExisting }`. Alternatives — a separate "existing ids" query endpoint (a second contract for the same question), or client-only preview without the already-linked count (the user explicitly wants to see skips before writing) — rejected.

### 5. Chunking, idempotency and atomicity

The client iterates months from `from` to `to`; each month is one range fetch and one import request (split at 500 logs per request). Each request is one transaction: skip known identities, place entries per day, then per log `resolveTaskId` → insert entry → insert provenance + junction. A unique violation on `(userId, trackerId, remoteLogId)` inside the loop is treated as skipped, not as failure. A failed month leaves earlier months committed; re-running the range skips them. No import-job table: the identity index *is* the resume state. Provenance rows store `requiredFieldValues: { activity: activityId }` when present and `exportDurationSeconds = durationSeconds`, so Remote Sync and Reports classify them exactly like exports.

### 6. DTO extension instead of a new operation

`RemoteTimeLogDto` gains `remoteProjectId?: string`, `remoteProjectTitle?: string`, `remoteIssueTitle?: string`. OpenProject fills all three from HAL links; Redmine fills the project pair from `project: { id, name }`. `packages/extension-protocol` `remoteTimeLogSchema` adds the same optional keys — required, because the bridge's `z.object` would otherwise strip them. No operation name changes, so the handshake is unaffected; an older extension build simply yields logs without `remoteProjectId`, which the client reports as unmatched with a hint to update. Alternative — a new `fetchTimeLogsForImport` operation — rejected: more protocol surface for fields already on the wire.

### 7. Dialog

`TrackerImportDialog.vue`, opened from a new `RowActions` slot on the Trackers page (disabled with a hint when no secret is stored). Phases mirror `SyncExportDialog`: **range** (from/to dates, defaults: five years back → today; plus the tracker's Projects with their scope, unscoped ones flagged "will not receive logs" — from the already-loaded project list, no remote call, so a missing scope is caught before the scan) → **scanning** (per-month progress: fetch + dry run; cancellable) → **preview** (table per remote project, not per local Project, so an unmatched row shows *why* it is unmatched: local Project or "no scoped project", new, already linked; totals) → **importing** (per-month progress; not cancellable — each month is one atomic request and a re-run resumes via the identity skip, so interrupting only buys a confusing half-state) → **done** (totals, unmatched reminder, note that times are synthetic and durations exact). A failed month stops the run in place, names the committed months, and offers **Retry**, which simply re-runs the same range — the skip logic turns it into "continue". Only matched logs with `wouldImport > 0` are sent. Extension mode works unchanged through `createRemoteAdapter`.

## Risks / Trade-offs

- [Direct-logged remote entries during the overlap month duplicate untracked-but-exported local time] → preview shows month totals; the user can narrow `from`; documented as manual cleanup.
- [Thousands of inserts per request] → month chunks are ~100–300 logs; 500-log split cap; single transaction per request keeps a failed chunk atomic.
- [Scope changed after import] → nothing moves (identity skip); stated in Non-goals and in the done phase.
- [Old extension build strips `remoteProjectId`] → every log reports as unmatched; the dialog shows an "update the extension" hint when no fetched log carries a project id.
- [Remote project deleted/archived, log still returned] → its id is absent from the catalog; the walk ends at the root and the log is reported as unmatched.
- [Day with > 24 h of logs] → overlap accepted; noted in the placement rule.

## Migration Plan

No database change. Ship `remote-trackers`, `extension-protocol`, extension and web together; an older web build ignores the new DTO fields. Rollback is removing the route and dialog — imported rows are ordinary tasks, entries and provenance and stay valid.
