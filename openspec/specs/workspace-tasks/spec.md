# workspace-tasks Specification

## Purpose
How tasks exist: created and matched only from time-entry titles, unique per user, project, name and remote issue, listed for autocomplete, renamed or moved between projects with a merge on collision, and hard-deleted when no entry is left. All task endpoints follow `core-api-conventions`.

## Requirements

### Requirement: REQ-491 Task lifecycle and garbage collection
Tasks SHALL have no soft-delete state and SHALL only ever be hard-deleted. Tasks SHALL be created only from time-entry titles (REQ-137) and deleted only by garbage collection: whenever an operation leaves a task with no entries (deleting an entry, retitling or rebinding it, a day-scoped reassignment, or a merge), the task SHALL be hard-deleted in the same transaction.

#### Scenario: Merge hard-deletes the emptied task
- **WHEN** an edit merges a task into a survivor, leaving it with no entries
- **THEN** the emptied task row SHALL be hard-deleted in the same transaction

#### Scenario: Retitling the last entry deletes the old task
- **WHEN** the only entry of a task, running or stopped, is retitled so that it resolves to a different task
- **THEN** the previous task SHALL be hard-deleted in the same transaction and SHALL be absent from the task list

#### Scenario: Rebinding the last entry deletes the old task
- **WHEN** the only entry of a task is patched with a `taskId` of a different task
- **THEN** the previous task SHALL be hard-deleted in the same transaction

#### Scenario: A task that still has entries is kept
- **WHEN** one of several entries of a task is retitled or rebound, or an entry is retitled to a title that resolves to its current task
- **THEN** that task SHALL remain with its other entries

### Requirement: REQ-133 List own tasks
`GET /api/tasks` SHALL return only the user's own tasks, each with its `id`, ranked **most recently used first**: by the latest `startedAt` among their entries, tasks without entries after all others, ties by `name` ascending. An optional `limit` SHALL cap the result after ranking, so the returned tasks are the highest-ranked matches; it defaults to `20`, and a value that is not a positive integer or exceeds `100` SHALL be rejected with HTTP 422 and `{ messageKey, params }`.

#### Scenario: User sees only their own tasks
- **WHEN** an authenticated user requests their tasks
- **THEN** the response SHALL contain only tasks where `userId` equals the user's id

#### Scenario: Most recently used task ranks first
- **WHEN** an authenticated user has task A whose newest entry started yesterday and task B whose newest entry started today, and A sorts before B by name
- **THEN** the response SHALL list B before A

#### Scenario: Tasks without entries rank last, then by name
- **WHEN** an authenticated user has tasks with entries and tasks that have never had an entry
- **THEN** every task with an entry SHALL precede every task without one, and tasks without entries SHALL be ordered by `name`

#### Scenario: Default cap applies
- **WHEN** an authenticated user with more than 20 matching tasks requests their tasks without a `limit`
- **THEN** the response SHALL contain exactly 20 tasks and they SHALL be the 20 highest-ranked matches

#### Scenario: Explicit limit applies
- **WHEN** an authenticated user requests their tasks with `limit=5`
- **THEN** the response SHALL contain at most 5 tasks

#### Scenario: Limit is validated
- **WHEN** an authenticated user requests their tasks with `limit=0`, `limit=abc`, or `limit=101`
- **THEN** the system SHALL respond with HTTP 422 and a `messageKey` describing the invalid limit, and SHALL NOT return any tasks

### Requirement: REQ-441 Task list filters, search and project context
`GET /api/tasks` SHALL accept an optional `projectId` filter for one of the user's projects, and the sentinel `projectId=none` for project-less tasks. An optional `search` SHALL keep tasks whose `name` contains it case-insensitively; an empty or whitespace-only `search` SHALL count as absent. Each task SHALL carry its `projectName`, present even when the project is soft-deleted; a project-less task has `projectId` and `projectName` null. Filters keep the ranking and cap of REQ-133.

#### Scenario: Response includes the project name
- **WHEN** an authenticated user lists their tasks
- **THEN** each returned task SHALL include a `projectName` field naming its owning project

#### Scenario: Names persist after a parent is soft-deleted
- **WHEN** a task's owning project has been soft-deleted
- **THEN** the task SHALL still appear in the list with its `projectName` populated from the soft-deleted project

#### Scenario: Filter by project
- **WHEN** an authenticated user requests their tasks with a `projectId` filter for a project they own
- **THEN** the response SHALL contain only their tasks belonging to that project

#### Scenario: Filter by a foreign or unknown project
- **WHEN** an authenticated user requests tasks with a `projectId` that is unknown or owned by another user
- **THEN** the system SHALL return an empty list and SHALL NOT reveal whether that project exists

#### Scenario: Search by name
- **WHEN** an authenticated user requests their tasks with a `search` value
- **THEN** the response SHALL contain only their tasks whose `name` contains that value case-insensitively, with project context, ranked most recently used first and capped

#### Scenario: Blank search is ignored
- **WHEN** an authenticated user requests their tasks with `search=` or a whitespace-only value
- **THEN** the response SHALL be the same as a request without `search`

#### Scenario: List includes project-less tasks
- **WHEN** an authenticated user has a task with no project and requests their tasks without a filter
- **THEN** the response SHALL include that task with `projectId` and `projectName` both `null`

#### Scenario: Filter to project-less tasks
- **WHEN** an authenticated user requests their tasks with the sentinel `projectId=none`
- **THEN** the response SHALL contain only their tasks that have no project

### Requirement: REQ-134 Edit a task
`PATCH /api/tasks/[id]` SHALL update the `name` (trimmed, non-empty, length-bounded) and `projectId` of the user's own task. **Omitting** `projectId` SHALL keep the current project, never be read as `null`; an explicit **`null`** SHALL make the task project-less; an id SHALL assign that project (REQ-135). This endpoint SHALL NOT change `remoteIssueId`; only the day-scoped reassignment (REQ-179) does, by moving entries between tasks.

#### Scenario: Successful edit
- **WHEN** an authenticated user submits a valid new name and an owned `projectId` for their own task, with no key collision
- **THEN** the system SHALL update the task and return it (including the resolved `projectName` and remote reference)

#### Scenario: Rename keeps the current project when projectId is omitted
- **WHEN** an authenticated user submits a valid new name for their own task without including a `projectId` field in the request body
- **THEN** the system SHALL update only the `name` and SHALL leave the task's current `projectId` unchanged, returning the task with its existing project resolved

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
- **THEN** the system SHALL validate ownership, assign the project, and return the task with the resolved `projectName` and remote reference

### Requirement: REQ-442 A colliding task edit merges into the survivor
When an edit would give the task the same `(userId, name, projectId, remoteIssueId)` key as another task (the survivor), using the effective `projectId` and the task's unchanged `remoteIssueId`, the system SHALL, in one transaction, move all the edited task's entries to the survivor, hard-delete the emptied task, and return the survivor with its `projectName` and remote reference. Tasks with different remote issues SHALL NOT collide, so such a rename SHALL NOT be rejected with HTTP 409.

#### Scenario: Colliding edit merges tasks sharing the same remote issue state
- **WHEN** an authenticated user renames or re-projects their Task so its `(name, projectId, remoteIssueId)` matches another Task
- **THEN** the system SHALL move all entries to the survivor, hard-delete the emptied Task, and return the survivor within one transaction

#### Scenario: Differing remote issues do not collide
- **WHEN** an authenticated user renames their Task to a name already used in the same project by a Task with a **different** remote issue
- **THEN** the rename SHALL succeed, both Tasks SHALL continue to exist, and the system SHALL NOT respond with HTTP 409

### Requirement: REQ-135 Project relationship and ownership
A task SHALL belong to at most one project owned by the same user, or to none (project-less). When a task is created in, or moved to, a different non-null project, the target SHALL be a non-deleted project the user owns; a foreign or unknown one SHALL resolve to HTTP 404 without confirming it exists. An omitted or `null` `projectId` SHALL need no validation. An update that keeps the project SHALL NOT re-validate it, so a task whose project was soft-deleted can still be renamed.

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
Every task SHALL be uniquely identified among the user's tasks by `(userId, projectId, name, remoteIssueId)`, where `projectId = NULL` is a distinct project scope and `remoteIssueId = NULL` means unlinked. Tasks MAY share a user, project and name when their remote issues differ, but at most one **unlinked** task SHALL exist per `(userId, projectId, name)`, project-less included, enforced by the database. This key decides which task a title resolves to and which survives a merge.

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
Tasks SHALL be created and matched from time-entry titles by tracking-api REQ-142 on the key `(userId, name, projectId, remoteIssueId)`: a new entry's bare title binds to the **most recently used** match (latest entry `startedAt`, else creation order) and creates a task only when none exists; an explicit remote issue or a retitle finds or creates exactly that key. They SHALL appear in `GET /api/tasks`. No task gets a `number`. Ambiguity SHALL never be an error.

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
The task row SHALL be the only store of its remote issue reference: tracker provenance, a nullable `remoteIssueId` (null = unlinked), cached issue title, optional cached remote project title, and timestamps. No separate record, issue URL (derived, REQ-104) or remote project id SHALL be stored. `TaskDto` and `TimeEntryDto` SHALL expose a nested `remoteIssueRef`, absent when unlinked, with the project title only when non-empty. Hard-deleting a task SHALL remove its reference.

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

### Requirement: REQ-443 Export provenance survives task garbage collection
When a task is hard-deleted because its last entry left it, its export records SHALL remain readable: the link from an export record to its task SHALL neither delete the export record nor block the task's deletion.

#### Scenario: Export provenance survives garbage collection
- **WHEN** a task with an export record is garbage-collected because its last entry moved away
- **THEN** the export record SHALL remain readable and the deletion SHALL NOT fail on the foreign key

### Requirement: REQ-444 Upgraded databases keep their remote issue references
A database upgraded from a version that kept remote issue references in a separate table SHALL have every reference on its own task, with no task merged, split or removed and every export record still pointing to the same task. Tasks linked before the cached project title existed SHALL keep a null title, with uniqueness unchanged and no remote call made to fill it.

#### Scenario: Migration preserves every reference and task
- **WHEN** the migration runs against a database containing linked, unlinked and project-less tasks
- **THEN** each previously linked task SHALL carry its reference inline, no task row SHALL be merged or removed, and the reference table SHALL be gone

#### Scenario: Project-title widening is additive
- **WHEN** the cached remote project title column is added
- **THEN** existing task rows SHALL remain valid with a null project title, uniqueness SHALL be unchanged, and no remote call SHALL be made to fill the column

