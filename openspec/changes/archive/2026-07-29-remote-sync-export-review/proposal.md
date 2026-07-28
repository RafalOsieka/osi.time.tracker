## Why

Export is a black box. One button starts a silent sequential loop; the only pre-flight check is a text confirmation when repeats are detected, there is no per-task progress, and the results — including the dangerous "created remotely but not finalized locally" case — arrive as small grey text lines that look like every other line on the page. A failed task can only be re-pushed by re-running the whole batch, and the comment written to the tracker is silently hard-coded to the task name.

## What Changes

- Replace the ad-hoc repeat confirmation with a single export dialog that carries the run through three phases without closing: **review → running → report**, over one continuous table so the user never loses the mapping between what they approved and what happened.
- **Review**: exactly what will be sent per task — task, issue, activity, tracked → to send, comment, repeat badge, possible-duplicate badge — plus the day's three totals and what is being skipped and why. One confirmation covers both repeat risk and rounding.
- **Running**: per-task status (`queued → creating → finalizing → done / failed / needs verification`), an `n / total` progress indicator announced politely, and a stop action that halts before the next task and never mid-task.
- **Report**: the same rows grouped as succeeded / failed / needs verification, with a **retry for this task only**, the remote log id and a deep link for uncertain tasks, and no hiding of successful tasks.
- Make the exported comment editable per task, prefilled from the last fetched remote log comment for that issue when available and otherwise from the task name. Edits live for the current day's review only — nothing is stored locally, because the tracker already stores the comment and the page already fetches it back.
- Add a client-generated **export request key** per `(task, local date, selected entries, export duration)` so a retry after an uncertain finalization reconciles with the pending attempt instead of creating a second remote log.

## Non-goals

- A durable export queue with pause/resume, reordering, backoff or attempt history surviving a page reload — a day is a small sequential batch the user is watching.
- Parallel export (sequential stays, to be gentle on tracker rate limits).
- Multi-day export, remote-log editing or deletion.
- Persisting comments per task across days (no new column for comments).
- The table layout, day navigation and the three summaries themselves — those are `remote-sync-page-redesign`, which this change reuses.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `remote-sync-review`: adds the export dialog with its review, running and report phases, per-task retry, the stop action, and the editable per-task export comment; strengthens repeat confirmation and per-task outcome reporting, and makes retry after an uncertain finalization reconcilable through an export request key.

## Impact

- `app/composables/useSyncExport.ts` — per-task progress states, abort between tasks, single-task retry, request key, comment passthrough.
- New `app/components/sync/SyncExportDialog.vue` (review / running / report phases).
- `app/pages/sync/[date].vue` — replaces the confirm dialog and the inline outcome lines.
- `POST /api/sync/export` and `shared/types/remote-export.ts` — accept and reconcile the export request key; `comment` becomes an explicit input.
- `server/db/schema` + one migration — persist the request key on the export record with a per-user uniqueness constraint.
- `i18n/locales/en.json` / `pl.json` — dialog, phase, status, retry and comment strings.
