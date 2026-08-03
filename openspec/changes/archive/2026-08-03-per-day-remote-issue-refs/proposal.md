## Why

Two everyday situations are currently impossible or wrong. (1) A task titled `title1` in project *Portal* can carry only one remote issue, because `remote_issue_refs` is unique per `taskId` and task identity is `(userId, projectId, name)` — so logging the same work title against a second issue cannot be represented. (2) Linking or unlinking a remote issue from the timer view calls `POST/DELETE /api/tasks/{taskId}/remote-issue-ref`, which rewrites the shared task row and therefore silently changes every other day that used it. Everything else in the timer view is already day-scoped through `POST /api/time-entries/reassign` (REQ-179); the remote issue reference is the last globally-scoped mutation left.

## What Changes

- **BREAKING** Task identity gains the remote issue: the matching key becomes `(userId, projectId, name, remoteIssueId)` with `remoteIssueId IS NULL` meaning unlinked. `title1 #4711` and `title1 #4899` become two distinct tasks in the same project.
- Denormalize the reference onto the task row (configuration provenance, `remoteIssueId`, cached title) and drop the separate one-to-one `remote_issue_refs` table; uniqueness is enforced with `NULLS NOT DISTINCT` so at most one unlinked task exists per `(user, project, name)`.
- Extend `POST /api/time-entries/reassign` (REQ-179) with an optional remote issue so linking, replacing and unlinking are **day-scoped moves of that day's entries** to the find-or-create target task. Remove `POST/DELETE /api/tasks/{id}/remote-issue-ref`.
- Free-form title resolution becomes explicitly tie-broken (most recently used task for that name/project scope), with the top-bar create-new-task option (`timer-view-ux-polish`) as the escape hatch.
- **BREAKING** Delete REQ-134's reference-merge rules, including the HTTP 409 "both tasks have different references": differing references now mean different tasks, so there is no collision to reject.

## Non-goals

- Moving the reference onto the time entry, or removing the task entity — the deferred long-term direction, revisited when offline support is designed.
- Any change to the export path: `GET /api/sync/day` and `POST /api/sync/export` already key off `taskId` and stay as they are, as does the adapter contract.
- Rewriting historical `remote_exports` rows (append-only provenance stays as recorded).
- Cross-day propagation as an opt-in feature ("rename everywhere").

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `task-management`: the uniqueness/matching key gains `remoteIssueId`; merge-on-collision loses its reference rules and its 409; free-form title matching gains a defined tie-break.
- `remote-issue-linking`: the reference is stored on the task row instead of a one-to-one record, and linking/replacing/unlinking are day-scoped reassignments rather than task-global mutations.
- `time-tracking`: `POST /api/time-entries/reassign` carries the remote issue; the timer view's group editor links and unlinks for one day only.

## Impact

- `server/db/schema/tasks.ts` + drop `remote-issue-refs.ts`, one migration fanning refs onto tasks and rebuilding the unique indexes with `NULLS NOT DISTINCT`.
- `server/utils/tasks.ts` (`resolveTaskId` tie-break), `server/utils/remote-issue-refs.ts`, `server/api/tasks/[id].patch.ts`, `server/api/time-entries/reassign.post.ts`; delete `server/api/tasks/[id]/remote-issue-ref.{post,delete}.ts`.
- `shared/types/task.ts`, `time-entry.ts`, `remote-issue-ref.ts`.
- `app/components/TimerTaskGroup.vue`, `app/pages/sync/[date].vue`, `app/utils/taskSuggestionLabel.ts`.
- `i18n/locales/en.json` / `pl.json`.
