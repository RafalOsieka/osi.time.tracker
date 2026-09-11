## ADDED Requirements

### Requirement: REQ-325 Optional remote project scope on a project
A tracker-bound project MAY carry a remote project scope: one opaque `remoteProjectId` (trimmed, non-empty, length-bounded text) together with a cached `remoteProjectTitle` (trimmed, non-empty, length-bounded). Both SHALL be present or both absent; a local project (`trackerId` null) SHALL have no scope. `POST /api/projects` and `PATCH /api/projects/[id]` SHALL accept the two fields through the shared boundary schema and reject a half-set pair or a scope on a local project with a `422` `{ messageKey, params }` error. The server SHALL NOT contact the tracker to validate the id (it holds no secret) and SHALL store the pair as cached data. `GET /api/projects` and every project response SHALL return both fields (null when absent). Scope SHALL NOT affect project-name uniqueness.

#### Scenario: Create a project with a scope
- **WHEN** an authenticated user creates a project with a valid `trackerId`, `remoteProjectId`, and `remoteProjectTitle`
- **THEN** the system SHALL persist all three and return them on the created project

#### Scenario: Create a project without a scope
- **WHEN** an authenticated user creates a tracker-bound project omitting both scope fields (or sending both null)
- **THEN** the system SHALL persist no scope and return both fields as null

#### Scenario: Half-set scope is rejected
- **WHEN** a request supplies `remoteProjectId` without `remoteProjectTitle`, or vice versa
- **THEN** the system SHALL respond with 422, a translated `messageKey`, and persist nothing

#### Scenario: Scope on a local project is rejected
- **WHEN** a request supplies a scope while `trackerId` is null or omitted
- **THEN** the system SHALL respond with 422 and persist nothing

#### Scenario: List includes scope fields
- **WHEN** an authenticated user lists their projects
- **THEN** each project SHALL include `remoteProjectId` and `remoteProjectTitle`, null for projects without a scope

### Requirement: REQ-326 Changing the tracker clears the scope
When a `PATCH` changes a project's `trackerId` to a different tracker or to null, the system SHALL clear `remoteProjectId` and `remoteProjectTitle` regardless of the values in the request body, because a remote project id is meaningful only for the tracker it came from. A `PATCH` that leaves `trackerId` unchanged SHALL apply the scope fields from the body (set, replace, or clear).

#### Scenario: Reassigning to another tracker drops the scope
- **WHEN** an authenticated user changes a scoped project's `trackerId` to another owned tracker while the body still carries the old scope
- **THEN** the system SHALL persist the new tracker with both scope fields null

#### Scenario: Detaching drops the scope
- **WHEN** an authenticated user sets a scoped project's `trackerId` to null
- **THEN** the system SHALL persist the project as local with both scope fields null

#### Scenario: Same tracker, new scope
- **WHEN** an authenticated user keeps `trackerId` unchanged and supplies a different remote project pair
- **THEN** the system SHALL replace the stored scope with the supplied pair

#### Scenario: Same tracker, cleared scope
- **WHEN** an authenticated user keeps `trackerId` unchanged and sends both scope fields null
- **THEN** the system SHALL clear the stored scope

### Requirement: REQ-327 Project form remote project select
When the create/edit project dialog has a tracker selected, it SHALL show a labelled, keyboard-operable remote project select populated from the tracker's remote project catalog (REQ-318) fetched through the browser-held secret under the tracker's execution path. The select SHALL present the catalog as an indented hierarchy using each entry's parent id, SHALL offer an explicit "whole tracker" (no scope) choice, and SHALL show a loading indicator while fetching. When no secret is available in the browser, the select SHALL be disabled, SHALL still display the project's cached `remoteProjectTitle` when one exists, SHALL allow clearing the scope, and SHALL show a translated hint pointing to tracker settings. A catalog fetch failure SHALL render a translated, accessible error with a retry action and SHALL NOT block saving the project without a scope. Changing the selected tracker in the dialog SHALL clear the pending scope before loading the new catalog. Selecting a remote project SHALL submit its id and title as the scope pair. All strings SHALL exist in `en` and `pl` in parity.

#### Scenario: Tracker selected with a browser secret
- **WHEN** the user selects a tracker for which a secret is stored in the browser
- **THEN** the dialog SHALL load that tracker's catalog, show a loading indicator meanwhile, and enable the remote project select

#### Scenario: Catalog renders hierarchy
- **WHEN** the catalog contains projects with parents
- **THEN** child projects SHALL appear indented under their parent in the select

#### Scenario: No secret in the browser
- **WHEN** the user opens the dialog for a scoped project whose tracker has no stored secret
- **THEN** the select SHALL be disabled, SHALL display the cached remote project title, SHALL allow clearing it, and SHALL show the tracker-settings hint

#### Scenario: Catalog fetch fails
- **WHEN** the catalog request fails
- **THEN** the dialog SHALL show a translated error with a retry action and the project SHALL remain saveable without a scope

#### Scenario: Switching tracker resets the pending scope
- **WHEN** the user changes the tracker select while a remote project is chosen
- **THEN** the remote project selection SHALL be cleared and the catalog for the new tracker SHALL load

#### Scenario: Local project hides the control
- **WHEN** no tracker is selected
- **THEN** the remote project select SHALL NOT be rendered and no scope SHALL be submitted

#### Scenario: Extension mode without catalog support
- **WHEN** the tracker requires the desktop extension and the installed extension does not advertise the catalog operation
- **THEN** the select SHALL be disabled with a translated incompatibility hint, and the cached title (if any) SHALL remain clearable
