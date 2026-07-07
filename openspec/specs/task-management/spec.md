# task-management Specification

## Purpose
Define authenticated, user-scoped CRUD for Tasks (the leaf of the `Client → Project → Task` hierarchy), with an optional project assignment (project-less tasks allowed), task names unique within a user's project scope, project ownership validation when assigned, soft delete, strict cross-user isolation, implicit task creation/matching from time-entry titles, and an accessible PrimeVue Dialog-based UI. The `uuidv7` `id` is the API identifier.

## Requirements

### Requirement: REQ-TTR-026 List own tasks
The system SHALL show the authenticated user only their own non-deleted tasks, ordered by `name`, via `GET /api/tasks`. The list SHALL exclude any task whose `deletedAt` is set and any task belonging to another user. Each returned task SHALL include its `uuidv7` `id`. The endpoint SHALL accept an optional `projectId` query parameter that further restricts results to that project, always additionally scoped by `userId`; a dedicated sentinel value (`projectId=none`) SHALL restrict results to project-less tasks (`projectId IS NULL`). The endpoint SHALL additionally accept an optional `search` query parameter that restricts results to tasks whose `name` contains the value case-insensitively, to power title autocomplete. Each returned task SHALL include the owning project's name (`projectName`) and the owning client's name (`clientName`) resolved via LEFT joins that do NOT filter on the project's or client's `deletedAt`, so the names are present even when a parent has been soft-deleted; for a project-less task both `projectId`, `projectName`, and `clientName` SHALL be `null`.

#### Scenario: User sees only their own tasks
- **WHEN** an authenticated user requests their tasks
- **THEN** the response SHALL contain only tasks where `userId` equals the user's id and `deletedAt` is null, ordered by `name`

#### Scenario: Response includes the project and client names
- **WHEN** an authenticated user lists their tasks
- **THEN** each returned task SHALL include a `projectName` field and a `clientName` field naming its owning project and client

#### Scenario: Names persist after a parent is soft-deleted
- **WHEN** a task's owning project (or its client) has been soft-deleted
- **THEN** the task SHALL still appear in the list (when not itself deleted) with its `projectName` and `clientName` populated from the soft-deleted parent

#### Scenario: Soft-deleted tasks are excluded
- **WHEN** an authenticated user has a soft-deleted task
- **THEN** that task SHALL NOT appear in the list

#### Scenario: Filter by project
- **WHEN** an authenticated user requests their tasks with a `projectId` filter for a project they own
- **THEN** the response SHALL contain only their non-deleted tasks belonging to that project

#### Scenario: Filter by a foreign or unknown project
- **WHEN** an authenticated user requests tasks with a `projectId` that is unknown or owned by another user
- **THEN** the system SHALL return an empty list and SHALL NOT reveal whether that project exists

#### Scenario: Search by name
- **WHEN** an authenticated user requests their tasks with a `search` value
- **THEN** the response SHALL contain only their non-deleted tasks whose `name` contains that value case-insensitively, with project/client context

#### Scenario: List includes project-less tasks
- **WHEN** an authenticated user has a task with no project and requests their tasks without a filter
- **THEN** the response SHALL include that task with `projectId`, `projectName`, and `clientName` all `null`

#### Scenario: Filter to project-less tasks
- **WHEN** an authenticated user requests their tasks with the sentinel `projectId=none`
- **THEN** the response SHALL contain only their non-deleted tasks that have no project

#### Scenario: Empty state
- **WHEN** an authenticated user has no tasks (overall or for the selected project filter)
- **THEN** the Tasks page SHALL render a dedicated empty state with a create call-to-action instead of an empty table

### Requirement: REQ-TTR-027 Create a task
The system SHALL allow an authenticated user to create a task with a `name` and an optional `projectId` via `POST /api/tasks`. The `name` SHALL be trimmed, non-empty, and length-bounded. Within a project scope (`projectId` fixed, treating `null` as its own scope) the `name` SHALL be unique among the user's non-deleted tasks; duplicate names across different scopes SHALL be allowed. The `projectId` MAY be omitted or `null` to create a project-less task; when provided it SHALL reference a non-deleted project owned by the user. On success the created task SHALL be returned and a success Toast SHALL be shown.

#### Scenario: Successful creation
- **WHEN** an authenticated user submits a valid name and a `projectId` for a project they own
- **THEN** the system SHALL create the task scoped to the user, return it, and the new task SHALL appear in the list

#### Scenario: Empty name rejected
- **WHEN** the submitted name is empty or whitespace-only
- **THEN** the system SHALL reject the request with `{ messageKey, params }` and the field error SHALL render inline under the field

#### Scenario: Project-less creation allowed
- **WHEN** an authenticated user submits a valid name and omits `projectId` (or sends `null`)
- **THEN** the system SHALL create a project-less task scoped to the user, return it with `projectId`/`projectName`/`clientName` `null`, and it SHALL appear in the list

#### Scenario: Invalid project value rejected
- **WHEN** the request provides a non-null `projectId` that is not a valid uuid
- **THEN** the system SHALL reject the request with `{ messageKey, params }` and the field error SHALL render inline under the field

#### Scenario: Duplicate name across scopes allowed
- **WHEN** the submitted name matches an existing non-deleted task of the same user under a different project scope
- **THEN** the system SHALL allow creation

#### Scenario: Duplicate name within the same scope matches instead of duplicating
- **WHEN** the submitted name matches an existing non-deleted task of the same user within the same project scope
- **THEN** the system SHALL NOT create a second task in that scope (the name is unique per scope)

### Requirement: REQ-TTR-028 Edit a task
The system SHALL allow an authenticated user to update the `name` and `projectId` of their own task via `PATCH /api/tasks/[id]`, addressing the task by its `uuidv7` `id` and applying the same `name` validation as creation (trimmed, non-empty, length-bounded, unique per project scope). Editing SHALL be scoped by `userId`. The `projectId` MAY be set to a new project, or cleared to `null` to make the task project-less. Project ownership and non-deleted validation SHALL only be enforced when the `projectId` is changed to a different non-null project; clearing to `null` SHALL always be allowed. When the `projectId` is unchanged from the task's current project, the system SHALL NOT validate that project's soft-delete status, so the task's `name` can still be edited after its project has been soft-deleted.

#### Scenario: Successful edit
- **WHEN** an authenticated user submits a valid new name and an owned `projectId` for their own task
- **THEN** the system SHALL update the task, return it (including the resolved `projectName` and `clientName`), and the row SHALL reflect the change

#### Scenario: Edit dialog shows a soft-deleted project
- **WHEN** an authenticated user opens the edit dialog for a task whose owning project has been soft-deleted (and is therefore absent from the active project list)
- **THEN** the Project select SHALL be seeded with the task's `projectId`/`projectName` so the correct project is displayed and pre-selected

#### Scenario: Rename a task whose project is soft-deleted
- **WHEN** an authenticated user updates the `name` of their own task without changing its `projectId`, and that task's current project has been soft-deleted
- **THEN** the system SHALL allow the update and SHALL NOT reject it on account of the project's soft-delete status

#### Scenario: Clear the project assignment
- **WHEN** an authenticated user updates their own task and sets `projectId` to `null`
- **THEN** the system SHALL make the task project-less and return it with `projectId`/`projectName`/`clientName` `null`

#### Scenario: Assign a project to a project-less task
- **WHEN** an authenticated user updates a project-less task, setting `projectId` to a non-deleted project they own
- **THEN** the system SHALL validate ownership, assign the project, and return the task with the resolved `projectName` and `clientName`

### Requirement: REQ-TTR-029 Soft-delete a task
The system SHALL soft-delete a task via `DELETE /api/tasks/[id]` by setting `deletedAt`, scoped by `userId`, and SHALL never hard-delete the row. Deletion SHALL be confirmed via a confirm dialog before it is performed.

#### Scenario: Successful soft delete
- **WHEN** an authenticated user confirms deletion of their own task
- **THEN** the system SHALL set `deletedAt`, retain the database row, the task SHALL disappear from the list, and a success Toast SHALL be shown

#### Scenario: Deletion requires confirmation
- **WHEN** the user activates the delete action
- **THEN** a confirm dialog SHALL be shown and no deletion SHALL occur until the user confirms

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
Every task's `name` SHALL be unique among the user's non-deleted tasks within its project scope, where `projectId = NULL` is a distinct scope. Uniqueness SHALL be enforced by partial unique indexes: `(userId, projectId, name) WHERE deletedAt IS NULL` and `(userId, name) WHERE projectId IS NULL AND deletedAt IS NULL`. This uniqueness is the matching key that lets time-entry titles resolve to at most one task per scope.

#### Scenario: Same name in two projects allowed
- **WHEN** a user has a task named "Code review" in project A and creates "Code review" in project B
- **THEN** both tasks SHALL be allowed because they occupy different project scopes

#### Scenario: One project-less task per name
- **WHEN** a user already has a project-less task named "Code review"
- **THEN** the system SHALL NOT create a second project-less task with the same name; a title resolution SHALL match the existing one

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
All task endpoints SHALL require authentication via `requireAuth`, and mutating endpoints (`POST`, `PATCH`, `DELETE`) SHALL be CSRF-protected; client-side mutations SHALL use `$csrfFetch` / `useCsrfFetch`. API errors SHALL use the `{ messageKey, params }` contract translated client-side via `t()`; server/network failures SHALL surface as a Toast.

#### Scenario: Unauthenticated request rejected
- **WHEN** any task endpoint is called without a valid session
- **THEN** the system SHALL respond with HTTP 401

#### Scenario: Missing CSRF token rejected
- **WHEN** a mutating task request is made without a valid CSRF token
- **THEN** the system SHALL reject the request

#### Scenario: Server failure surfaced
- **WHEN** a mutation fails with an API error
- **THEN** the client SHALL show a Toast translated from the returned `messageKey`

### Requirement: REQ-NFR-025 Accessible, tokenized Tasks UI
The Tasks page SHALL meet WCAG 2.1 AA: form fields including the Project select SHALL be labelled, the create/edit dialog and confirm dialog SHALL be accessible and keyboard operable, and invalid fields SHALL expose `aria-invalid` with an associated described error (mirroring `login.vue`). Styling SHALL derive from PrimeVue theme tokens with no ad-hoc inline colors, and all user-facing strings SHALL exist in `en` and `pl` in parity.

#### Scenario: Inline field error is accessible
- **WHEN** a field validation error is shown
- **THEN** the field SHALL expose `aria-invalid` and reference the error via `aria-describedby`

#### Scenario: Project select is labelled
- **WHEN** the create/edit dialog renders the Project select
- **THEN** the select SHALL have an associated label and be keyboard operable

#### Scenario: Strings localized in parity
- **WHEN** new user-facing strings are added
- **THEN** they SHALL exist in both `en.json` and `pl.json` with matching keys

### Requirement: REQ-TTR-035 Client-side validation of the task form
The task create/edit form SHALL validate input client-side using the shared `createTaskSchema` from `shared/types/task.ts` (via a PrimeVue Forms resolver) before any request is sent. Validation failures SHALL render the schema's messageKey translated via `t()` as an inline field error and SHALL prevent the request. A cleared (null) project selection SHALL pass validation, since tasks MAY be project-less. Server-side validation SHALL remain unchanged and authoritative.

#### Scenario: Empty name blocked client-side
- **WHEN** the user submits the task form with an empty or whitespace-only name
- **THEN** the form SHALL show the `error.taskNameRequired` message inline and SHALL NOT send a request

#### Scenario: Project-less task passes validation
- **WHEN** the user submits the task form with a valid name and no project selected
- **THEN** client-side validation SHALL pass and the request SHALL be sent with a null `projectId`
