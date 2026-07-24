## Context

The timer view groups a user's time entries by `(effective-timezone day, taskId)`. Because a task can be used across many days, the inline group editors (title/project) currently commit through `PATCH /api/tasks/[id]`, which mutates the **task itself** — renaming/re-projecting it (or merging it, REQ-134) across every day it appears. Users expect the edit to affect only the day they are looking at.

The top-bar timer widget (`AppTimer.vue`) offers a title autocomplete backed by `GET /api/tasks?search=`. Today it passes only the typed `title` to `POST /api/time-entries`, so `resolveTaskId(name, projectId=null)` find-or-creates a **project-less** task rather than binding to the picked one. The autocomplete is also mis-wired (string-mode menu over object items plus a nested clickable button), causing duplicate selection paths and `[object Object]` titles, and the elapsed-time popover anchors to an empty sibling instead of the elapsed control.

Constraints: the server has no notion of "day" (entries carry only `startedAt` instants); day boundaries are client-side. Existing primitives — `resolveTaskId` (find-or-create), the merge/GC pattern in `tasks/[id].patch.ts`, and the `bulk-assign` shape (`{ ids, title, projectId? }`) — cover everything needed.

## Goals / Non-Goals

**Goals:**

- Day-scoped title/project edits on the timer view that move only that day's entries.
- Reliable start-from-suggestion that binds the entry to the exact picked task (project + remote ref).
- Fix the popover anchor and the duplicate-request/`[object Object]` bug.

**Non-Goals:**

- Server-side day/timezone logic (the client keeps computing day boundaries and passes entry ids).
- Cloning remote issue refs when moving entries (decision: just move; target keeps whatever ref it has).
- Changing the global `PATCH /api/tasks/[id]` merge semantics (REQ-134) — it stays; the timer view simply stops using it for group edits.

## Decisions

**D1 — Day-scoped reassign takes entry ids, not a day.** The client already knows the group's entry ids for that day, so a new `POST /api/time-entries/reassign` accepts `{ ids, name?, projectId? }`: in one transaction it reads the source task's `projectId`, `resolveTaskId(name, effectiveProjectId)` find-or-creates the target, re-points the listed entries, then GCs any emptied source task. This mirrors `bulk-assign` (REQ-149) and avoids teaching the server about calendar days. _Alternative:_ send a day boundary + taskId and let the server select entries — rejected because it duplicates the client's timezone logic on the server.

**D2 — No remote-ref cloning; entries just move.** Per the locked decision, the target task keeps its own ref (or none if freshly created). _Alternative:_ clone the source ref onto a freshly created target — rejected as extra complexity the user explicitly declined.

**D3 — Explicit `taskId` on start/patch for chosen suggestions.** `POST /api/time-entries` and `PATCH /api/time-entries/[id]` gain an optional `taskId`; when present and owned by the user, the entry binds to it directly (server owns identity), bypassing title matching. Free-form titles (no suggestion picked) keep the existing title-based `resolveTaskId` path. _Alternative (Option A):_ thread `projectId` from the client-side `TaskDto` — rejected because not all tasks are loaded in the front end and it reconstructs identity client-side.

**D4 — Single object-based suggestion handler + proper popover anchor.** Wire the menu to object items with one `@update:model-value` handler (drop the string cast and the nested `<button>`), and make the elapsed control the popover's anchor/trigger. Purely front-end; D4 unblocks D3's clean selection capture.

## Risks / Trade-offs

- [Reassign could target entries the user didn't intend if the client sends stale ids] → server validates every id is owned by the user and belongs to the source task/day grouping the client computed; reject the whole request atomically otherwise.
- [`taskId` bypass could bind to a foreign/soft-deleted task] → validate ownership (HTTP 404 on foreign/unknown) and resolve project/name from the task server-side.
- [Whole-task single-day rename now creates/moves instead of in-place rename, changing the task id] → acceptable per locked decision (move-only); history follows the entries.
- [i18n drift] → add any new strings to `en`/`pl` in the same change.

## Migration Plan

- Additive server changes (new endpoint, optional `taskId`); no schema migration required.
- Deploy server before/with client; old clients keep working via the title path.
- Rollback: revert client to `PATCH /api/tasks/[id]` group commits and drop the new endpoint — no data migration to undo.

## Open Questions

- None — the three prior open questions (move-only, server-side `taskId`, day-scoped project edits) are resolved.
