## ADDED Requirements

### Requirement: REQ-237 Remote issue reference stored on the task row

The `tasks` table SHALL carry the remote issue reference inline: the originating remote-system configuration provenance, the remote issue ID as nullable text (`remoteIssueId`), the cached issue title, and the reference timestamps. A task with `remoteIssueId IS NULL` SHALL be an unlinked task. The separate one-to-one `remote_issue_refs` table SHALL be dropped; the task row SHALL be the single source of truth for the reference, and no remote issue URL SHALL be stored (it stays derived per REQ-104).

A migration SHALL fan every existing `remote_issue_refs` row onto its owning task, drop the table, and rebuild the task uniqueness indexes per REQ-136. Because the source table was unique per `taskId`, the migration SHALL neither merge nor split any task row, and every `remote_exports.taskId` SHALL continue to reference the same task.

Boundary types SHALL keep exposing the reference as the nested `remoteIssueRef` shape on `TaskDto` and `TimeEntryDto`, derived from the task row, so a task without a `remoteIssueId` SHALL expose `remoteIssueRef` as absent.

Task hard-deletion (garbage collection, REQ-132) SHALL remove the reference with the row it lives on. Export provenance SHALL survive task garbage collection: the foreign key from an export record to its task SHALL NOT allow garbage collection to orphan an export record, nor SHALL it block garbage collection.

#### Scenario: Reference lives on the task row
- **WHEN** a task is linked to a remote issue
- **THEN** its configuration provenance, remote issue ID and cached title SHALL be persisted on the task row and no separate reference record SHALL exist

#### Scenario: Unlinked task has a null remote issue id
- **WHEN** a task has no remote issue
- **THEN** its `remoteIssueId` SHALL be `NULL` and its DTO SHALL expose no `remoteIssueRef`

#### Scenario: Migration preserves every reference and task
- **WHEN** the migration runs against a database containing linked, unlinked and project-less tasks
- **THEN** each previously linked task SHALL carry its reference inline, no task row SHALL be merged or removed, and the reference table SHALL be gone

#### Scenario: Export provenance survives garbage collection
- **WHEN** a task with an export record is garbage-collected because its last entry moved away
- **THEN** the export record SHALL remain readable and the deletion SHALL NOT fail on the foreign key

## MODIFIED Requirements

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

### Requirement: REQ-137 Implicit task creation and matching via time entries

The system SHALL create and match tasks implicitly from time-entry titles as defined by the time-tracking capability, using the matching key `(userId, name, projectId, remoteIssueId)`. Implicitly created tasks SHALL be first-class tasks that appear in `GET /api/tasks` and its `search` results. No task `number` SHALL be assigned to any task (implicit or explicit).

Because a bare title no longer identifies a single task, resolution from a title alone SHALL apply a defined tie-break: among the user's tasks matching `(userId, name, effectiveProjectId)` the system SHALL select the task whose entries were **most recently used** (greatest `startedAt` among its time entries, falling back to the task's own creation order when it has none), and SHALL create a task only when no candidate exists. The system SHALL NOT reject a title for being ambiguous, and SHALL NOT create a duplicate task when a candidate exists. A caller that needs a specific task SHALL send that task's `id` instead of a title (REQ-143, REQ-180).

When the caller supplies an explicit remote issue (REQ-179), resolution SHALL use the full four-part key instead of the tie-break.

#### Scenario: Titling an entry creates a matching task
- **WHEN** a user starts or retitles a time entry with a new title in a project scope
- **THEN** the system SHALL create an unlinked task with that name in that scope and it SHALL appear in the task list

#### Scenario: Titling an entry reuses an existing task
- **WHEN** a user titles a time entry with a name that already exists in the target project scope
- **THEN** the entry SHALL bind to the existing task and no duplicate task SHALL be created

#### Scenario: Ambiguous title binds to the most recently used task
- **WHEN** a title matches several tasks in the target project scope that differ by remote issue
- **THEN** the entry SHALL bind to the one whose entries were used most recently and no new task SHALL be created

#### Scenario: Ambiguity is never an error
- **WHEN** a title matches several tasks
- **THEN** the system SHALL NOT reject the request and SHALL NOT require the caller to disambiguate

#### Scenario: Explicit remote issue bypasses the tie-break
- **WHEN** a caller supplies a title together with an explicit remote issue
- **THEN** resolution SHALL use `(userId, name, projectId, remoteIssueId)` and find-or-create exactly that task
