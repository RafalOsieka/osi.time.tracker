## Context

See `proposal.md` for why. Entry title edits (timer-view row and running top-bar) already `PATCH /api/time-entries/[id]` with `{ title }` only. The handler copies the current task’s `projectId` when omitted, then calls `resolveTaskId` **without** `remoteIssueId`, which uses the bare-title tie-break and creates an **unlinked** task when the new name is unknown. Day-scoped `POST /api/time-entries/reassign` already passes the source remote issue into `resolveTaskId` (omit = keep). No schema or client contract change is required if PATCH does the same copy.

## Goals / Non-Goals

**Goals:**
- Title re-resolution on PATCH of an entry that already has a task uses the four-part key `(name, projectId, remoteIssueId)` with the **current** remote issue (null = unlinked).
- Copy tracker provenance and cached issue/project titles so a newly created same-issue twin still displays `#id` and tooltip text.
- Leave idle `POST /api/time-entries` and explicit `taskId` patches unchanged.

**Non-Goals:**
- Adding `remoteIssueId` to `updateTimeEntrySchema`.
- Switching the timer row or top bar to `reassign`.
- Garbage-collecting emptied tasks on PATCH (pre-existing; out of proposal scope).
- Client UI changes beyond tests that lock the existing `{ title }` payloads.

## Decisions

### Infer the current remote issue on the server, do not add a PATCH field

When `parsedBody.taskId` is absent and title/`projectId` re-resolution runs **and** `existing.taskId` is set, load the current task’s `remoteIssueId`, `trackerId`, `remoteIssueCachedTitle`, and `remoteIssueCachedProjectTitle` (alongside name/project already loaded) and pass them into `resolveTaskId` as `{ remoteIssueId, trackerId, cachedTitle, cachedRemoteProjectTitle }`. Untitled entries (`existing.taskId` null) keep today’s bare-title call.

This matches how omitted `projectId` already works and how `reassign.post.ts` keeps a remote issue.

**Alternative considered:** add optional `remoteIssueId` to the PATCH body (omit / null / value). Rejected: every current client would have to start sending it; forgetting it would still unlink. The keep is a server invariant, not a client hint.

**Alternative considered:** change `TimerEntryRow` and `AppTimer` to `POST /api/time-entries/reassign` with `{ ids: [id], name }`. That would also GC emptied tasks, but it mixes a single-entry edit with the day-scoped group API, and the running widget would need a new code path. Deferred; GC stays a non-goal.

### Exact key for unlinked retitle, not MRU among linked twins

Passing `remoteIssueId: null` (property present) is required so `resolveTaskId` uses the unlinked four-part key. Do not omit the option: omission is the bare-title MRU path used by POST start.

### No client payload change

`TimerEntryRow.commitTitle` and `useTimer().updateTitle` already send `{ title }` when no suggestion `taskId` is captured. After the server copy, those paths keep the issue. Picking a suggestion still sends `{ taskId }` and binds to that task’s issue. The top-bar “(new task)” option while **running** becomes a title-only PATCH and therefore **keeps** the current issue; idle start stays POST bare-title (unlinked / MRU). Accepted as consistent with “retitle this interval, same assignment.”

## Risks / Trade-offs

- **[Running “new task” keeps the issue]** → Mitigation: unlink remains the group remote-issue control; idle create-new-task is unchanged. Document in specs (REQ-143 running free-form scenario).
- **[Emptied source task left behind]** → Same as today’s PATCH retitle. Mitigation: out of scope; reassign still GCs group edits.
- **[Project-less + kept remote issue]** → Allowed by uniqueness. Remote picker still requires a project with a tracker (existing UI). No extra PATCH validation.

## Migration Plan

No database migration. Deploy the PATCH handler; clients keep sending `{ title }`. Rollback is reverting that handler.

## Open Questions

None. Specs pin keep-vs-tie-break; GC and PATCH-body shape are decided above.
