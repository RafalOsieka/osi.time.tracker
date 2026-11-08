## ADDED Requirements

### Requirement: REQ-524 Projects page rows show their binding and recent time
Each row of the Projects page SHALL show where the project's time goes and how much it received lately: a tracker-bound project its Tracker's system type and name, then its remote project title or, when unscoped, that it covers the whole tracker; a local project a local mark and label. Instead of a creation date, each row SHALL show its `recentTrackedSeconds` (REQ-371) as an `H:MM` duration under a translated last-30-days header.

#### Scenario: Bound and scoped project
- **WHEN** a project is bound to an OpenProject Tracker named "Acme" and scoped to the remote project "Website"
- **THEN** its row SHALL show the OpenProject type, "Acme" and "Website"

#### Scenario: Bound project without a scope
- **WHEN** a project is bound to a Tracker without a remote project
- **THEN** its row SHALL show the Tracker's type and name followed by a translated "whole tracker" label

#### Scenario: Local project
- **WHEN** a project has no Tracker
- **THEN** its row SHALL show a neutral local mark and the translated "local project" label

#### Scenario: Recent time column
- **WHEN** a project has 1 h 30 min of entries started within the last 30 days
- **THEN** its row SHALL show `1:30` under the last-30-days header, and a project without such entries SHALL show `0:00`

## MODIFIED Requirements

### Requirement: REQ-084 List own projects
`GET /api/projects` SHALL return the user's own non-deleted projects ordered by name. An optional `trackerId` filter SHALL narrow it to one tracker, and a dedicated filter value to local projects (no tracker). Each project SHALL carry nullable `trackerId`, `trackerName` and `trackerSystemType`; name and system SHALL be present even when the tracker is soft-deleted, and all three null for local projects. The `/projects` page SHALL show the full list, with no tracker filter.

#### Scenario: Response includes optional tracker name
- **WHEN** an authenticated user lists their projects
- **THEN** each returned project SHALL include `trackerId`, `trackerName` and `trackerSystemType` (all null when the project is local)

#### Scenario: Tracker name persists after the tracker is soft-deleted
- **WHEN** a project's tracker has been soft-deleted
- **THEN** the project SHALL still appear in the list (when not itself deleted) with its `trackerName` and `trackerSystemType` populated from the soft-deleted tracker

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

### Requirement: REQ-087 Soft-delete a project
The system SHALL soft-delete a project via `DELETE /api/projects/[id]` by setting `deletedAt`, scoped by `userId`, and SHALL never hard-delete the row. Deletion SHALL be confirmed via a confirm dialog before it is performed.

#### Scenario: Successful soft delete
- **WHEN** an authenticated user confirms deletion of their own project
- **THEN** the system SHALL set `deletedAt`, retain the database row, the project SHALL disappear from the list, and a success Toast SHALL be shown

#### Scenario: Deletion requires confirmation
- **WHEN** the user activates the delete action
- **THEN** a confirm dialog SHALL be shown and no deletion SHALL occur until the user confirms

#### Scenario: Confirmation states what the user keeps
- **WHEN** the delete confirmation is shown
- **THEN** it SHALL name the project, say that it can no longer be picked for new entries and that its time entries are kept, and offer a named delete action and a cancel action

### Requirement: REQ-261 Project form loads tracker options on dialog open
The project dialog SHALL load the active tracker options only when it opens, showing a loading indicator on the Tracker select meanwhile. Edit SHALL still seed a soft-deleted or missing tracker from the project's `trackerId`/`trackerName` (REQ-086). The select SHALL offer an explicit local choice first, selected on create, which also detaches a bound project.

#### Scenario: Opening create does not require trackers on page load
- **WHEN** an authenticated user loads `/projects` without opening the create/edit dialog
- **THEN** the page SHALL NOT require a successful trackers list fetch to render the projects table

#### Scenario: Opening the dialog loads trackers with loading state
- **WHEN** the user opens the create or edit project dialog and tracker options are not yet loaded
- **THEN** the system SHALL fetch the user's active trackers and the Tracker select SHALL show a loading indicator until the fetch completes, and MAY be disabled meanwhile

#### Scenario: Reopening the dialog may reuse cached options
- **WHEN** the user opens the project dialog again in the same session after tracker options were loaded
- **THEN** the dialog MAY reuse the previously loaded tracker options without a mandatory network round-trip

#### Scenario: Detach through the local choice
- **WHEN** the user picks the local choice for a project bound to a tracker and saves
- **THEN** the form SHALL submit `trackerId` null and hide the remote project select
