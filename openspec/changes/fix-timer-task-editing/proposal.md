## Why

Four defects cluster around editing a timer task from the shell and the timer view. Editing a group's title/project on the timer view renames the task **globally** across every day it appears (via `PATCH /api/tasks/[id]`), instead of only that day's entries. Starting from the top-bar suggestion list loses the picked task's identity (project/remote issue), the elapsed-time popover is mis-anchored, and mouse-selecting a suggestion fires duplicate requests that end up titling the entry `[object Object]`.

## What Changes

- Add a **day-scoped reassign** server operation that moves a set of the user's time entries to a find-or-create target task (by name + the source task's project), then garbage-collects an emptied source task — no remote-ref cloning, entries simply move.
- **BREAKING (timer view behavior):** the inline group title/project editors on the timer view SHALL reassign only that day's entries via the new operation, instead of globally renaming/re-projecting the task via `PATCH /api/tasks/[id]`.
- Top-bar start SHALL send an explicit **`taskId`** when the user picks an existing suggestion, so the server binds the entry to the exact task (project + remote ref) rather than title-matching into a project-less task; free-form titles keep the title-based create path.
- Top-bar suggestion labels SHALL include the remote issue id when present.
- Fix the elapsed-time popover to anchor to the elapsed control, and make suggestion selection a single object-based handler (no duplicate requests, no `[object Object]`).

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `time-tracking`: add a day-scoped entry-reassignment requirement; change the timer-view inline group editor (REQ-153) to reassign that day's entries; refine the top-bar timer widget (REQ-146) start-from-suggestion binding, popover anchoring, and suggestion labels.

## Impact

- Server: new `POST /api/time-entries/reassign` (or equivalent) handler + `resolveTaskId`/GC reuse; `POST /api/time-entries` and `PATCH /api/time-entries/[id]` accept an optional `taskId`.
- Client: `AppTimer.vue` (popover anchor, object-based suggestion select, labels, `taskId` on start), `TimerTaskGroup.vue` (day-scoped commit), `useTimer.ts`.
- Boundary types in `shared/types`; i18n `en`/`pl` parity for any new strings.
- Tests: unit (server op), nuxt (component wiring), e2e (day-scoped rename, start-from-suggestion).
