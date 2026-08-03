## Context

Task identity is `(userId, name, projectId)`, enforced by `tasks_userId_projectId_name_unique` and `tasks_userId_name_unique … WHERE projectId IS NULL`, and resolved by `resolveTaskId()` in `server/utils/tasks.ts`. The remote issue reference is a side record in `remote_issue_refs`, unique on `taskId`.

A spike traced the whole sync/export path. Everything downstream of the picker keys off `taskId`: `GET /api/sync/day` groups rows by `row.taskId`, `POST /api/sync/export` asserts `issueRef.remoteIssueId === payload.remoteIssueId` and writes append-only `remote_exports(taskId, remoteIssueId, localDate)`, and the adapter contract takes `remoteIssueId` per push (`shared/types/remote-adapter.ts`). Nothing assumes "one reference per `(name, project)`".

Day-scoping is already built: `POST /api/time-entries/reassign` (REQ-179) find-or-creates the target task from the ids of one day's entries and garbage-collects the emptied source. `PATCH /api/tasks/[id]` is no longer called from `app/`. The only remaining task-global mutation from the timer view is `POST/DELETE /api/tasks/{taskId}/remote-issue-ref`.

Offline support is explicitly long-term (WBS 8.1), so a convergent, id-based operation model is not a constraint for this change.

## Goals / Non-Goals

**Goals:**
- Two tasks may share `(user, project, name)` when they point at different remote issues.
- Linking, replacing and unlinking a remote issue affect only the day whose entries were edited.
- The export path and adapter contract stay untouched.
- Continuing a task inherits its remote issue reference.

**Non-Goals:**
- Entry-owned title/project/reference, or removing the task entity.
- Convergent offline replay semantics.
- Retroactive rewriting of export provenance.

## Decisions

### Put `remoteIssueId` in the task identity key, do not move the reference to the entry

| | (a) reference → time entry | (b) `remoteIssueId` in task identity | (c) full entry snapshot |
|---|---|---|---|
| item 3 (two issues, one name) | solved | **solved** | solved |
| item 4 (day isolation for refs) | by construction | via day-scoped reassignment | by construction |
| `sync/day.get.ts` | must regroup by `(taskId, remoteIssueId)` or a row's `totalSeconds` mixes two issues → wrong export | **no change** | rewritten |
| `sync/export.post.ts` | must verify all `entryIds` share one reference | **no change** | rewritten |
| `sync/[date].vue` | `localIssueRefs` and `row.taskId` row keys break | ~no change | rewritten |
| `timerViewGrouping.ts` | grouping key must gain the reference | reference falls out of `taskId` | rewritten |
| `resolveTaskId` | untouched | **ambiguous** — needs a tie-break | removed |
| offline convergence | good | poor | best |
| size | large | **moderate** | largest |

(b) is chosen: it buys both behaviours the user asked for at a fraction of the blast radius, and the spike proved the export path is indifferent to it. Its two costs are accepted deliberately, and each has a named mitigation below. (a) and (c) remain the documented long-term direction if offline support is ever built — recorded here so the decision is revisitable rather than forgotten.

### Denormalize onto the task row and drop `remote_issue_refs`

A key spanning two tables cannot be enforced by a unique index. Keeping the table *and* a denormalized copy would mean two sources of truth. So the reference's columns (configuration provenance, `remoteIssueId`, cached title) move onto `tasks` and the table is dropped. `RemoteIssueRefDto` survives as a nested boundary shape derived from the task row, so `TaskDto.remoteIssueRef` and `TimeEntryDto.remoteIssueRef` keep their current shape and the client's reading code is largely unchanged.

Uniqueness uses PostgreSQL 18's `UNIQUE NULLS NOT DISTINCT` on `(userId, projectId, name, remoteIssueId)`, so an unlinked task is one bucket rather than infinitely many. The project-less scope keeps its predicate index, likewise `NULLS NOT DISTINCT`. Alternative considered: a generated non-null sentinel column (`coalesce(remoteIssueId, '')`) — rejected as a workaround for a constraint the database already supports natively.

The migration fans each `remote_issue_refs` row onto its task, then rebuilds the indexes. It cannot create duplicates (the source was unique per `taskId`), so it is a pure widening: no rows merge, none split, and `remote_exports.taskId` keeps pointing at the same rows.

### Linking becomes a day-scoped reassignment; the task-global endpoints are removed

With the reference in the key, "attach a reference to this task" is no longer meaningful — it would change the row's identity underneath other days. Instead `POST /api/time-entries/reassign` gains an optional remote issue field with three-way presence semantics matching the existing `projectId`: **omitted** keeps the source task's reference, explicit **`null`** targets the unlinked twin, and a **value** targets the task carrying that issue (find-or-create). Unlink therefore stops being a delete and becomes a move — REQ-105's "SHALL NOT touch the remote tracker" still holds, because nothing remote is called either way.

`POST/DELETE /api/tasks/{id}/remote-issue-ref` are deleted rather than kept as aliases: leaving a task-global path in place would preserve exactly the cross-day bug this change exists to fix. The sync review page, which posts to them today, moves to the same day-scoped call — natural, since that page is already scoped to one date.

### Free-form titles resolve most-recently-used

`resolveTaskId('Fix bug')` can now match several tasks. The tie-break is the task whose entries were used most recently in that `(user, project, name)` scope, preferring a task over creating one. Rejecting ambiguity and forcing a choice was considered and rejected: it would make the top-bar's fastest path (type and hit Enter) fail exactly when the user is busiest. Explicit control lives in the suggestion list — each suggestion already appends its remote issue id (REQ-180) — plus the create-new-task option from `timer-view-ux-polish`, which is why that change should land first.

Continuation (REQ-152) passes the group's task identity, so it inherits the reference by construction.

### The REQ-134 reference-merge rules are deleted, not weakened

Differing references now mean different tasks, so the 409 and the "preserve a sole reference" / "collapse identical references" scenarios have no subject left. This is a deliberate spec deletion, stated explicitly so it is not mistaken for an oversight.

## Risks / Trade-offs

- **More task rows, churned more often.** Every day-scoped reference change find-or-creates and may garbage-collect. `remote_exports.taskId` is a foreign key to a row GC may delete — its `ON DELETE` behaviour must be verified and, if unguarded, changed so export history is never orphaned or GC never blocked. This is a hard prerequisite, tracked as a task.
- **Renaming onto an existing name still merges days.** Day isolation holds only because every timer-view edit goes through find-or-create; adding the reference to the key narrows the merge window but does not close it. Accepted, and the honest limitation of keeping tasks as identity holders.
- **A name can now appear twice in the task list and autocomplete.** Mitigated by labels that carry the remote issue id, but two tasks differing only by an unlinked-vs-linked state can still look alike.
- **The tie-break is a heuristic.** Most-recently-used will occasionally bind to the "wrong" `title1`; the create option and the suggestion list are the escape hatches.
- **`NULLS NOT DISTINCT` requires PostgreSQL ≥ 15.** The project already requires ≥ 18.
- **One-way migration.** Reverting means re-extracting a side table; acceptable for a single-user self-hosted app, but the migration must be verified against a database with linked, unlinked and project-less tasks.
