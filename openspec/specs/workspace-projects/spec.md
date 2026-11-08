# workspace-projects Specification

## Purpose
How users manage their projects: list, create, edit and soft-delete them, each project optionally bound to one of their trackers and, within it, to a remote project scope. All project endpoints follow `core-api-conventions`.

## Requirements

### Requirement: REQ-084 List own projects
`GET /api/projects` SHALL return the user's own non-deleted projects ordered by name. An optional `trackerId` filter SHALL narrow it to one tracker, and a dedicated filter value to local projects (no tracker). Each project SHALL carry nullable `trackerId` and `trackerName`; the name SHALL be present even when the tracker is soft-deleted, and both SHALL be null for local projects. The `/projects` page SHALL show the full unfiltered list and SHALL NOT offer a tracker filter.

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
The system SHALL let a user create a project via `POST /api/projects` with a `name` and an optional `trackerId`. The name SHALL be trimmed, non-empty and length-bounded, and unique among the user's non-deleted projects per tracker, or among local projects when `trackerId` is null or omitted. A given `trackerId` SHALL reference a non-deleted tracker the user owns. On success the project SHALL be returned and a success Toast shown.

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
The system SHALL let a user update the `name` and optional `trackerId` of their own project via `PATCH /api/projects/[id]`, with the same validation as creation and the tracker rules of REQ-088. Setting `trackerId` to `null` SHALL detach the project (local), even when its tasks hold historical remote issue references; new linking and export stay blocked until an active tracker is assigned. Detaching or attaching in a way that changes remote eligibility SHALL require confirmation in the UI first.

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

### Requirement: REQ-088 Tracker relationship and ownership
A project SHALL belong to at most one tracker owned by the same user, or to none (local). On create, and when an update changes `trackerId` to a different non-null tracker, the target SHALL be a non-deleted tracker the user owns; a foreign or unknown one SHALL resolve to HTTP 404 without confirming it exists. An update that keeps `trackerId` SHALL NOT re-validate that tracker, so a project whose tracker was soft-deleted can still be renamed. Clearing `trackerId` needs no tracker.

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

### Requirement: REQ-325 Optional remote project scope on a project
A tracker-bound project MAY carry a remote project scope: an opaque `remoteProjectId` and a cached `remoteProjectTitle`, each trimmed, non-empty and length-bounded, and either both present or both absent. Create and update SHALL reject a half-set pair with a `422` `{ messageKey, params }` and persist nothing. The server SHALL NOT contact the tracker to validate it (it holds no secret). Every project response SHALL return both fields (null when absent). The scope SHALL NOT affect name uniqueness.

#### Scenario: Create a project with a scope
- **WHEN** an authenticated user creates a project with a valid `trackerId`, `remoteProjectId`, and `remoteProjectTitle`
- **THEN** the system SHALL persist all three and return them on the created project

#### Scenario: Create a project without a scope
- **WHEN** an authenticated user creates a tracker-bound project omitting both scope fields (or sending both null)
- **THEN** the system SHALL persist no scope and return both fields as null

#### Scenario: Half-set scope is rejected
- **WHEN** a request supplies `remoteProjectId` without `remoteProjectTitle`, or vice versa
- **THEN** the system SHALL respond with 422, a translated `messageKey`, and persist nothing

#### Scenario: List includes scope fields
- **WHEN** an authenticated user lists their projects
- **THEN** each project SHALL include `remoteProjectId` and `remoteProjectTitle`, null for projects without a scope

### Requirement: REQ-439 A local project has no remote project scope
A local project (`trackerId` null) SHALL have no scope. `POST` SHALL reject a scope sent with `trackerId` null or omitted, and `PATCH` SHALL reject a scope for a project that is and stays local, both with `422` `{ messageKey, params }` and nothing persisted. A `PATCH` that changes or clears `trackerId` in the same request follows REQ-326 instead.

#### Scenario: Scope on a local project is rejected at create
- **WHEN** a create request supplies a scope while `trackerId` is null or omitted
- **THEN** the system SHALL respond with 422 and persist nothing

#### Scenario: Scope added to an already-local project is rejected
- **WHEN** a `PATCH` request supplies a scope for a project whose `trackerId` is already null and the request does not set a `trackerId`
- **THEN** the system SHALL respond with 422 and persist nothing

### Requirement: REQ-326 Changing the tracker clears the scope
When a `PATCH` changes `trackerId` to another tracker or to null, the system SHALL clear `remoteProjectId` and `remoteProjectTitle` whatever the body says, because a remote project id is meaningful only for its tracker; this SHALL succeed even when the body still carries the old scope. A `PATCH` that keeps `trackerId` SHALL apply the body's scope fields (set, replace or clear), subject to REQ-439.

#### Scenario: Reassigning to another tracker drops the scope
- **WHEN** an authenticated user changes a scoped project's `trackerId` to another owned tracker while the body still carries the old scope
- **THEN** the system SHALL persist the new tracker with both scope fields null

#### Scenario: Detaching drops the scope
- **WHEN** an authenticated user sets a scoped project's `trackerId` to null
- **THEN** the system SHALL persist the project as local with both scope fields null

#### Scenario: Detaching succeeds even when the body still echoes the old scope
- **WHEN** a detach request (`trackerId: null`) also carries the project's previous `remoteProjectId`/`remoteProjectTitle`
- **THEN** the system SHALL succeed and persist the project as local with both scope fields null, rather than rejecting it under REQ-439

#### Scenario: Same tracker, new scope
- **WHEN** an authenticated user keeps `trackerId` unchanged and supplies a different remote project pair
- **THEN** the system SHALL replace the stored scope with the supplied pair

#### Scenario: Same tracker, cleared scope
- **WHEN** an authenticated user keeps `trackerId` unchanged and sends both scope fields null
- **THEN** the system SHALL clear the stored scope

### Requirement: REQ-091 Accessible, tokenized Projects UI
The Projects page SHALL meet WCAG 2.1 AA: labelled fields including the optional Tracker select, accessible and keyboard-operable create/edit and confirm dialogs, and invalid fields exposing `aria-invalid` with an associated error. Colors SHALL come from theme tokens, never inline colors, and all strings SHALL exist in `en` and `pl` in parity.

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
The project create/edit form SHALL validate input client-side with the same schema the server uses before any request is sent. `trackerId` SHALL be optional; the form SHALL NOT require a tracker. A validation failure SHALL show the translated `messageKey` inline under the field and SHALL prevent the request. The server SHALL stay authoritative; its field errors (e.g. `error.projectNameDuplicate`) SHALL still render inline under the field.

#### Scenario: Empty name blocked client-side
- **WHEN** the user submits the project form with an empty or whitespace-only name
- **THEN** the form SHALL show the `error.projectNameRequired` message inline and SHALL NOT send a request

#### Scenario: Local project allowed client-side
- **WHEN** the user submits the project form without selecting a tracker
- **THEN** the form SHALL NOT block submission solely for a missing tracker

#### Scenario: Server-only duplicate error still shown inline
- **WHEN** the submitted values pass client-side validation but the server rejects the name as a duplicate for that tracker scope
- **THEN** the `error.projectNameDuplicate` message SHALL render inline under the name field

### Requirement: REQ-261 Project form loads tracker options on dialog open
The project dialog SHALL load the active tracker options only when it opens, not as part of the page's initial data, showing a loading indicator on the Tracker select meanwhile (it MAY be disabled until they resolve). Edit SHALL still seed a soft-deleted or missing tracker from the project's `trackerId`/`trackerName` (REQ-086). Create SHALL default to no tracker (local).

#### Scenario: Opening create does not require trackers on page load
- **WHEN** an authenticated user loads `/projects` without opening the create/edit dialog
- **THEN** the page SHALL NOT require a successful trackers list fetch to render the projects table

#### Scenario: Opening the dialog loads trackers with loading state
- **WHEN** the user opens the create or edit project dialog and tracker options are not yet loaded
- **THEN** the system SHALL fetch the user's active trackers and the Tracker select SHALL show a loading indicator until the fetch completes

#### Scenario: Reopening the dialog may reuse cached options
- **WHEN** the user opens the project dialog again in the same session after tracker options were loaded
- **THEN** the dialog MAY reuse the previously loaded tracker options without a mandatory network round-trip

### Requirement: REQ-327 Project form remote project select
With a tracker selected, the project dialog SHALL show a labelled, keyboard-operable remote project select from that tracker's catalog (REQ-318), fetched with the browser-held secret, as an indented hierarchy with a "whole tracker" choice and a loading indicator. Choosing a project SHALL submit its id and title as the scope; changing the tracker SHALL clear the pending scope first. Strings SHALL have `en`/`pl` parity.

#### Scenario: Tracker selected with a browser secret
- **WHEN** the user selects a tracker for which a secret is stored in the browser
- **THEN** the dialog SHALL load that tracker's catalog, show a loading indicator meanwhile, and enable the remote project select

#### Scenario: Catalog renders hierarchy
- **WHEN** the catalog contains projects with parents
- **THEN** child projects SHALL appear indented under their parent in the select

#### Scenario: Switching tracker resets the pending scope
- **WHEN** the user changes the tracker select while a remote project is chosen
- **THEN** the remote project selection SHALL be cleared and the catalog for the new tracker SHALL load

#### Scenario: Local project hides the control
- **WHEN** no tracker is selected
- **THEN** the remote project select SHALL NOT be rendered and no scope SHALL be submitted

### Requirement: REQ-440 Remote project select without a catalog
When the catalog cannot be loaded, the remote project select SHALL degrade without blocking the project. Without a browser secret, or with an extension that does not offer the catalog operation, it SHALL be disabled with a translated hint, still show the cached `remoteProjectTitle`, and allow clearing it. A failed fetch SHALL show an accessible translated error with a retry action, and the project SHALL stay saveable without a scope.

#### Scenario: No secret in the browser
- **WHEN** the user opens the dialog for a scoped project whose tracker has no stored secret
- **THEN** the select SHALL be disabled, SHALL display the cached remote project title, SHALL allow clearing it, and SHALL show the tracker-settings hint

#### Scenario: Catalog fetch fails
- **WHEN** the catalog request fails
- **THEN** the dialog SHALL show a translated error with a retry action and the project SHALL remain saveable without a scope

#### Scenario: Extension mode without catalog support
- **WHEN** the tracker requires the desktop extension and the installed extension does not advertise the catalog operation
- **THEN** the select SHALL be disabled with a translated incompatibility hint, and the cached title (if any) SHALL remain clearable

### Requirement: REQ-371 Recent tracked time per project
Each project from `GET /api/projects` SHALL include `recentTrackedSeconds`: the summed duration of the user's time entries belonging to it through their task and started within the 30 days before the request, a running entry counting up to now. Untitled entries, other projects and other users SHALL NOT count; no qualifying entries means `0`. It SHALL NOT change the list's order (by name) or filtering, and SHALL NOT need a query per project.

#### Scenario: Recent time is summed per project
- **WHEN** the user has two stopped entries of 1 h and 30 min in "Helios" started within the last 30 days
- **THEN** "Helios" SHALL report `recentTrackedSeconds` of `5400`

#### Scenario: Older entries are excluded
- **WHEN** the user's only entry in "Nordwind" started 31 days ago
- **THEN** "Nordwind" SHALL report `recentTrackedSeconds` of `0`

#### Scenario: Running entry counts up to now
- **WHEN** the user's running entry in "Helios" started 10 minutes ago
- **THEN** "Helios" SHALL report at least `600` seconds for that entry

#### Scenario: Other users' time is ignored
- **WHEN** another user tracks time in their own project of the same name
- **THEN** the authenticated user's project SHALL NOT include that time

#### Scenario: Ordering is unchanged
- **WHEN** the user lists their projects
- **THEN** projects SHALL still be ordered by name regardless of `recentTrackedSeconds`

#### Scenario: Unauthenticated request
- **WHEN** a request without a valid session calls `GET /api/projects`
- **THEN** the system SHALL respond with HTTP 401 and SHALL NOT return projects
