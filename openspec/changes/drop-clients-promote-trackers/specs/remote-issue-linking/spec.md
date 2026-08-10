## MODIFIED Requirements

### Requirement: REQ-106 Remote issue linking is user-scoped and validated
All local link and unlink operations SHALL require authentication, enforce CSRF protection for mutations, validate request bodies through shared boundary schemas, and scope Task and time-entry lookup to the authenticated user. Linking SHALL derive the active tracker from the owned source Task's Project (`project.trackerId` pointing at a non-deleted tracker) and SHALL reject project-less Tasks, local projects (null tracker), missing or soft-deleted trackers, foreign Tasks, unknown Tasks, and foreign or unknown time-entry ids without trusting client-supplied ownership or tracker identifiers. Any active tracker whose `systemType` has a registered adapter (OpenProject, Redmine) SHALL be eligible for linking. Because linking is performed by the day-scoped reassignment operation (REQ-179), these validations SHALL be enforced by that endpoint, and a rejected request SHALL leave every listed entry and Task unchanged.

#### Scenario: Link an eligible owned Task
- **WHEN** an authenticated user submits a valid issue selection for a day's entries of their own Task under a Project with an active supported tracker (OpenProject or Redmine)
- **THEN** the system SHALL link it using the server-derived tracker provenance

#### Scenario: Ineligible Task is rejected
- **WHEN** the source Task is project-less, its project has no tracker, or its tracker is missing/soft-deleted
- **THEN** the system SHALL reject linking with a translated `{ messageKey, params }` error, persist nothing, and move no entry

#### Scenario: Foreign or unknown Task or entry is concealed
- **WHEN** a user attempts to link or unlink using a foreign or unknown Task id or time-entry id
- **THEN** the system SHALL respond with HTTP 404 without revealing whether it exists

#### Scenario: Missing authentication or CSRF is rejected
- **WHEN** a local mutation lacks a valid session or CSRF token
- **THEN** the system SHALL reject it and SHALL persist nothing

### Requirement: REQ-107 Timer view remote issue picker
For each Task whose Project resolves to an active tracker, the Timer view SHALL display a compact two-part remote-issue control. For a linked Task, the first part SHALL be a `#<remoteIssueId>` link to the remote issue, with its URL derived from the tracker and issue ID and a tooltip containing the cached issue title. For an unlinked Task, the first part SHALL instead display translated `(unlinked)` status text. The second part SHALL be a separately labeled pencil-icon `Button` that opens a reusable `Popover` containing an explicit title/issue-ID mode control, query input, submit action, and selectable result list below the search form. The picker SHALL expose translated validation, loading, empty, error, link, replace, and unlink states and SHALL meet WCAG 2.1 AA keyboard, labeling, focus, and status-announcement requirements. The issue link or status, pencil action, and other Task-row interactive controls SHALL remain siblings; interactive controls SHALL NOT be nested. The picker SHALL be enabled for every supported `systemType` with a registered adapter, including Redmine.

Committing a selection (link, replace or unlink) SHALL be **day-scoped**: the client SHALL send exactly the entry ids of that day's task group to the day-scoped reassignment operation (REQ-179) with the chosen remote issue (or an explicit null to unlink). It SHALL NOT mutate the underlying Task's reference, so the same Task's entries on other days SHALL be unaffected, and the group SHALL show the new reference for that day only. On success the page SHALL update the affected groups (including regrouping when entries move to another Task) and refresh the running-timer state.

The same reusable picker SHALL also be available inline on the Remote Sync page for a listed Task that resolves to a usable tracker but has no remote issue; because that page is scoped to a single local date, a successful link SHALL likewise reassign that date's entries for the row and SHALL update the row in place without a full page reload.

#### Scenario: Link from a Timer Task row
- **WHEN** the user activates the link action on an eligible Timer Task group
- **THEN** a labeled Popover SHALL open and allow the user to choose a search mode, submit a query, and select a result by keyboard or pointer

#### Scenario: Linking is day-scoped
- **WHEN** the user links a remote issue on a task group of one day while the same Task also has entries on other days
- **THEN** only that day's entries SHALL move to the Task carrying the issue, and the other days' groups SHALL keep their previous reference

#### Scenario: Unlinking is day-scoped
- **WHEN** the user unlinks a remote issue on one day's task group
- **THEN** only that day's entries SHALL move to the unlinked Task and the other days SHALL keep their reference

#### Scenario: Linked Task displays cached data
- **WHEN** a Timer Task has a remote reference
- **THEN** its group row SHALL display `#<remoteIssueId>` as a direct link derived from the configured tracker URL and issue ID, show the cached title in a tooltip on hover or focus, and display a separate pencil action for replacing or unlinking the reference

#### Scenario: Eligible Task is unlinked
- **WHEN** a Timer Task has an active tracker but no remote reference
- **THEN** its group row SHALL display translated `(unlinked)` status text followed by the pencil action

#### Scenario: Redmine search is available
- **WHEN** the Task's Project is attached to a Redmine tracker
- **THEN** the row SHALL display the same two-part control with an enabled pencil action, and the picker SHALL search Redmine issues via the configured execution mode

#### Scenario: Task cannot resolve a tracker
- **WHEN** a Task is project-less, its project is local, or its tracker is missing or deleted
- **THEN** the Timer row SHALL NOT display any part of the remote-issue control, even when a bare cached reference remains persisted

#### Scenario: Picker is keyboard accessible
- **WHEN** a keyboard user opens, searches, selects, or dismisses the picker
- **THEN** focus order, form controls, result announcements, selection, and dismissal SHALL remain operable without a pointer

#### Scenario: Link inline from the Remote Sync page
- **WHEN** the user activates the inline link action on an unlinked Remote Sync row whose tracker is usable
- **THEN** the same picker Popover SHALL open, and a successful selection SHALL reassign that date's entries for the row and flip it to the manageable state in place

### Requirement: REQ-103 Search the configured tracker by execution mode
For an owned Task whose Project has an active tracker with a registered adapter, the system SHALL search that tracker's issues via the neutral remote-tracker adapter contract (`remote-adapter-contract` REQ-200) using the execution mode selected by the tracker's `executionMode`. When `executionMode` is `client`, the browser SHALL query the configured tracker origin directly using the browser-held credential, and the credential SHALL NOT be transmitted to or persisted by the OSI server. When `executionMode` is `server`, the browser SHALL send the search and the per-request credential to the OSI server, which SHALL forward the request to the tracker and return the result; the OSI server SHALL NOT persist the credential. In both execution modes the user SHALL explicitly choose title-phrase or issue-ID search, enter a query, and submit it. Title search SHALL require at least three trimmed characters, match issue titles, and return a fixed bounded result set. Issue-ID search SHALL require a non-empty valid remote issue ID and perform an exact lookup without applying the title minimum length. Both modes SHALL include open and closed issues, return the same adapter-neutral issue shape containing remote issue ID and title, and SHALL behave identically with respect to provider quirks and error classification (`remote-adapter-contract` REQ-201).

#### Scenario: Client execution-mode title search returns matching issues
- **WHEN** the user selects title search, enters at least three trimmed characters, and submits the search for an eligible Task under a `client` tracker
- **THEN** the browser SHALL query the configured tracker origin directly and show a bounded set of matching issues regardless of status

#### Scenario: Server execution-mode title search returns matching issues
- **WHEN** the user submits a valid title search for an eligible Task under a `server` tracker
- **THEN** the browser SHALL send the search to the OSI server, which forwards it to the tracker, and the picker SHALL show a bounded set of matching issues regardless of status

#### Scenario: Exact issue-ID search returns an issue
- **WHEN** the user selects issue-ID search, enters a valid remote issue ID, and submits the search under either execution mode
- **THEN** the system SHALL retrieve that exact issue via the configured execution mode and SHALL show it as a selectable result regardless of status

#### Scenario: Invalid search input does not call the tracker
- **WHEN** the user submits a title shorter than three trimmed characters or an empty or invalid issue ID
- **THEN** the picker SHALL show a translated validation message and SHALL NOT send a remote request in either execution mode

#### Scenario: New search supersedes an older response
- **WHEN** an earlier remote request finishes after a newer search has been submitted
- **THEN** the system SHALL ignore or cancel the stale response and SHALL display only results for the latest query

#### Scenario: Client execution-mode credential remains browser-only
- **WHEN** the browser searches the tracker under a `client` configuration
- **THEN** the credential SHALL be sent only to the configured tracker origin and SHALL NOT appear in any OSI API request, response, or persisted record

#### Scenario: Server execution-mode credential is forwarded but not persisted
- **WHEN** the browser searches the tracker under a `server` configuration
- **THEN** the credential SHALL be sent to the OSI server only for immediate upstream forwarding and SHALL NOT be persisted, logged, or returned by the server

#### Scenario: Remote search fails
- **WHEN** the tracker rejects the credential, CORS blocks a client-mode request, or a client- or server-mode request otherwise fails
- **THEN** the picker SHALL expose a translated accessible error state without changing the Task's existing reference
