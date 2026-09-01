# task-management Specification

## Purpose
Define authenticated, user-scoped CRUD for Tasks (the leaf of the `Client → Project → Task` hierarchy), with an optional project assignment (project-less tasks allowed), task names unique within a user's project scope, project ownership validation when assigned, soft delete, implicit task creation/matching from time-entry titles, and an accessible PrimeVue Dialog-based UI. The `uuidv7` `id` is the API identifier. All task endpoints follow the shared `api-endpoint-conventions` (authentication, CSRF, the translated error contract, strict per-user isolation, and boundary validation).

## Requirements

### Requirement: REQ-132 Task hard-delete lifecycle and merge invariant
Tasks SHALL have no soft-delete state: the `tasks` table SHALL carry no `deletedAt` column and task rows SHALL only ever be removed by hard delete. The system SHALL NOT expose a standalone task-delete endpoint; a task row is hard-deleted exactly when a merge (REQ-134) empties it of entries. Tasks SHALL be created only implicitly from time-entry titles (REQ-137) — no explicit create endpoint SHALL exist. A migration SHALL drop `tasks.deletedAt`, first hard-deleting previously soft-deleted task rows after setting their entries' `taskId` to `null`, and SHALL recreate the name-uniqueness indexes without the soft-delete predicate.

#### Scenario: No standalone create or delete endpoints
- **WHEN** a client calls `POST /api/tasks` or `DELETE /api/tasks/[id]`
- **THEN** the system SHALL respond with HTTP 404 or 405 (route absent)

#### Scenario: Merge hard-deletes the emptied task
- **WHEN** an edit merges a task into a survivor, leaving it with no entries
- **THEN** the emptied task row SHALL be hard-deleted in the same transaction

#### Scenario: Migration cleans up soft-deleted tasks
- **WHEN** the migration runs against a database containing soft-deleted task rows
- **THEN** those rows SHALL be removed, their entries SHALL become untitled (`taskId` `null`), and the `deletedAt` column SHALL be dropped

### Requirement: REQ-133 List own tasks
The system SHALL show the authenticated user only their own tasks, ordered by `name`, via `GET /api/tasks`. The list SHALL exclude any task belonging to another user. Each returned task SHALL include its `uuidv7` `id`. The endpoint SHALL accept an optional `projectId` query parameter that further restricts results to that project, always additionally scoped by `userId`; a dedicated sentinel value (`projectId=none`) SHALL restrict results to project-less tasks (`projectId IS NULL`). The endpoint SHALL additionally accept an optional `search` query parameter that restricts results to tasks whose `name` contains the value case-insensitively, to power title autocomplete. Each returned task SHALL include the owning project's name (`projectName`) and the owning client's name (`clientName`) resolved via LEFT joins that do NOT filter on the project's or client's `deletedAt`, so the names are present even when a parent has been soft-deleted; for a project-less task both `projectId`, `projectName`, and `clientName` SHALL be `null`.

#### Scenario: User sees only their own tasks
- **WHEN** an authenticated user requests their tasks
- **THEN** the response SHALL contain only tasks where `userId` equals the user's id, ordered by `name`

#### Scenario: Response includes the project and client names
- **WHEN** an authenticated user lists their tasks
- **THEN** each returned task SHALL include a `projectName` field and a `clientName` field naming its owning project and client

#### Scenario: Names persist after a parent is soft-deleted
- **WHEN** a task's owning project (or its client) has been soft-deleted
- **THEN** the task SHALL still appear in the list with its `projectName` and `clientName` populated from the soft-deleted parent

#### Scenario: Filter by project
- **WHEN** an authenticated user requests their tasks with a `projectId` filter for a project they own
- **THEN** the response SHALL contain only their tasks belonging to that project

#### Scenario: Filter by a foreign or unknown project
- **WHEN** an authenticated user requests tasks with a `projectId` that is unknown or owned by another user
- **THEN** the system SHALL return an empty list and SHALL NOT reveal whether that project exists

#### Scenario: Search by name
- **WHEN** an authenticated user requests their tasks with a `search` value
- **THEN** the response SHALL contain only their tasks whose `name` contains that value case-insensitively, with project/client context

#### Scenario: List includes project-less tasks
- **WHEN** an authenticated user has a task with no project and requests their tasks without a filter
- **THEN** the response SHALL include that task with `projectId`, `projectName`, and `clientName` all `null`

#### Scenario: Filter to project-less tasks
- **WHEN** an authenticated user requests their tasks with the sentinel `projectId=none`
- **THEN** the response SHALL contain only their tasks that have no project

### Requirement: REQ-134 Edit a task
The system SHALL allow an authenticated user to update the `name` and `projectId` of their own task via `PATCH /api/tasks/[id]`, addressing the task by its `uuidv7` `id` and applying the same `name` validation as title resolution (trimmed, non-empty, length-bounded). Editing SHALL be scoped by `userId`. The presence of the `projectId` field SHALL be significant: **omitting** `projectId` entirely SHALL keep the task's current project unchanged, an explicit **`null`** SHALL clear it to make the task project-less, and a **uuid** SHALL assign that project. The system SHALL NOT treat an absent `projectId` as an implicit `null`. Project ownership and non-deleted validation SHALL only be enforced when the `projectId` is changed to a different non-null project; omitting `projectId` and clearing to `null` SHALL always be allowed. When the effective `projectId` is unchanged from the task's current project (including because it was omitted), the system SHALL NOT validate that project's soft-delete status, so the task's `name` can still be edited after its project has been soft-deleted.

This endpoint SHALL NOT change a task's `remoteIssueId`; a task's remote issue is changed only by the day-scoped reassignment operation (REQ-179), which moves entries between tasks.

When the update would make the task's `(userId, name, projectId, remoteIssueId)` key collide with another existing task (the survivor), the system SHALL merge within a single transaction, computing the collision scope from the effective `projectId` (the current project when `projectId` was omitted) together with the task's unchanged `remoteIssueId`. All time entries of the edited Task SHALL be re-pointed to the survivor and the emptied edited Task SHALL be hard-deleted. Because a differing remote issue now yields a different key, two tasks with different remote issues SHALL NOT collide and the previous reference-merge rules — preserving a sole reference, collapsing identical references, and rejecting differing references with HTTP 409 — SHALL NO LONGER apply and SHALL be removed. A successful merge SHALL return the survivor including its resolved `projectName`, `clientName`, and remote reference.

#### Scenario: Successful edit
- **WHEN** an authenticated user submits a valid new name and an owned `projectId` for their own task, with no key collision
- **THEN** the system SHALL update the task and return it (including the resolved `projectName`, `clientName`, and remote reference)

#### Scenario: Rename keeps the current project when projectId is omitted
- **WHEN** an authenticated user submits a valid new name for their own task without including a `projectId` field in the request body
- **THEN** the system SHALL update only the `name` and SHALL leave the task's current `projectId` unchanged, returning the task with its existing project resolved

#### Scenario: Colliding edit merges tasks sharing the same remote issue state
- **WHEN** an authenticated user renames or re-projects their Task so its `(name, projectId, remoteIssueId)` matches another Task
- **THEN** the system SHALL move all entries to the survivor, hard-delete the emptied Task, and return the survivor within one transaction

#### Scenario: Differing remote issues no longer collide
- **WHEN** an authenticated user renames their Task to a name already used in the same project by a Task with a **different** remote issue
- **THEN** the rename SHALL succeed, both Tasks SHALL continue to exist, and the system SHALL NOT respond with HTTP 409

#### Scenario: Task patch never changes the remote issue
- **WHEN** a request to this endpoint carries any remote-issue field
- **THEN** the task's `remoteIssueId` SHALL remain unchanged

#### Scenario: Rename a task whose project is soft-deleted
- **WHEN** an authenticated user updates the `name` of their own task without changing its `projectId`, and that task's current project has been soft-deleted
- **THEN** the system SHALL allow the update and SHALL NOT reject it on account of the project's soft-delete status

#### Scenario: Clear the project assignment
- **WHEN** an authenticated user updates their own task and sets `projectId` to `null`
- **THEN** the system SHALL make the task project-less (merging per the collision rules if a project-less task with that name and the same remote issue state exists) and return the resulting task

#### Scenario: Assign a project to a project-less task
- **WHEN** an authenticated user updates a project-less task, setting `projectId` to a non-deleted project they own
- **THEN** the system SHALL validate ownership, assign the project, and return the task with the resolved `projectName`, `clientName`, and remote reference

### Requirement: REQ-135 Project relationship and ownership
Every task SHALL belong to at most one project owned by the same user, or to no project at all (project-less). On create when a non-null `projectId` is supplied, and on update when the `projectId` is changed to a different non-null project, the system SHALL validate that the target `projectId` references a non-deleted project owned by the authenticated user; a foreign or unknown `projectId` SHALL resolve to HTTP 404 without confirming the project's existence. Omitting `projectId` or setting it to `null` SHALL create/leave the task project-less without any project validation. When an update leaves the `projectId` unchanged, the system SHALL NOT re-validate the existing project's ownership or soft-delete status, allowing edits to a task whose project was later soft-deleted.

#### Scenario: Assigning a foreign project rejected
- **WHEN** an authenticated user creates or updates a task with a `projectId` owned by another user
- **THEN** the system SHALL respond with HTTP 404 and SHALL NOT reveal that the project exists

#### Scenario: Assigning an unknown project rejected
- **WHEN** an authenticated user creates or updates a task with a `projectId` that does not exist
- **THEN** the system SHALL respond with HTTP 404

#### Scenario: Unchanged project is not re-validated
- **WHEN** an authenticated user updates a task without changing its `projectId`
- **THEN** the system SHALL NOT re-validate the existing project's ownership or soft-delete status and SHALL allow the update

#### Scenario: Project-less task requires no project validation
- **WHEN** an authenticated user creates or updates a task with `projectId` omitted or `null`
- **THEN** the system SHALL treat the task as project-less and SHALL NOT perform any project ownership or soft-delete validation

### Requirement: REQ-136 Task name uniqueness per project and remote issue scope
Every task SHALL be uniquely identified among the user's tasks by `(userId, projectId, name, remoteIssueId)`, where `projectId = NULL` is a distinct project scope and `remoteIssueId = NULL` means unlinked. Two tasks MAY therefore share a user, project and name when they point at different remote issues. Uniqueness SHALL be enforced by unique indexes on `(userId, projectId, name, remoteIssueId)` and on `(userId, name, remoteIssueId) WHERE projectId IS NULL`, both declared `NULLS NOT DISTINCT` so that at most one **unlinked** task exists per `(userId, projectId, name)` scope rather than unboundedly many. This key is the matching key that determines which task a time-entry title resolves to and which task survives a merge.

#### Scenario: Same name in two projects allowed
- **WHEN** a user has a task named "Code review" in project A and creates "Code review" in project B
- **THEN** both tasks SHALL be allowed because they occupy different project scopes

#### Scenario: Same name and project with different remote issues allowed
- **WHEN** a user has a task named "title1" in project A linked to remote issue `4711` and links a second "title1" in project A to remote issue `4899`
- **THEN** both tasks SHALL exist as distinct rows

#### Scenario: One unlinked task per name and project
- **WHEN** a user already has an unlinked task named "Code review" in a given project scope
- **THEN** the system SHALL NOT create a second unlinked task with that name in that scope; a title resolution SHALL match the existing one

#### Scenario: One project-less task per name and remote issue
- **WHEN** a user already has a project-less unlinked task named "Code review"
- **THEN** a second project-less unlinked "Code review" SHALL NOT be created, while a project-less "Code review" linked to a remote issue SHALL be allowed

### Requirement: REQ-137 Implicit task creation and matching via time entries
The system SHALL create and match tasks implicitly from time-entry titles as defined by the time-tracking capability, using the matching key `(userId, name, projectId, remoteIssueId)`. Implicitly created tasks SHALL be first-class tasks that appear in `GET /api/tasks` and its `search` results. No task `number` SHALL be assigned to any task (implicit or explicit).

Because a bare title no longer identifies a single task, resolution from a title alone SHALL apply a defined tie-break: among the user's tasks matching `(userId, name, effectiveProjectId)` the system SHALL select the task whose entries were **most recently used** (greatest `startedAt` among its time entries, falling back to the task's own creation order when it has none), and SHALL create a task only when no candidate exists. The system SHALL NOT reject a title for being ambiguous, and SHALL NOT create a duplicate task when a candidate exists. A caller that needs a specific task SHALL send that task's `id` instead of a title (REQ-143, REQ-180).

The bare-title tie-break SHALL apply to **new** entries (start or manual create) whose request supplies no remote issue. When the caller supplies an explicit remote issue (REQ-179), or when an existing entry that already has a task is retitled via PATCH without a `taskId` (REQ-143), resolution SHALL use `(userId, name, projectId, remoteIssueId)` and find-or-create exactly that task, using the current task's remote issue on PATCH-retitle (null meaning unlinked).

#### Scenario: Titling an entry creates a matching task
- **WHEN** a user starts or manually creates a time entry with a new title in a project scope and no remote issue
- **THEN** the system SHALL create an unlinked task with that name in that scope and it SHALL appear in the task list

#### Scenario: Retitling a linked entry keeps the remote issue
- **WHEN** a user retitles an existing time entry whose task is linked to a remote issue, using a new title and no `taskId`
- **THEN** the system SHALL find-or-create a task with that name in the same project scope carrying the same remote issue, and SHALL NOT create an unlinked task for that name

#### Scenario: Retitling an unlinked entry stays in the unlinked key
- **WHEN** a user retitles an existing time entry whose task has no remote issue, using a new title and no `taskId`
- **THEN** the system SHALL find-or-create the unlinked task of that name in the same project scope and SHALL NOT bind to a differently linked twin via the most-recently-used tie-break

#### Scenario: Titling an entry reuses an existing task
- **WHEN** a user titles a **new** time entry with a name that already exists in the target project scope and supplies no remote issue
- **THEN** the entry SHALL bind to the existing task (most recently used when several remote-issue twins exist) and no duplicate task SHALL be created

#### Scenario: Ambiguous title binds to the most recently used task
- **WHEN** a **new** entry's title matches several tasks in the target project scope that differ by remote issue
- **THEN** the entry SHALL bind to the one whose entries were used most recently and no new task SHALL be created

#### Scenario: Ambiguity is never an error
- **WHEN** a title matches several tasks
- **THEN** the system SHALL NOT reject the request and SHALL NOT require the caller to disambiguate

#### Scenario: Explicit remote issue bypasses the tie-break
- **WHEN** a caller supplies a title together with an explicit remote issue
- **THEN** resolution SHALL use `(userId, name, projectId, remoteIssueId)` and find-or-create exactly that task

### Requirement: REQ-237 Remote issue reference stored on the task row
The `tasks` table SHALL carry the remote issue reference inline: the originating remote-system configuration provenance, the remote issue ID as nullable text (`remoteIssueId`), the cached issue title, an optional cached remote project title, and the reference timestamps. A task with `remoteIssueId IS NULL` SHALL be an unlinked task. The separate one-to-one `remote_issue_refs` table SHALL be dropped; the task row SHALL be the single source of truth for the reference, and no remote issue URL SHALL be stored (it stays derived per REQ-104). The task row SHALL NOT store a remote project id.

A migration SHALL fan every existing `remote_issue_refs` row onto its owning task, drop the table, and rebuild the task uniqueness indexes per REQ-136. Because the source table was unique per `taskId`, the migration SHALL neither merge nor split any task row, and every `remote_exports.taskId` SHALL continue to reference the same task.

A later widening SHALL add a nullable cached remote project title column on `tasks`. Existing linked rows MAY leave that column null. The widening SHALL NOT rewrite uniqueness indexes and SHALL NOT backfill titles from the remote tracker.

Boundary types SHALL keep exposing the reference as the nested `remoteIssueRef` shape on `TaskDto` and `TimeEntryDto`, derived from the task row, so a task without a `remoteIssueId` SHALL expose `remoteIssueRef` as absent. When the reference is present, the nested shape SHALL include the cached remote project title only when a non-empty value is stored.

Task hard-deletion (garbage collection, REQ-132) SHALL remove the reference with the row it lives on. Export provenance SHALL survive task garbage collection: the foreign key from an export record to its task SHALL NOT allow garbage collection to orphan an export record, nor SHALL it block garbage collection.

#### Scenario: Reference lives on the task row
- **WHEN** a task is linked to a remote issue
- **THEN** its configuration provenance, remote issue ID and cached title SHALL be persisted on the task row and no separate reference record SHALL exist

#### Scenario: Cached remote project title is stored when provided
- **WHEN** a newly linked task is created from a search result that includes a remote project title
- **THEN** that title SHALL be persisted on the task row and the nested `remoteIssueRef` SHALL expose it

#### Scenario: Cached remote project title may be absent
- **WHEN** a linked task was created without a remote project title, or predates the column
- **THEN** the task SHALL remain linked, the column SHALL be null, and the nested `remoteIssueRef` SHALL omit the cached remote project title

#### Scenario: Unlinked task has a null remote issue id
- **WHEN** a task has no remote issue
- **THEN** its `remoteIssueId` SHALL be `NULL` and its DTO SHALL expose no `remoteIssueRef`

#### Scenario: Migration preserves every reference and task
- **WHEN** the migration runs against a database containing linked, unlinked and project-less tasks
- **THEN** each previously linked task SHALL carry its reference inline, no task row SHALL be merged or removed, and the reference table SHALL be gone

#### Scenario: Project-title widening is additive
- **WHEN** the cached remote project title column is added
- **THEN** existing task rows SHALL remain valid with a null project title, uniqueness SHALL be unchanged, and no remote call SHALL be made to fill the column

#### Scenario: Export provenance survives garbage collection
- **WHEN** a task with an export record is garbage-collected because its last entry moved away
- **THEN** the export record SHALL remain readable and the deletion SHALL NOT fail on the foreign key

### Requirement: REQ-138 Strict cross-user isolation
Every read and write SHALL be scoped by the authenticated user's id. A task id belonging to another user, or an unknown id, SHALL resolve to HTTP 404 without confirming the resource's existence.

#### Scenario: Foreign task id on read or write
- **WHEN** an authenticated user references a task id owned by another user
- **THEN** the system SHALL respond with HTTP 404 and SHALL NOT reveal that the resource exists

#### Scenario: Unknown task id
- **WHEN** an authenticated user references a task id that does not exist
- **THEN** the system SHALL respond with HTTP 404
