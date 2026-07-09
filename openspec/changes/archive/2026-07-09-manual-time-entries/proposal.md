## Why

Story 6 (`docs/user-stories.md`): the timer only captures time live — users cannot record forgotten work or correct mistakes. Manual creation, per-entry editing (start/stop/title), and deletion complete the entry lifecycle. Additionally, the topbar running-timer widget gains an agreed extension: editing the running entry's start date/time by clicking the elapsed time.

## What Changes

- **Manual entry creation**: each day section on the timer view gets a "+ add entry" action; the user provides start and end times (hour + minutes) and an optional title (same autocomplete/task-binding rules as the timer). `POST /api/time-entries` accepts an explicit `startedAt`/`stoppedAt` pair for an already-stopped entry.
- **Editable `startedAt`**: `PATCH /api/time-entries/[id]` (REQ-TTR-039) accepts `startedAt`. Validation: `startedAt ≤ stoppedAt` for stopped entries, `startedAt ≤ now` for running entries; overlap with other entries is allowed; moving across midnight regroups the entry to another day.
- **Inline per-entry editing**: expanded task-group rows on the timer view (REQ-TTR-046) lose their read-only constraint; each entry row allows inline edit of start time, stop time, and title (retitle splits the entry off to another/new task, leaving the group untouched).
- **Delete entry + task GC**: new `DELETE /api/time-entries/[id]` with per-entry delete control (confirm step); when the deleted entry was its task's last entry, the task is hard-deleted.
- **Topbar running-entry start edit**: clicking the elapsed time in the timer widget (REQ-NFR-026) opens a popover with a date field and one hour+minutes input for the start; committing PATCHes `startedAt`; the resulting start must not be in the future (long elapsed times like 24h+ are legitimate).
- `docs/user-stories.md` story 6 acceptance criteria updated to mention the topbar start edit.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `time-tracking`: REQ-TTR-036 (manual `startedAt`/`stoppedAt` on create), REQ-TTR-039 (editable `startedAt` + validation), REQ-TTR-046 (per-entry inline edit/delete, "+ add entry"), REQ-NFR-026 (elapsed-time click → start edit popover), plus a new delete-entry requirement with task garbage collection.

## Impact

- Server: `POST/PATCH /api/time-entries`, new `DELETE /api/time-entries/[id]`, `shared/types/time-entry.ts` zod schemas.
- App: timer view page components (inline editing, add-entry dialog, delete), timer widget popover, `useTimer` composable.
- i18n `en`/`pl` catalogs; unit/e2e/nuxt tests.

## Non-goals

- No duration-based input mode (start/end only).
- No overlap prevention or warnings between entries.
- No bulk edit/delete; no editing entries of other users (unchanged scoping).
- No changes to reporting, settings, or remote-tracker features.
