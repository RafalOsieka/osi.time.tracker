# client-management Specification

## Purpose
Define how authenticated users manage their own clients (the top of the `Client → Project → Task` hierarchy): listing, creating, renaming, and soft-deleting clients with an accessible, tokenized Clients UI. All client endpoints follow the shared `api-endpoint-conventions` (authentication, CSRF, the translated error contract, strict per-user isolation, and boundary validation).

## Requirements

### Requirement: REQ-027 List own clients
The system SHALL show the authenticated user only their own non-deleted clients, ordered by name, via `GET /api/clients`. The list SHALL exclude any client whose `deletedAt` is set and any client belonging to another user.

#### Scenario: User sees only their own clients
- **WHEN** an authenticated user requests their clients
- **THEN** the response SHALL contain only clients where `userId` equals the user's id and `deletedAt` is null, ordered by name

#### Scenario: Soft-deleted clients are excluded
- **WHEN** an authenticated user has a soft-deleted client
- **THEN** that client SHALL NOT appear in the list

#### Scenario: Empty state
- **WHEN** an authenticated user has no clients
- **THEN** the Clients page SHALL render a dedicated empty state with a create call-to-action instead of an empty table

### Requirement: REQ-028 Create a client
The system SHALL allow an authenticated user to create a client with a `name` via `POST /api/clients`. The `name` SHALL be trimmed, non-empty, length-bounded, and unique per user among non-deleted clients. On success the created client SHALL be returned and a success Toast SHALL be shown.

#### Scenario: Successful creation
- **WHEN** an authenticated user submits a valid, unique name
- **THEN** the system SHALL create the client scoped to the user, return it, and the new client SHALL appear in the list

#### Scenario: Empty name rejected
- **WHEN** the submitted name is empty or whitespace-only
- **THEN** the system SHALL reject the request with `{ messageKey, params }` and the field error SHALL render inline under the field

#### Scenario: Duplicate name rejected
- **WHEN** the submitted name matches an existing non-deleted client of the same user
- **THEN** the system SHALL reject the request with `messageKey: 'error.clientNameDuplicate'` and the error SHALL render inline under the field

#### Scenario: Archived name reuse
- **WHEN** the submitted name matches only a soft-deleted client of the same user
- **THEN** the system SHALL allow creation

### Requirement: REQ-029 Edit a client name
The system SHALL allow an authenticated user to update the `name` of their own client via `PATCH /api/clients/[id]`, applying the same validation as creation. Editing SHALL be scoped by `userId`.

#### Scenario: Successful rename
- **WHEN** an authenticated user submits a valid new name for their own client
- **THEN** the system SHALL update the name, return the updated client, and the row SHALL reflect the new name

#### Scenario: Rename to a duplicate rejected
- **WHEN** the new name matches another non-deleted client of the same user
- **THEN** the system SHALL reject the request with `messageKey: 'error.clientNameDuplicate'` rendered inline

### Requirement: REQ-030 Soft-delete a client
The system SHALL soft-delete a client via `DELETE /api/clients/[id]` by setting `deletedAt`, scoped by `userId`, and SHALL never hard-delete the row. Deletion SHALL be confirmed via a confirm dialog before it is performed.

#### Scenario: Successful soft delete
- **WHEN** an authenticated user confirms deletion of their own client
- **THEN** the system SHALL set `deletedAt`, retain the database row, the client SHALL disappear from the list, and a success Toast SHALL be shown

#### Scenario: Deletion requires confirmation
- **WHEN** the user activates the delete action
- **THEN** a confirm dialog SHALL be shown and no deletion SHALL occur until the user confirms

### Requirement: REQ-031 Strict cross-user isolation
Every read and write SHALL be scoped by the authenticated user's id. A client id belonging to another user, or an unknown id, SHALL resolve to HTTP 404 without confirming the resource's existence.

#### Scenario: Foreign client id on read or write
- **WHEN** an authenticated user references a client id owned by another user
- **THEN** the system SHALL respond with HTTP 404 and SHALL NOT reveal that the resource exists

#### Scenario: Unknown client id
- **WHEN** an authenticated user references a client id that does not exist
- **THEN** the system SHALL respond with HTTP 404

### Requirement: REQ-033 Accessible, tokenized Clients UI
The Clients page SHALL meet WCAG 2.1 AA: form fields SHALL be labelled, the create/edit dialog and confirm dialog SHALL be accessible and keyboard operable, and invalid fields SHALL expose `aria-invalid` with an associated described error (mirroring `login.vue`). Styling SHALL derive from PrimeVue theme tokens with no ad-hoc inline colors, and all user-facing strings SHALL exist in `en` and `pl` in parity.

#### Scenario: Inline field error is accessible
- **WHEN** a field validation error is shown
- **THEN** the field SHALL expose `aria-invalid` and reference the error via `aria-describedby`

#### Scenario: Strings localized in parity
- **WHEN** new user-facing strings are added
- **THEN** they SHALL exist in both `en.json` and `pl.json` with matching keys

### Requirement: REQ-034 Client-side validation of the client form
The client create/edit form SHALL validate input client-side using the shared `createClientSchema` from `shared/types/client.ts` (via a PrimeVue Forms resolver) before any request is sent. Validation failures SHALL render the schema's messageKey translated via `t()` as an inline field error and SHALL prevent the request. Server-side validation SHALL remain unchanged and authoritative; server-only field errors (e.g. `error.clientNameDuplicate`) SHALL still render inline under the field after submission.

#### Scenario: Empty name blocked client-side
- **WHEN** the user submits the client form with an empty or whitespace-only name
- **THEN** the form SHALL show the `error.clientNameRequired` message inline and SHALL NOT send a request

#### Scenario: Server-only duplicate error still shown inline
- **WHEN** the submitted name passes client-side validation but the server rejects it as a duplicate
- **THEN** the `error.clientNameDuplicate` message SHALL render inline under the name field
