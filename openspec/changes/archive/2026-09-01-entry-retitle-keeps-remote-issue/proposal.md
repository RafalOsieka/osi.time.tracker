## Why

Retitling a single time entry (timer-view row or running top-bar title) goes through `PATCH /api/time-entries/[id]` with `{ title }` only. The server already keeps the current **project** (REQ-143) but re-resolves the name with **no** remote issue, so a new unlinked task is created and `#issue` disappears. Group-header rename already keeps the issue via `POST /api/time-entries/reassign` (REQ-179). Users treat both UIs as “change this name”; losing the link on entry edit is surprising, especially with one entry on the day.

This is in MVP scope: WBS 3.3 (implicit task lifecycle) and user story 5 (inline retitle splits only that entry).

## What Changes

- Title-only `PATCH` of an existing entry SHALL preserve the current task’s remote issue the same way it already preserves project: omit means keep; find-or-create `(name, project, remoteIssueId)`.
- An unlinked source stays unlinked. An untitled source (`taskId` null) still creates an unlinked task.
- Explicit `taskId` still binds to that task (suggestion pick). Explicit `projectId: null` still moves to the project-less scope; remote-issue keep applies only when the remote issue is not being changed by another field.
- **Not BREAKING** for clients: the timer row and top bar already send `{ title }`; the server copies the current remote issue.

## Non-goals

- Group-header / day-scoped `reassign` (already keeps the issue).
- Moving `RemoteIssueRef` onto the time entry, or a dedicated entry-title column.
- Changing idle `POST /api/time-entries` (new work stays unlinked / MRU).
- New unlink API; unlink stays `reassign` with `remoteIssueId: null`.
- Garbage-collecting emptied tasks on PATCH (pre-existing gap).
- Cross-day “rename everywhere.”

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `time-tracking`: REQ-143 title-only patch keeps the current remote issue; REQ-142 retitle-from-an-entry is exact-key resolution, not “new unlinked.”
- `task-management`: REQ-137 distinguishes start (unlinked / MRU) from retitle of a linked entry (keep the issue).

## Impact

- `server/api/time-entries/[id].patch.ts` and `resolveTaskId` call site: copy `remoteIssueId` (and tracker cache) from the current task when title is re-resolved without `taskId`.
- API tests for title-only PATCH with a linked source; UI coverage for entry-row and running-title retitle.
- Specs: `openspec/specs/time-tracking/spec.md`, `openspec/specs/task-management/spec.md`.
