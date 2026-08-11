# project-management Specification

## Purpose
Define how authenticated users manage their own projects (the middle of the `Client → Project → Task` hierarchy): listing, creating, editing, and soft-deleting projects, each belonging to exactly one client owned by the same user, with an accessible, tokenized Projects UI. All project endpoints follow the shared `api-endpoint-conventions` (authentication, CSRF, the translated error contract, strict per-user isolation, and boundary validation).

## Requirements

### Requirement: REQ-084 List own projects
The system SHALL show the authenticated user only their own non-deleted projects, ordered by name, via `GET /api/projects`. The list SHALL exclude any project whose `deletedAt` is set and any project belonging to another user. The endpoint SHALL accept an optional `trackerId` query parameter that further restricts results to that tracker, always additionally scoped by `userId`. A dedicated filter value or query convention SHALL allow listing only local projects (`trackerId` is null). Each returned project SHALL include optional tracker context: `trackerId` (nullable) and `trackerName` (nullable) resolved via a join that does NOT filter on the tracker's `deletedAt`, so the name is present even when the tracker has been soft-deleted. Local projects SHALL return `trackerId` null and `trackerName` null.

The Projects management page (`/projects`) SHALL load and display the full unfiltered project list for the authenticated user (no page-level tracker filter control). The page MAY call `GET /api/projects` without a `trackerId` query parameter. The optional API filter remains available for non-page callers; the MVP Projects UI SHALL NOT expose tracker filtering.

#### Scenario: Response includes optional tracker name
- **WHEN** an authenticated user lists their projects
- **THEN** each returned project SHALL include `trackerId` and `trackerName` (both null when the project is local)

#### Scenario: Tracker name persists after the tracker is soft-deleted
- **WHEN** a project's tracker has been soft-deleted
- **THEN** the project SHALL still appear in the list (when not itself deleted) with its `trackerName` populated from the soft-deleted tracker

#### Scenario: User sees only their own projects
- **WHEN** an authenticated user requests their projects
- **THEN** the response SHALL contain only projects where `userId` equals the user's id and `deletedAt` is null, ordered by name

#### Scenario: Soft-deleted projects are excluded
- **WHEN** an authenticated user has a soft-deleted project
- **THEN** that project SHALL NOT appear in the list

#### Scenario: Filter by tracker
- **WHEN** an authenticated user requests their projects with a `trackerId` filter for a tracker they own
- **THEN** the response SHALL contain only their non-deleted projects belonging to that tracker

#### Scenario: Filter by a foreign or unknown tracker
- **WHEN** an authenticated user requests projects with a `trackerId` that is unknown or owned by another user
- **THEN** the system SHALL return an empty list and SHALL NOT reveal whether that tracker exists

#### Scenario: Empty state
- **WHEN** an authenticated user has no projects
- **THEN** the Projects page SHALL render a dedicated empty state with a create call-to-action instead of an empty table

#### Scenario: Projects page has no tracker filter control
- **WHEN** an authenticated user views the Projects page
- **THEN** the page SHALL NOT render a tracker filter control for narrowing the project table

### Requirement: REQ-085 Create a project
The system SHALL allow an authenticated user to create a project with a `name` and an optional `trackerId` via `POST /api/projects`. The `name` SHALL be trimmed, non-empty, and length-bounded. Among non-deleted projects of the same user, names SHALL be unique per tracker when `trackerId` is set, and unique among local projects (`trackerId` null) when local. When provided, `trackerId` SHALL reference a non-deleted tracker owned by the user; omitting `trackerId` or sending `null` SHALL create a local project. On success the created project SHALL be returned and a success Toast SHALL be shown.

#### Scenario: Successful creation under a tracker
- **WHEN** an authenticated user submits a valid, unique name and a `trackerId` for a tracker they own
- **THEN** the system SHALL create the project scoped to the user, return it, and the new project SHALL appear in the list

#### Scenario: Successful local project creation
- **WHEN** an authenticated user submits a valid name with no `trackerId` (or explicit null)
- **THEN** the system SHALL create a local project (`trackerId` null) and return it

#### Scenario: Empty name rejected
- **WHEN** the submitted name is empty or whitespace-only
- **THEN** the system SHALL reject the request with `{ messageKey, params }` and the field error SHALL render inline under the field

#### Scenario: Duplicate name per tracker rejected
- **WHEN** the submitted name matches an existing non-deleted project of the same user under the same tracker
- **THEN** the system SHALL reject the request with `messageKey: 'error.projectNameDuplicate'` and the error SHALL render inline under the field

#### Scenario: Duplicate local name rejected
- **WHEN** the submitted name matches an existing non-deleted local project of the same user
- **THEN** the system SHALL reject the request with `messageKey: 'error.projectNameDuplicate'` and the error SHALL render inline under the field

#### Scenario: Same name under a different tracker allowed
- **WHEN** the submitted name matches a non-deleted project of the same user but under a different tracker (or one is local and the other is not)
- **THEN** the system SHALL allow creation

#### Scenario: Archived name reuse
- **WHEN** the submitted name matches only a soft-deleted project of the same user in the same tracker scope (including local)
- **THEN** the system SHALL allow creation

### Requirement: REQ-086 Edit a project
The system SHALL allow an authenticated user to update the `name` and optional `trackerId` of their own project via `PATCH /api/projects/[id]`, applying the same validation as creation. Editing SHALL be scoped by `userId`. Tracker ownership and non-deleted validation SHALL only be enforced when the `trackerId` is changed to a different non-null tracker; when the `trackerId` is unchanged from the project's current tracker, the system SHALL NOT validate that tracker's soft-delete status, so the project's `name` can still be edited after its tracker has been soft-deleted. Setting `trackerId` to `null` SHALL detach the project from its tracker (local project) and SHALL be allowed even when tasks under the project hold historical remote issue references; new linking and push SHALL remain blocked while the project has no active tracker. Detach and attach changes that affect remote eligibility SHALL require user confirmation in the UI before the request is sent.

#### Scenario: Successful edit
- **WHEN** an authenticated user submits a valid new name and an owned `trackerId` (or null) for their own project
- **THEN** the system SHALL update the project, return it (including resolved `trackerName` when applicable), and the row SHALL reflect the change

#### Scenario: Edit modal shows a soft-deleted tracker
- **WHEN** an authenticated user opens the edit modal for a project whose tracker has been soft-deleted (and is therefore absent from the active tracker list)
- **THEN** the Tracker select SHALL be seeded with the project's `trackerId`/`trackerName` so the correct tracker is displayed and pre-selected

#### Scenario: Edit to a duplicate name in scope rejected
- **WHEN** the new name matches another non-deleted project of the same user in the same tracker scope (including local)
- **THEN** the system SHALL reject the request with `messageKey: 'error.projectNameDuplicate'` rendered inline

#### Scenario: Rename a project whose tracker is soft-deleted
- **WHEN** an authenticated user updates the `name` of their own project without changing its `trackerId`, and that project's current tracker has been soft-deleted
- **THEN** the system SHALL allow the update and SHALL NOT reject it on account of the tracker's soft-delete status

#### Scenario: Detach from tracker with historical issue refs
- **WHEN** an authenticated user confirms clearing `trackerId` on a project that has tasks with remote issue references
- **THEN** the system SHALL set `trackerId` to null, keep existing issue references as historical data, and block new link/push until an active tracker is assigned again

### Requirement: REQ-087 Soft-delete a project
The system SHALL soft-delete a project via `DELETE /api/projects/[id]` by setting `deletedAt`, scoped by `userId`, and SHALL never hard-delete the row. Deletion SHALL be confirmed via a confirm dialog before it is performed.

#### Scenario: Successful soft delete
- **WHEN** an authenticated user confirms deletion of their own project
- **THEN** the system SHALL set `deletedAt`, retain the database row, the project SHALL disappear from the list, and a success Toast SHALL be shown

#### Scenario: Deletion requires confirmation
- **WHEN** the user activates the delete action
- **THEN** a confirm dialog SHALL be shown and no deletion SHALL occur until the user confirms

### Requirement: REQ-088 Client relationship and ownership
Every project MAY optionally belong to at most one tracker owned by the same user, or to no tracker (local). On create, and on update when the `trackerId` is changed to a different non-null tracker, the system SHALL validate that the target `trackerId` references a non-deleted tracker owned by the authenticated user; a foreign or unknown `trackerId` SHALL resolve to HTTP 404 without confirming the tracker's existence. When an update leaves the `trackerId` unchanged, the system SHALL NOT re-validate the existing tracker's ownership or soft-delete status, allowing edits to a project whose tracker was later soft-deleted. Clearing `trackerId` to null SHALL not require a tracker to exist.

#### Scenario: Assigning a foreign tracker rejected
- **WHEN** an authenticated user creates or updates a project with a `trackerId` owned by another user
- **THEN** the system SHALL respond with HTTP 404 and SHALL NOT reveal that the tracker exists

#### Scenario: Assigning an unknown tracker rejected
- **WHEN** an authenticated user creates or updates a project with a `trackerId` that does not exist
- **THEN** the system SHALL respond with HTTP 404

#### Scenario: Unchanged tracker is not re-validated
- **WHEN** an authenticated user updates a project without changing its `trackerId`
- **THEN** the system SHALL NOT re-validate the existing tracker's ownership or soft-delete status and SHALL allow the update

#### Scenario: Local project needs no tracker
- **WHEN** an authenticated user creates or updates a project with `trackerId` null
- **THEN** the system SHALL accept the request without requiring a tracker

### Requirement: REQ-089 Strict cross-user isolation
Every read and write SHALL be scoped by the authenticated user's id. A project id belonging to another user, or an unknown id, SHALL resolve to HTTP 404 without confirming the resource's existence.

#### Scenario: Foreign project id on read or write
- **WHEN** an authenticated user references a project id owned by another user
- **THEN** the system SHALL respond with HTTP 404 and SHALL NOT reveal that the resource exists

#### Scenario: Unknown project id
- **WHEN** an authenticated user references a project id that does not exist
- **THEN** the system SHALL respond with HTTP 404

### Requirement: REQ-091 Accessible, tokenized Projects UI
The Projects page SHALL meet WCAG 2.1 AA: form fields including the optional Tracker select SHALL be labelled, the create/edit modal and confirm modal SHALL be accessible and keyboard operable, and invalid fields SHALL expose `aria-invalid` with an associated described error (mirroring `login.vue`). Styling SHALL derive from Tailwind utilities and Nuxt UI `--ui-*` design tokens with no ad-hoc inline colors, and all user-facing strings SHALL exist in `en` and `pl` in parity.

#### Scenario: Inline field error is accessible
- **WHEN** a field validation error is shown
- **THEN** the field SHALL expose `aria-invalid` and reference the error via `aria-describedby`

#### Scenario: Tracker select is labelled
- **WHEN** the create/edit modal renders the Tracker select
- **THEN** the select SHALL have an associated label and be keyboard operable

#### Scenario: Strings localized in parity
- **WHEN** new user-facing strings are added
- **THEN** they SHALL exist in both `en.json` and `pl.json` with matching keys

### Requirement: REQ-092 Client-side validation of the project form
The project create/edit form SHALL validate input client-side using the shared `createProjectSchema` from `shared/types/project.ts` (bound directly to Nuxt UI's `UForm` `:schema`) before any request is sent. `trackerId` SHALL be optional (nullable uuid); the form SHALL NOT require a tracker. Validation failures SHALL render the schema's messageKey translated via `t()` as an inline field error and SHALL prevent the request. Server-side validation SHALL remain unchanged and authoritative; server-only field errors (e.g. `error.projectNameDuplicate`) SHALL still render inline under the field after submission.

#### Scenario: Empty name blocked client-side
- **WHEN** the user submits the project form with an empty or whitespace-only name
- **THEN** the form SHALL show the `error.projectNameRequired` message inline and SHALL NOT send a request

#### Scenario: Local project allowed client-side
- **WHEN** the user submits the project form without selecting a tracker
- **THEN** the form SHALL NOT block submission solely for a missing tracker

#### Scenario: Server-only duplicate error still shown inline
- **WHEN** the submitted values pass client-side validation but the server rejects the name as a duplicate for that tracker scope
- **THEN** the `error.projectNameDuplicate` message SHALL render inline under the name field

### Requirement: REQ-260 Projects page list available on initial SSR render
The Projects management page (`/projects`) SHALL resolve the authenticated user's full project list during server-side rendering of a full document load so the initial HTML/payload already contains the list data (or an empty list for the empty state). The SSR list fetch SHALL authenticate using the incoming session cookie and SHALL NOT depend on client-only `onMounted` bootstrap for the primary table.

#### Scenario: Hard reload shows project rows without client-only bootstrap
- **WHEN** an authenticated user with at least one project performs a full document load of `/projects`
- **THEN** the initial render payload SHALL already include those projects so the table can render rows without depending solely on an `onMounted` client fetch

#### Scenario: Hard reload empty state
- **WHEN** an authenticated user with no projects performs a full document load of `/projects`
- **THEN** the page SHALL be able to render the empty state from the SSR-resolved empty list

#### Scenario: SSR list uses the session cookie
- **WHEN** the Projects page resolves the list during SSR
- **THEN** the request SHALL carry the browser session cookie material available on the incoming HTTP request

### Requirement: REQ-261 Project form loads tracker options on dialog open
The Projects create/edit dialog SHALL load active tracker options for the Tracker select only when the dialog is opened, not as part of the page's initial SSR list bootstrap. While tracker options are loading, the Tracker select SHALL expose a loading indicator (and MAY be disabled until options resolve). Edit flows SHALL continue to seed a soft-deleted or otherwise missing tracker via the project's `trackerId`/`trackerName` when that tracker is absent from the active list (REQ-086). Create flows SHALL default to no tracker selected (local) when the dialog opens.

#### Scenario: Opening create does not require trackers on page load
- **WHEN** an authenticated user loads `/projects` without opening the create/edit dialog
- **THEN** the page SHALL NOT require a successful trackers list fetch to render the projects table

#### Scenario: Opening the dialog loads trackers with loading state
- **WHEN** the user opens the create or edit project dialog and tracker options are not yet loaded
- **THEN** the system SHALL fetch the user's active trackers and the Tracker select SHALL show a loading indicator until the fetch completes

#### Scenario: Reopening the dialog may reuse cached options
- **WHEN** the user opens the project dialog again in the same session after tracker options were loaded
- **THEN** the dialog MAY reuse the previously loaded tracker options without a mandatory network round-trip
