# task-management Specification

## Purpose
Define authenticated, user-scoped CRUD for Tasks (the leaf of the `Client → Project → Task` hierarchy), with an optional project assignment (project-less tasks allowed), non-unique names distinguished by a per-user sequential `number` displayed as `#N`, project ownership validation when assigned, soft delete, strict cross-user isolation, and an accessible PrimeVue Dialog-based UI. The `uuidv7` `id` is the API identifier.

## Requirements

### Requirement: REQ-TTR-026 List own tasks
The system SHALL show the authenticated user only their own non-deleted tasks, ordered by `number`, via `GET /api/tasks`. The list SHALL exclude any task whose `deletedAt` is set and any task belonging to another user. Each returned task SHALL include its `uuidv7` `id` and its per-user `number` (a positive integer). The endpoint SHALL accept an optional `projectId` query parameter that further restricts results to that project, always additionally scoped by `userId`; a dedicated sentinel value (`projectId=none`) SHALL restrict results to project-less tasks (`projectId IS NULL`). Each returned task SHALL include the owning project's name (`projectName`) and the owning client's name (`clientName`) resolved via LEFT joins that do NOT filter on the project's or client's `deletedAt`, so the names are present even when a parent has been soft-deleted; for a project-less task both `projectId`, `projectName`, and `clientName` SHALL be `null`.

#### Scenario: User sees only their own tasks
- **WHEN** an authenticated user requests their tasks
- **THEN** the response SHALL contain only tasks where `userId` equals the user's id and `deletedAt` is null, ordered by `number`

#### Scenario: Response includes the task number
- **WHEN** an authenticated user lists their tasks
- **THEN** each returned task SHALL include a positive integer `number` (unique among that user's tasks) alongside its `uuidv7` `id`

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
The system SHALL allow an authenticated user to create a task with a `name` and an optional `projectId` via `POST /api/tasks`. The `name` SHALL be trimmed, non-empty, and length-bounded; the `name` SHALL NOT be required to be unique — duplicate names (whether under the same project, a different project, or project-less) SHALL be allowed. On creation the system SHALL assign the task a per-user sequential integer `number` (see REQ-TTR-032). The `projectId` MAY be omitted or `null` to create a project-less task; when provided it SHALL reference a non-deleted project owned by the user. On success the created task SHALL be returned (including its assigned `number`) and a success Toast SHALL be shown.

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

#### Scenario: Duplicate name allowed
- **WHEN** the submitted name matches an existing non-deleted task of the same user (under the same project, a different project, or project-less)
- **THEN** the system SHALL allow creation and SHALL assign the new task its own distinct `number`

### Requirement: REQ-TTR-028 Edit a task
The system SHALL allow an authenticated user to update the `name` and `projectId` of their own task via `PATCH /api/tasks/[id]`, addressing the task by its `uuidv7` `id` and applying the same `name` validation as creation (trimmed, non-empty, length-bounded, NOT required to be unique). Editing SHALL be scoped by `userId`. The task's `number` SHALL be immutable and SHALL NOT change on edit. The `projectId` MAY be set to a new project, or cleared to `null` to make the task project-less. Project ownership and non-deleted validation SHALL only be enforced when the `projectId` is changed to a different non-null project; clearing to `null` SHALL always be allowed. When the `projectId` is unchanged from the task's current project, the system SHALL NOT validate that project's soft-delete status, so the task's `name` can still be edited after its project has been soft-deleted.

#### Scenario: Successful edit
- **WHEN** an authenticated user submits a valid new name and an owned `projectId` for their own task
- **THEN** the system SHALL update the task, return it (including the resolved `projectName` and `clientName`), and the row SHALL reflect the change

#### Scenario: Edit dialog shows a soft-deleted project
- **WHEN** an authenticated user opens the edit dialog for a task whose owning project has been soft-deleted (and is therefore absent from the active project list)
- **THEN** the Project select SHALL be seeded with the task's `projectId`/`projectName` so the correct project is displayed and pre-selected

#### Scenario: Edit to a duplicate name allowed
- **WHEN** the new name matches another non-deleted task of the same user
- **THEN** the system SHALL allow the update; the two tasks SHALL remain distinguishable by their `number` and `id`

#### Scenario: Number is unchanged by edit
- **WHEN** an authenticated user edits their own task's `name` or `projectId`
- **THEN** the returned task SHALL retain the same `number` it had before the edit

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

### Requirement: REQ-TTR-032 Per-user sequential task number
Every task SHALL be assigned a per-user sequential integer `number` at creation, starting at 1 for a user's first task and increasing by 1 for each subsequent task, unique per user (enforced by a `(userId, number)` unique index). Numbers SHALL NOT be reused: soft-deleted tasks SHALL continue to occupy their number, so a later create SHALL receive a higher number rather than filling a gap. The `number` SHALL be assigned atomically so concurrent creates for the same user never collide. The `number` SHALL be display metadata surfaced as `#N` in the UI; the `uuidv7` `id` SHALL remain the identifier used by all task API endpoints, and no number-addressed endpoints are provided in this slice.

#### Scenario: First task numbered 1
- **WHEN** an authenticated user with no existing tasks creates their first task
- **THEN** the created task SHALL have `number` equal to 1

#### Scenario: Numbers increase per user
- **WHEN** an authenticated user creates additional tasks
- **THEN** each new task SHALL receive the next higher `number` for that user (2, 3, ...)

#### Scenario: Numbers are per-user isolated
- **WHEN** two different users each create tasks
- **THEN** each user's numbering SHALL start at 1 independently and SHALL NOT be affected by the other user's tasks

#### Scenario: Soft-deleted numbers are not reused
- **WHEN** an authenticated user soft-deletes a task and then creates another task
- **THEN** the new task SHALL receive a `number` higher than any the user has used, and the deleted task's `number` SHALL NOT be reused

#### Scenario: Concurrent creates get distinct numbers
- **WHEN** an authenticated user creates two tasks concurrently
- **THEN** the system SHALL assign each a distinct `number` without collision

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
The Tasks page SHALL meet WCAG 2.1 AA: form fields including the Project select SHALL be labelled, the create/edit dialog and confirm dialog SHALL be accessible and keyboard operable, and invalid fields SHALL expose `aria-invalid` with an associated described error (mirroring `login.vue`). The task list SHALL display each task's `number` as `#N` (e.g. `#1`, `#2`) so duplicate-named tasks remain distinguishable. Styling SHALL derive from PrimeVue theme tokens with no ad-hoc inline colors, and all user-facing strings SHALL exist in `en` and `pl` in parity.

#### Scenario: Inline field error is accessible
- **WHEN** a field validation error is shown
- **THEN** the field SHALL expose `aria-invalid` and reference the error via `aria-describedby`

#### Scenario: Project select is labelled
- **WHEN** the create/edit dialog renders the Project select
- **THEN** the select SHALL have an associated label and be keyboard operable

#### Scenario: Task number displayed as #N
- **WHEN** the task list renders a task
- **THEN** the task's `number` SHALL be shown in the form `#N` (e.g. `#1`)

#### Scenario: Strings localized in parity
- **WHEN** new user-facing strings are added
- **THEN** they SHALL exist in both `en.json` and `pl.json` with matching keys
