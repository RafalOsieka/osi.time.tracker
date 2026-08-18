# remote-issue-linking Specification

## Purpose

Define how a Task is linked to a single remote issue: searching the configured
tracker (by title phrase or exact issue ID) under either execution mode, storing
at most one adapter-neutral issue reference per Task, deriving its issue URL,
unlinking locally, and presenting the reusable Timer-view issue picker. All rules
are user-scoped and adapter-neutral.
## Requirements
### Requirement: REQ-104 Persist one remote issue reference per Task
The system SHALL store at most one remote issue reference per Task, held **inline on the task row** (REQ-237): the owning user, remote-system configuration provenance, remote issue ID as nullable text, cached title, and timestamps. A Task with a null remote issue ID SHALL be unlinked. It SHALL NOT store a remote issue URL. For an active matching configuration, the system SHALL derive the issue URL from its normalized base URL and remote issue ID using the URL pattern of the configuration's `systemType` (e.g. OpenProject work-package URLs, Redmine issue URLs), resolved through a per-provider abstraction rather than conditional branching.

Because the remote issue ID is part of Task identity (REQ-136), "linking" SHALL NOT mutate an existing Task's reference. A reference SHALL be established only by resolving or creating the Task that carries it, and time entries SHALL be moved to that Task by the day-scoped reassignment operation (REQ-179). Two Tasks with the same user, project and name but different remote issues SHALL coexist.

#### Scenario: Link an issue
- **WHEN** an authenticated user selects an issue for the Task of a given day's entries
- **THEN** the system SHALL find or create the Task carrying that configuration provenance and remote issue ID with the same name and project, move that day's entries to it, and return the resulting reference

#### Scenario: Replace an existing link
- **WHEN** the user selects a different issue for a day whose entries are on a linked Task
- **THEN** the system SHALL move that day's entries to the Task carrying the new issue so each Task still has exactly one reference, and SHALL leave other days' entries on the original Task

#### Scenario: Two tasks share a name but differ by issue
- **WHEN** the user links one day's `title1` entries in project A to issue `4711` and another day's `title1` entries in project A to issue `4899`
- **THEN** both Tasks SHALL exist, each with its own reference, and neither SHALL overwrite the other

#### Scenario: Derive a usable issue URL
- **WHEN** a reference's originating configuration is active and available
- **THEN** the system SHALL derive a direct issue URL from the current base URL and encoded remote issue ID using the configuration's provider URL pattern

#### Scenario: Reference has no usable configuration
- **WHEN** the reference's configuration is not active or available
- **THEN** the system SHALL return its cached ID and title without a generated URL or remote-search capability

### Requirement: REQ-105 Unlink a remote issue locally
An authenticated user SHALL be able to unlink the remote issue from their own work without touching the remote tracker. Unlinking SHALL be expressed as a **day-scoped move**: the listed entries SHALL be reassigned (REQ-179, explicit null remote issue) to the find-or-create Task with the same name and project and no remote issue, and the source Task SHALL be garbage-collected when it is left with no entries. Unlinking SHALL NOT call, update, or delete any remote issue, and SHALL NOT affect the same Task's entries on other days. The task-global endpoints `POST /api/tasks/[id]/remote-issue-ref` and `DELETE /api/tasks/[id]/remote-issue-ref` SHALL be removed.

#### Scenario: Unlink one day's entries
- **WHEN** the user unlinks the remote issue for a day's task group
- **THEN** that day's entries SHALL move to the unlinked Task of the same name and project, the remote tracker SHALL be unchanged, and the same Task's entries on other days SHALL keep their reference

#### Scenario: Unlink an already unlinked group
- **WHEN** the user requests unlinking for entries already on an unlinked Task
- **THEN** the operation SHALL succeed idempotently and the entries SHALL remain on that Task

#### Scenario: Emptied source task is garbage-collected
- **WHEN** unlinking moves the source Task's last remaining entries away
- **THEN** the emptied source Task SHALL be hard-deleted in the same transaction

#### Scenario: Task-global reference endpoints are gone
- **WHEN** a client calls `POST` or `DELETE` on `/api/tasks/[id]/remote-issue-ref`
- **THEN** the system SHALL respond with HTTP 404 or 405 (route absent)

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
For each Task whose Project resolves to an active tracker, the Timer view SHALL display a compact two-part remote-issue control. For a linked Task, the first part SHALL be a `#<remoteIssueId>` link to the remote issue, with its URL derived from the tracker and issue ID and a tooltip containing the cached issue title. For an unlinked Task, the first part SHALL be a compact status icon whose accessible name and tooltip are the localized unlinked phrase; that phrase SHALL NOT appear as visible text. For a linked Task, hover or focus of that identifier SHALL reveal a dropdown Edit action below or above it (pencil icon plus the localized Edit label). Activating that action, or the unlinked status icon, SHALL open a reusable `Popover` containing an explicit title/issue-ID mode control, query input, submit action, and selectable result list below the search form. The picker SHALL expose translated validation, loading, empty, error, link, replace, and unlink states and SHALL meet WCAG 2.1 AA keyboard, labeling, focus, and status-announcement requirements. The issue link or status, pencil action, and other Task-row interactive controls SHALL remain siblings; interactive controls SHALL NOT be nested. When a Task cannot resolve a tracker (no project, local project, or missing tracker), the same slot SHALL still show a disabled compact unlinked-status icon so the group header layout stays aligned; that control SHALL NOT open the picker. The picker SHALL be enabled for every supported `systemType` with a registered adapter, including Redmine.

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
- **THEN** its group row SHALL display `#<remoteIssueId>` as a direct link derived from the configured tracker URL and issue ID, show the cached title in a tooltip on hover or focus, and reveal a dropdown Edit action (pencil icon plus the localized Edit label) below or above the identifier for replacing or unlinking the reference

#### Scenario: Eligible Task is unlinked
- **WHEN** a Timer Task has an active tracker but no remote reference
- **THEN** its group row SHALL display a compact unlinked status icon whose accessible name and tooltip are a localized sentence that the task is not linked, and SHALL NOT display that sentence as visible text

#### Scenario: Unlinked icon and one-digit id share a slot
- **WHEN** one group is unlinked and another shows `#<single digit>`
- **THEN** both remote-issue controls SHALL occupy the same reserved width so the columns align

#### Scenario: Redmine search is available
- **WHEN** the Task's Project is attached to a Redmine tracker
- **THEN** the row SHALL display the same compact control with an enabled picker action, and the picker SHALL search Redmine issues via the configured execution mode

#### Scenario: Task cannot resolve a tracker
- **WHEN** a Task is project-less, its project is local, or its tracker is missing or deleted
- **THEN** the Timer row SHALL display a disabled compact unlinked-status icon in the same slot, whose accessible name and tooltip explain that a remote issue cannot be linked, and SHALL NOT open the picker

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

