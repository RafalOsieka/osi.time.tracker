## MODIFIED Requirements

### Requirement: REQ-TTR-107 Persist one remote issue reference per Task
The system SHALL store at most one remote issue reference for a Task in a separate one-to-one record containing the owning user, Task, remote-system configuration provenance, remote issue ID as text, cached title, and timestamps. It SHALL NOT store a remote issue URL. For an active matching configuration, the system SHALL derive the issue URL from its normalized base URL and remote issue ID using the URL pattern of the configuration's `systemType` (e.g. OpenProject work-package URLs, Redmine issue URLs), resolved through a per-provider abstraction rather than conditional branching.

#### Scenario: Link an issue
- **WHEN** an authenticated user selects an issue for their eligible Task
- **THEN** the system SHALL persist its ID and cached title against that Task and active configuration and SHALL return the resulting reference

#### Scenario: Replace an existing link
- **WHEN** the user selects a different issue for a Task that is already linked
- **THEN** the system SHALL atomically replace the prior reference so the Task still has exactly one reference

#### Scenario: Derive a usable issue URL
- **WHEN** a reference's originating configuration is active and available
- **THEN** the system SHALL derive a direct issue URL from the current base URL and encoded remote issue ID using the configuration's provider URL pattern

#### Scenario: Reference has no usable configuration
- **WHEN** the reference's configuration is not active or available
- **THEN** the system SHALL return its cached ID and title without a generated URL or remote-search capability

### Requirement: REQ-TTR-109 Remote issue linking is user-scoped and validated
All local link and unlink endpoints SHALL require authentication, enforce CSRF protection for mutations, validate request bodies through shared boundary schemas, and scope Task lookup to the authenticated user. Linking SHALL derive the Client and active configuration from the owned Task's Project and SHALL reject project-less Tasks, missing configurations, foreign Tasks, and unknown Tasks without trusting client-supplied ownership or configuration identifiers. Any active configuration whose `systemType` has a registered adapter (OpenProject, Redmine) SHALL be eligible for linking.

#### Scenario: Link an eligible owned Task
- **WHEN** an authenticated user submits a valid issue selection for their own Task under a Client with an active supported configuration (OpenProject or Redmine)
- **THEN** the system SHALL link it using the server-derived configuration provenance

#### Scenario: Ineligible Task is rejected
- **WHEN** the Task is project-less or its Client has no active remote-system configuration
- **THEN** the system SHALL reject linking with a translated `{ messageKey, params }` error and persist nothing

#### Scenario: Foreign or unknown Task is concealed
- **WHEN** a user attempts to link or unlink a foreign or unknown Task id
- **THEN** the system SHALL respond with HTTP 404 without revealing whether it exists

#### Scenario: Missing authentication or CSRF is rejected
- **WHEN** a local mutation lacks a valid session or CSRF token
- **THEN** the system SHALL reject it and SHALL persist nothing

### Requirement: REQ-TTR-110 Timer view remote issue picker
For each Task whose Project and Client resolve to an active remote-system configuration, the Timer view SHALL display a compact two-part remote-issue control. For a linked Task, the first part SHALL be a `#<remoteIssueId>` link to the remote issue, with its URL derived from the configuration and issue ID and a tooltip containing the cached issue title. For an unlinked Task, the first part SHALL instead display translated `(unlinked)` status text. The second part SHALL be a separately labeled pencil-icon `Button` that opens a reusable PrimeVue `Popover` containing an explicit title/issue-ID mode control, query input, submit action, and selectable result list below the search form. The picker SHALL expose translated validation, loading, empty, error, link, replace, and unlink states and SHALL meet WCAG 2.1 AA keyboard, labeling, focus, and status-announcement requirements. The issue link or status, pencil action, and other Task-row interactive controls SHALL remain siblings; interactive controls SHALL NOT be nested. The picker SHALL be enabled for every supported `systemType` with a registered adapter, including Redmine. The same reusable picker SHALL also be available inline on the Remote Sync page for a listed Task that resolves to a usable configuration but has no `RemoteIssueRef`; a successful link from that page SHALL update the row in place without a full page reload.

#### Scenario: Link from a Timer Task row
- **WHEN** the user activates the link action on an eligible Timer Task group
- **THEN** a labeled Popover SHALL open and allow the user to choose a search mode, submit a query, and select a result by keyboard or pointer

#### Scenario: Linked Task displays cached data
- **WHEN** a Timer Task has a remote reference
- **THEN** its group row SHALL display `#<remoteIssueId>` as a direct link derived from the configured remote-system URL and issue ID, show the cached title in a tooltip on hover or focus, and display a separate pencil action for replacing or unlinking the reference

#### Scenario: Eligible Task is unlinked
- **WHEN** a Timer Task has an active remote-system configuration but no remote reference
- **THEN** its group row SHALL display translated `(unlinked)` status text followed by the pencil action

#### Scenario: Redmine search is available
- **WHEN** the Task's Client is configured for Redmine
- **THEN** the row SHALL display the same two-part control with an enabled pencil action, and the picker SHALL search Redmine issues via the configured execution mode

#### Scenario: Task cannot resolve a remote configuration
- **WHEN** a Task is project-less or its configuration is missing or deleted
- **THEN** the Timer row SHALL NOT display any part of the remote-issue control, even when a bare cached reference remains persisted

#### Scenario: Picker is keyboard accessible
- **WHEN** a keyboard user opens, searches, selects, or dismisses the picker
- **THEN** focus order, form controls, result announcements, selection, and dismissal SHALL remain operable without a pointer

#### Scenario: Link inline from the Remote Sync page
- **WHEN** the user activates the inline link action on an unlinked Remote Sync row whose configuration is usable
- **THEN** the same picker Popover SHALL open, and a successful selection SHALL persist the reference and flip that row to the manageable state in place
