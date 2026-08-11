## MODIFIED Requirements

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

## ADDED Requirements

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
