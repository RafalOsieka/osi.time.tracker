# project-management Specification

## Purpose
Define how authenticated users manage their own projects (the middle of the `Client → Project → Task` hierarchy): listing, creating, editing, and soft-deleting projects, each belonging to exactly one client owned by the same user, with strict per-user isolation, CSRF-guarded mutating endpoints, and an accessible, tokenized Projects UI.

## Requirements

### Requirement: REQ-TTR-020 List own projects
The system SHALL show the authenticated user only their own non-deleted projects, ordered by name, via `GET /api/projects`. The list SHALL exclude any project whose `deletedAt` is set and any project belonging to another user. The endpoint SHALL accept an optional `clientId` query parameter that further restricts results to that client, always additionally scoped by `userId`. Each returned project SHALL include the owning client's name (`clientName`) resolved via a join that does NOT filter on the client's `deletedAt`, so the name is present even when the client has been soft-deleted.

#### Scenario: Response includes the client name
- **WHEN** an authenticated user lists their projects
- **THEN** each returned project SHALL include a `clientName` field holding the name of its owning client

#### Scenario: Client name persists after the client is soft-deleted
- **WHEN** a project's owning client has been soft-deleted
- **THEN** the project SHALL still appear in the list (when not itself deleted) with its `clientName` populated from the soft-deleted client

#### Scenario: User sees only their own projects
- **WHEN** an authenticated user requests their projects
- **THEN** the response SHALL contain only projects where `userId` equals the user's id and `deletedAt` is null, ordered by name

#### Scenario: Soft-deleted projects are excluded
- **WHEN** an authenticated user has a soft-deleted project
- **THEN** that project SHALL NOT appear in the list

#### Scenario: Filter by client
- **WHEN** an authenticated user requests their projects with a `clientId` filter for a client they own
- **THEN** the response SHALL contain only their non-deleted projects belonging to that client

#### Scenario: Filter by a foreign or unknown client
- **WHEN** an authenticated user requests projects with a `clientId` that is unknown or owned by another user
- **THEN** the system SHALL return an empty list and SHALL NOT reveal whether that client exists

#### Scenario: Empty state
- **WHEN** an authenticated user has no projects (overall or for the selected client filter)
- **THEN** the Projects page SHALL render a dedicated empty state with a create call-to-action instead of an empty table

### Requirement: REQ-TTR-021 Create a project
The system SHALL allow an authenticated user to create a project with a `name` and a `clientId` via `POST /api/projects`. The `name` SHALL be trimmed, non-empty, length-bounded, and unique per user per client among non-deleted projects. The `clientId` SHALL reference a non-deleted client owned by the user. On success the created project SHALL be returned and a success Toast SHALL be shown.

#### Scenario: Successful creation
- **WHEN** an authenticated user submits a valid, unique name and a `clientId` for a client they own
- **THEN** the system SHALL create the project scoped to the user, return it, and the new project SHALL appear in the list

#### Scenario: Empty name rejected
- **WHEN** the submitted name is empty or whitespace-only
- **THEN** the system SHALL reject the request with `{ messageKey, params }` and the field error SHALL render inline under the field

#### Scenario: Missing client rejected
- **WHEN** the request omits `clientId` or provides an invalid value
- **THEN** the system SHALL reject the request with `{ messageKey, params }` and the field error SHALL render inline under the field

#### Scenario: Duplicate name per client rejected
- **WHEN** the submitted name matches an existing non-deleted project of the same user under the same client
- **THEN** the system SHALL reject the request with `messageKey: 'error.projectNameDuplicate'` and the error SHALL render inline under the field

#### Scenario: Same name under a different client allowed
- **WHEN** the submitted name matches a non-deleted project of the same user but under a different client
- **THEN** the system SHALL allow creation

#### Scenario: Archived name reuse
- **WHEN** the submitted name matches only a soft-deleted project of the same user under the same client
- **THEN** the system SHALL allow creation

### Requirement: REQ-TTR-022 Edit a project
The system SHALL allow an authenticated user to update the `name` and `clientId` of their own project via `PATCH /api/projects/[id]`, applying the same validation as creation. Editing SHALL be scoped by `userId`. Client ownership and non-deleted validation SHALL only be enforced when the `clientId` is changed to a different client; when the `clientId` is unchanged from the project's current client, the system SHALL NOT validate that client's soft-delete status, so the project's `name` can still be edited after its client has been soft-deleted.

#### Scenario: Successful edit
- **WHEN** an authenticated user submits a valid new name and an owned `clientId` for their own project
- **THEN** the system SHALL update the project, return it (including the resolved `clientName`), and the row SHALL reflect the change

#### Scenario: Edit dialog shows a soft-deleted client
- **WHEN** an authenticated user opens the edit dialog for a project whose owning client has been soft-deleted (and is therefore absent from the active client list)
- **THEN** the Client select SHALL be seeded with the project's `clientId`/`clientName` so the correct client is displayed and pre-selected

#### Scenario: Edit to a duplicate name per client rejected
- **WHEN** the new name matches another non-deleted project of the same user under the same client
- **THEN** the system SHALL reject the request with `messageKey: 'error.projectNameDuplicate'` rendered inline

#### Scenario: Rename a project whose client is soft-deleted
- **WHEN** an authenticated user updates the `name` of their own project without changing its `clientId`, and that project's current client has been soft-deleted
- **THEN** the system SHALL allow the update and SHALL NOT reject it on account of the client's soft-delete status

### Requirement: REQ-TTR-023 Soft-delete a project
The system SHALL soft-delete a project via `DELETE /api/projects/[id]` by setting `deletedAt`, scoped by `userId`, and SHALL never hard-delete the row. Deletion SHALL be confirmed via a confirm dialog before it is performed.

#### Scenario: Successful soft delete
- **WHEN** an authenticated user confirms deletion of their own project
- **THEN** the system SHALL set `deletedAt`, retain the database row, the project SHALL disappear from the list, and a success Toast SHALL be shown

#### Scenario: Deletion requires confirmation
- **WHEN** the user activates the delete action
- **THEN** a confirm dialog SHALL be shown and no deletion SHALL occur until the user confirms

### Requirement: REQ-TTR-024 Client relationship and ownership
Every project SHALL belong to exactly one client owned by the same user. On create, and on update when the `clientId` is changed to a different client, the system SHALL validate that the target `clientId` references a non-deleted client owned by the authenticated user; a foreign or unknown `clientId` SHALL resolve to HTTP 404 without confirming the client's existence. When an update leaves the `clientId` unchanged, the system SHALL NOT re-validate the existing client's ownership or soft-delete status, allowing edits to a project whose client was later soft-deleted.

#### Scenario: Assigning a foreign client rejected
- **WHEN** an authenticated user creates or updates a project with a `clientId` owned by another user
- **THEN** the system SHALL respond with HTTP 404 and SHALL NOT reveal that the client exists

#### Scenario: Assigning an unknown client rejected
- **WHEN** an authenticated user creates or updates a project with a `clientId` that does not exist
- **THEN** the system SHALL respond with HTTP 404

#### Scenario: Unchanged client is not re-validated
- **WHEN** an authenticated user updates a project without changing its `clientId`
- **THEN** the system SHALL NOT re-validate the existing client's ownership or soft-delete status and SHALL allow the update

### Requirement: REQ-TTR-025 Strict cross-user isolation
Every read and write SHALL be scoped by the authenticated user's id. A project id belonging to another user, or an unknown id, SHALL resolve to HTTP 404 without confirming the resource's existence.

#### Scenario: Foreign project id on read or write
- **WHEN** an authenticated user references a project id owned by another user
- **THEN** the system SHALL respond with HTTP 404 and SHALL NOT reveal that the resource exists

#### Scenario: Unknown project id
- **WHEN** an authenticated user references a project id that does not exist
- **THEN** the system SHALL respond with HTTP 404

### Requirement: REQ-NFR-018 Authenticated and CSRF-guarded project endpoints
All project endpoints SHALL require authentication via `requireAuth`, and mutating endpoints (`POST`, `PATCH`, `DELETE`) SHALL be CSRF-protected; client-side mutations SHALL use `$csrfFetch` / `useCsrfFetch`. API errors SHALL use the `{ messageKey, params }` contract translated client-side via `t()`; server/network failures SHALL surface as a Toast.

#### Scenario: Unauthenticated request rejected
- **WHEN** any project endpoint is called without a valid session
- **THEN** the system SHALL respond with HTTP 401

#### Scenario: Missing CSRF token rejected
- **WHEN** a mutating project request is made without a valid CSRF token
- **THEN** the system SHALL reject the request

#### Scenario: Server failure surfaced
- **WHEN** a mutation fails with an API error
- **THEN** the client SHALL show a Toast translated from the returned `messageKey`

### Requirement: REQ-NFR-019 Accessible, tokenized Projects UI
The Projects page SHALL meet WCAG 2.1 AA: form fields including the Client select SHALL be labelled, the create/edit dialog and confirm dialog SHALL be accessible and keyboard operable, and invalid fields SHALL expose `aria-invalid` with an associated described error (mirroring `login.vue`). Styling SHALL derive from PrimeVue theme tokens with no ad-hoc inline colors, and all user-facing strings SHALL exist in `en` and `pl` in parity.

#### Scenario: Inline field error is accessible
- **WHEN** a field validation error is shown
- **THEN** the field SHALL expose `aria-invalid` and reference the error via `aria-describedby`

#### Scenario: Client select is labelled
- **WHEN** the create/edit dialog renders the Client select
- **THEN** the select SHALL have an associated label and be keyboard operable

#### Scenario: Strings localized in parity
- **WHEN** new user-facing strings are added
- **THEN** they SHALL exist in both `en.json` and `pl.json` with matching keys
