## 0. Prerequisites

- [x] 0.1 Verify the `remote_exports.taskId` foreign key against task garbage collection (a linked task whose last entry moves away): confirm export history is neither orphaned nor blocking the delete, and adjust the `ON DELETE` behaviour (plus a migration) if it is unguarded
- [x] 0.2 Integration test proving an export record survives garbage collection of its task
- [x] 0.3 Land `timer-view-ux-polish` item 2 (create-new-task option) first — it is the disambiguation escape hatch for the tie-break introduced here

## 1. Backend: schema and migration

- [x] 1.1 Add the reference columns (configuration provenance, nullable `remoteIssueId`, cached title, reference timestamps) to `server/db/schema/tasks.ts`
- [x] 1.2 Replace the task unique indexes with `(userId, projectId, name, remoteIssueId)` and `(userId, name, remoteIssueId) WHERE projectId IS NULL`, both `NULLS NOT DISTINCT`
- [x] 1.3 Generate the migration (`pnpm db:generate`) and hand-complete it: fan every `remote_issue_refs` row onto its task, rebuild the indexes, then drop `remote_issue_refs`; remove `server/db/schema/remote-issue-refs.ts`
- [x] 1.4 Migration test against a seeded database containing linked, unlinked, project-less and multi-day tasks: every reference preserved inline, no task merged or removed, `remote_exports.taskId` still resolvable, table gone
- [x] 1.5 Constraint test: a second unlinked task with the same `(user, project, name)` is rejected, while the same name with a different `remoteIssueId` is accepted (both project-scoped and project-less)

## 2. Backend: task resolution and boundary types

- [x] 2.1 Extend `resolveTaskId()` in `server/utils/tasks.ts` with an optional remote issue: full four-part find-or-create when supplied, most-recently-used tie-break over `(userId, name, projectId)` when not
- [x] 2.2 Unit-test the tie-break: single candidate, several candidates ordered by newest entry `startedAt`, candidate with no entries, no candidate (creates unlinked), explicit remote issue bypassing the tie-break
- [x] 2.3 Rewrite `server/utils/remote-issue-refs.ts` to read and write the reference on the task row, keeping the derived issue URL logic and the `RemoteIssueRefDto` shape; update `shared/types/task.ts`, `time-entry.ts`, `remote-issue-ref.ts`
- [x] 2.4 Drop the reference-merge branches and the 409 from `server/api/tasks/[id].patch.ts`; collision scope now includes the unchanged `remoteIssueId`
- [x] 2.5 Integration tests for `PATCH /api/tasks/[id]`: merge when name/project/issue all collide, no merge and no 409 when only the issue differs, remote issue never changed by this endpoint, foreign id → 404

## 3. Backend: day-scoped reassignment carries the remote issue

- [x] 3.1 Extend the reassign boundary schema with `remoteIssueId` using three-way presence semantics (omitted / explicit null / value), mirroring `projectId`
- [x] 3.2 In `server/api/time-entries/reassign.post.ts` derive configuration provenance and cached issue title server-side from the target project's client; reject a project-less target, missing/inactive configuration or unsupported `systemType` with `{ messageKey, params }`
- [x] 3.3 Resolve the four-part key once, move all listed entries, and garbage-collect the emptied source task in the same transaction
- [x] 3.4 Integration tests for `POST /api/time-entries/reassign`: day-scoped link leaves other days untouched, explicit null unlinks day-scoped, omitted field keeps the current issue, two issues under one name coexist, ineligible target rejected, foreign entry id → 404, source task garbage-collected
- [x] 3.5 Delete `server/api/tasks/[id]/remote-issue-ref.post.ts` and `.delete.ts`; integration test asserting both routes are absent

## 4. Frontend: timer view group

- [x] 4.1 Route link / replace / unlink in `app/components/TimerTaskGroup.vue` through the reassign call with that day's entry ids instead of the task-global reference endpoints
- [x] 4.2 Regroup and refresh the running-timer state after a reference change, since entries now move between tasks
- [x] 4.3 Component tests (`test/nuxt`) for `TimerTaskGroup`: link, replace and unlink each send the day's entry ids to reassign and never call a task-global route; Escape cancels

## 5. Frontend: sync review page and labels

- [x] 5.1 Replace the `POST /api/tasks/{id}/remote-issue-ref` call in `app/pages/sync/[date].vue` with the day-scoped reassign for that date's entries of the row, refreshing the row in place
- [x] 5.2 Confirm `app/utils/timerViewGrouping.ts` and `app/utils/taskSuggestionLabel.ts` need no key change (the reference now falls out of `taskId`) and cover same-name-different-issue rows with unit tests
- [x] 5.3 Add or adjust i18n keys for day-scoped link/unlink wording in `en.json` and `pl.json` in parity

## 6. E2E coverage

- [x] 6.1 E2E: same title and project on two days, link each day to a different remote issue, and assert both days keep their own issue and both tasks exist
- [x] 6.2 E2E: unlink one day's group and assert the other day's group still shows its issue
- [x] 6.3 E2E: rename a day's group onto a name held by a task with a different remote issue and assert no error and no merge
- [x] 6.4 E2E: continue a linked task group and assert the new running entry carries the same remote issue
- [x] 6.5 E2E: link a remote issue from the sync review page and assert the row flips in place and the export still targets that issue

## 7. Verification

- [x] 7.1 Run `pnpm db:migrate` against the local database and confirm the fan-out, index rebuild and table drop apply cleanly
- [x] 7.2 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`
- [x] 7.3 Run `pnpm test:unit`, `pnpm test:nuxt`, `pnpm test:e2e`
- [x] 7.4 Manually exercise a full day export after a day-scoped relink to confirm `GET /api/sync/day` and `POST /api/sync/export` were genuinely unaffected
