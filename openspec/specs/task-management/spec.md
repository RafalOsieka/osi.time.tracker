# task-management Specification

## Purpose
Define authenticated, user-scoped CRUD for Tasks (the leaf of the `Client → Project → Task` hierarchy), with an optional project assignment (project-less tasks allowed), task names unique within a user's project scope, project ownership validation when assigned, soft delete, strict cross-user isolation, implicit task creation/matching from time-entry titles, and an accessible PrimeVue Dialog-based UI. The `uuidv7` `id` is the API identifier.

## Requirements

### Requirement: REQ-TTR-047 Task hard-delete lifecycle and merge invariant
Tasks SHALL have no soft-delete state: the `tasks` table SHALL carry no `deletedAt` column and task rows SHALL only ever be removed by hard delete. The system SHALL NOT expose a standalone task-delete endpoint; a task row is hard-deleted exactly when a merge (REQ-TTR-028) empties it of entries. Tasks SHALL be created only implicitly from time-entry titles (REQ-TTR-043) — no explicit create endpoint SHALL exist. A migration SHALL drop `tasks.deletedAt`, first hard-deleting previously soft-deleted task rows after setting their entries' `taskId` to `null`, and SHALL recreate the name-uniqueness indexes without the soft-delete predicate.

#### Scenario: No standalone create or delete endpoints
- **WHEN** a client calls `POST /api/tasks` or `DELETE /api/tasks/[id]`
- **THEN** the system SHALL respond with HTTP 404 or 405 (route absent)

#### Scenario: Merge hard-deletes the emptied task
- **WHEN** an edit merges a task into a survivor, leaving it with no entries
- **THEN** the emptied task row SHALL be hard-deleted in the same transaction

#### Scenario: Migration cleans up soft-deleted tasks
- **WHEN** the migration runs against a database containing soft-deleted task rows
- **THEN** those rows SHALL be removed, their entries SHALL become untitled (`taskId` `null`), and the `deletedAt` column SHALL be dropped

### Requirement: REQ-TTR-026 List own tasks
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

### Requirement: REQ-TTR-028 Edit a task
The system SHALL allow an authenticated user to update the `name` and `projectId` of their own task via `PATCH /api/tasks/[id]`, addressing the task by its `uuidv7` `id` and applying the same `name` validation as title resolution (trimmed, non-empty, length-bounded). Editing SHALL be scoped by `userId`. The presence of the `projectId` field SHALL be significant: **omitting** `projectId` entirely SHALL keep the task's current project unchanged, an explicit **`null`** SHALL clear it to make the task project-less, and a **uuid** SHALL assign that project. The system SHALL NOT treat an absent `projectId` as an implicit `null`. Project ownership and non-deleted validation SHALL only be enforced when the `projectId` is changed to a different non-null project; omitting `projectId` and clearing to `null` SHALL always be allowed. When the effective `projectId` is unchanged from the task's current project (including because it was omitted), the system SHALL NOT validate that project's soft-delete status, so the task's `name` can still be edited after its project has been soft-deleted.

When the update would make the task's `(userId, name, projectId)` key collide with another existing task (the survivor), the system SHALL merge within a single transaction, computing the collision scope from the effective `projectId` (the current project when `projectId` was omitted). If neither Task has a remote issue reference, all time entries of the edited Task SHALL be re-pointed to the survivor and the emptied edited Task SHALL be hard-deleted. If only one Task has a reference, that reference SHALL be preserved on the survivor. If both references identify the same remote issue using configuration provenance plus remote issue ID, one identical reference SHALL be preserved. If both Tasks have different references, the entire edit and merge SHALL be rejected with HTTP 409 and neither Task, its entries, nor its reference SHALL change. A successful merge SHALL return the survivor including its resolved `projectName`, `clientName`, and remote reference.

#### Scenario: Successful edit
- **WHEN** an authenticated user submits a valid new name and an owned `projectId` for their own task, with no key collision
- **THEN** the system SHALL update the task and return it (including the resolved `projectName`, `clientName`, and remote reference)

#### Scenario: Rename keeps the current project when projectId is omitted
- **WHEN** an authenticated user submits a valid new name for their own task without including a `projectId` field in the request body
- **THEN** the system SHALL update only the `name` and SHALL leave the task's current `projectId` unchanged, returning the task with its existing project resolved

#### Scenario: Colliding edit merges unlinked Tasks
- **WHEN** an authenticated user renames or re-projects their unlinked Task so its `(name, projectId)` matches another unlinked Task
- **THEN** the system SHALL move all entries to the survivor, hard-delete the emptied Task, and return the survivor within one transaction

#### Scenario: Merge preserves a sole reference
- **WHEN** exactly one of the edited Task and survivor has a remote issue reference
- **THEN** the system SHALL preserve that reference on the survivor in the same merge transaction

#### Scenario: Merge collapses identical references
- **WHEN** both merging Tasks reference the same configuration provenance and remote issue ID
- **THEN** the system SHALL preserve one reference on the survivor and complete the merge atomically

#### Scenario: Merge rejects different references
- **WHEN** both merging Tasks have references that differ by configuration provenance or remote issue ID
- **THEN** the system SHALL respond with HTTP 409 and SHALL leave both Tasks, their entries, and their references unchanged

#### Scenario: Rename a task whose project is soft-deleted
- **WHEN** an authenticated user updates the `name` of their own task without changing its `projectId`, and that task's current project has been soft-deleted
- **THEN** the system SHALL allow the update and SHALL NOT reject it on account of the project's soft-delete status

#### Scenario: Clear the project assignment
- **WHEN** an authenticated user updates their own task and sets `projectId` to `null`
- **THEN** the system SHALL make the task project-less (merging per the collision and reference rules if a project-less task with that name exists) and return the resulting task

#### Scenario: Assign a project to a project-less task
- **WHEN** an authenticated user updates a project-less task, setting `projectId` to a non-deleted project they own
- **THEN** the system SHALL validate ownership, assign the project, and return the task with the resolved `projectName`, `clientName`, and remote reference

### Requirement: REQ-TTR-030 Project relationship and ownership
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

### Requirement: REQ-TTR-042 Task name uniqueness per project scope
Every task's `name` SHALL be unique among the user's tasks within its project scope, where `projectId = NULL` is a distinct scope. Uniqueness SHALL be enforced by unique indexes: `(userId, projectId, name)` and `(userId, name) WHERE projectId IS NULL`. This uniqueness is the matching key that lets time-entry titles resolve to at most one task per scope and that determines the survivor when an edit triggers a merge.

#### Scenario: Same name in two projects allowed
- **WHEN** a user has a task named "Code review" in project A and creates "Code review" in project B
- **THEN** both tasks SHALL be allowed because they occupy different project scopes

#### Scenario: One project-less task per name
- **WHEN** a user already has a project-less task named "Code review"
- **THEN** the system SHALL NOT create a second project-less task with the same name; a title resolution SHALL match the existing one and an edit into that key SHALL merge

### Requirement: REQ-TTR-043 Implicit task creation and matching via time entries
The system SHALL create and match tasks implicitly from time-entry titles as defined by the time-tracking capability, using the matching key `(userId, name, projectId)`. Implicitly created tasks SHALL be first-class tasks that appear in `GET /api/tasks` and its `search` results. No task `number` SHALL be assigned to any task (implicit or explicit).

#### Scenario: Titling an entry creates a matching task
- **WHEN** a user starts or retitles a time entry with a new title in a project scope
- **THEN** the system SHALL create a task with that name in that scope and it SHALL appear in the task list

#### Scenario: Titling an entry reuses an existing task
- **WHEN** a user titles a time entry with a name that already exists in the target project scope
- **THEN** the entry SHALL bind to the existing task and no duplicate task SHALL be created

### Requirement: REQ-TTR-031 Strict cross-user isolation
Every read and write SHALL be scoped by the authenticated user's id. A task id belonging to another user, or an unknown id, SHALL resolve to HTTP 404 without confirming the resource's existence.

#### Scenario: Foreign task id on read or write
- **WHEN** an authenticated user references a task id owned by another user
- **THEN** the system SHALL respond with HTTP 404 and SHALL NOT reveal that the resource exists

#### Scenario: Unknown task id
- **WHEN** an authenticated user references a task id that does not exist
- **THEN** the system SHALL respond with HTTP 404

### Requirement: REQ-NFR-024 Authenticated and CSRF-guarded task endpoints
All task endpoints SHALL require authentication via `requireAuth`, and the mutating endpoint (`PATCH`) SHALL be CSRF-protected; client-side mutations SHALL use `$csrfFetch` / `useCsrfFetch`. API errors SHALL use the `{ messageKey, params }` contract translated client-side via `t()`; server/network failures SHALL surface as a Toast.

#### Scenario: Unauthenticated request rejected
- **WHEN** any task endpoint is called without a valid session
- **THEN** the system SHALL respond with HTTP 401

#### Scenario: Missing CSRF token rejected
- **WHEN** a mutating task request is made without a valid CSRF token
- **THEN** the system SHALL reject the request

#### Scenario: Server failure surfaced
- **WHEN** a mutation fails with an API error
- **THEN** the client SHALL show a Toast translated from the returned `messageKey`
