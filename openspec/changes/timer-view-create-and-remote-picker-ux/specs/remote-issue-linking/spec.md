## MODIFIED Requirements

### Requirement: REQ-104 Persist one remote issue reference per Task
The system SHALL store at most one remote issue reference per Task, held **inline on the task row** (REQ-237): the owning user, remote-system configuration provenance, remote issue ID as nullable text, cached issue title, optional cached remote project **title**, and timestamps. A Task with a null remote issue ID SHALL be unlinked. It SHALL NOT store a remote issue URL. It SHALL NOT store a remote project id or any other remote-project identifier. For an active matching configuration, the system SHALL derive the issue URL from its normalized base URL and remote issue ID using the URL pattern of the configuration's `systemType` (e.g. OpenProject work-package URLs, Redmine issue URLs), resolved through a per-provider abstraction rather than conditional branching.

Because the remote issue ID is part of Task identity (REQ-136), "linking" SHALL NOT mutate an existing Task's reference. A reference SHALL be established only by resolving or creating the Task that carries it, and time entries SHALL be moved to that Task by the day-scoped reassignment operation (REQ-179). Two Tasks with the same user, project and name but different remote issues SHALL coexist.

When a newly linked Task is created, the system SHALL persist the remote project title supplied with the search result when that title is a non-empty string, and SHALL persist no remote project title when the result omitted it. An existing linked Task that has no cached remote project title SHALL remain valid. The nested `remoteIssueRef` boundary shape SHALL expose the cached remote project title when present and omit it when absent.

#### Scenario: Link an issue
- **WHEN** an authenticated user selects an issue for the Task of a given day's entries
- **THEN** the system SHALL find or create the Task carrying that configuration provenance and remote issue ID with the same name and project, move that day's entries to it, and return the resulting reference

#### Scenario: Link persists the remote project title
- **WHEN** the user selects a search result that includes a remote project title
- **THEN** the created or resolved Task's reference SHALL include that cached remote project title and SHALL NOT store a remote project id

#### Scenario: Link succeeds without a remote project title
- **WHEN** the user selects a search result that has a remote issue ID and title but no remote project title
- **THEN** the system SHALL persist the reference with no cached remote project title and SHALL NOT reject the link

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
- **THEN** the system SHALL return its cached ID, cached issue title, and cached remote project title when present, without a generated URL or remote-search capability

### Requirement: REQ-107 Timer view remote issue picker
For each Task whose Project resolves to an active tracker, the Timer view SHALL display a compact two-part remote-issue control. For a linked Task, the first part SHALL be a `#<remoteIssueId>` link to the remote issue, with its URL derived from the tracker and issue ID and a tooltip containing the cached issue title and, when present, the cached remote project title. For an unlinked Task, the first part SHALL be a compact status icon whose accessible name and tooltip are the localized unlinked phrase; that phrase SHALL NOT appear as visible text. For a linked Task, hover or focus of that identifier SHALL reveal a dropdown with two actions, in this order: Edit (pencil icon plus the localized Edit label) and Unlink (localized Unlink label). Activating Edit, or the unlinked status icon, SHALL open a reusable search-and-attach `Popover`. Activating Unlink SHALL immediately perform the day-scoped unlink (REQ-105) with no confirmation dialog and SHALL NOT open the popover. The popover SHALL NOT contain an unlink action.

The popover SHALL open with **issue-ID** search selected, issue-ID listed first in the mode control, and keyboard focus on the query input. The query input SHALL be the primary control; the mode control SHALL be compact; Enter in the query input SHALL submit the search. Empty and error status SHALL appear only after a submit; the picker SHALL NOT show an empty-results phrase before the first search of that open. Each selectable result SHALL show the issue title on the first line and `#<remoteIssueId>` plus the remote project title when present on the second line. The result's accessible name SHALL include the issue id, title, and remote project title when present.

The picker SHALL expose translated validation, loading, empty, error, link, and replace states and SHALL meet WCAG 2.1 AA keyboard, labeling, focus, and status-announcement requirements. The issue link or status, dropdown actions, and other Task-row interactive controls SHALL remain siblings; interactive controls SHALL NOT be nested. When a Task cannot resolve a tracker (no project, local project, or missing tracker), the same slot SHALL still show a disabled compact unlinked-status icon so the group header layout stays aligned; that control SHALL NOT open the picker. The picker SHALL be enabled for every supported `systemType` with a registered adapter, including Redmine.

Committing a selection (link, replace or unlink) SHALL be **day-scoped**: the client SHALL send exactly the entry ids of that day's task group to the day-scoped reassignment operation (REQ-179) with the chosen remote issue (or an explicit null to unlink). It SHALL NOT mutate the underlying Task's reference, so the same Task's entries on other days SHALL be unaffected, and the group SHALL show the new reference for that day only. On success the page SHALL update the affected groups (including regrouping when entries move to another Task) and refresh the running-timer state.

The same reusable picker SHALL also be available inline on the Remote Sync page for a listed Task that resolves to a usable tracker but has no remote issue; because that page is scoped to a single local date, a successful link SHALL likewise reassign that date's entries for the row and SHALL update the row in place without a full page reload. The Remote Sync inline picker SHALL NOT gain an unlink control.

#### Scenario: Link from a Timer Task row
- **WHEN** the user activates the link action on an eligible Timer Task group
- **THEN** a labeled Popover SHALL open on issue-ID search with focus in the query input, and SHALL allow the user to switch mode, submit a query, and select a result by keyboard or pointer

#### Scenario: Picker defaults to issue-ID search
- **WHEN** the picker popover opens
- **THEN** issue-ID mode SHALL be selected, SHALL appear first in the mode control, and the query input SHALL have keyboard focus

#### Scenario: Result shows remote project title
- **WHEN** a search returns an issue that includes a remote project title
- **THEN** that result SHALL display the issue title, the `#<id>`, and the remote project title

#### Scenario: Result without a remote project title still selectable
- **WHEN** a search returns an issue with no remote project title
- **THEN** the result SHALL still be selectable and SHALL display the issue title and `#<id>` without a project line required

#### Scenario: Linking is day-scoped
- **WHEN** the user links a remote issue on a task group of one day while the same Task also has entries on other days
- **THEN** only that day's entries SHALL move to the Task carrying the issue, and the other days' groups SHALL keep their previous reference

#### Scenario: Unlink is in the linked dropdown
- **WHEN** a linked Task's identifier is hovered or focused
- **THEN** the dropdown SHALL show Edit and then Unlink, and the popover SHALL NOT contain an unlink action

#### Scenario: Unlink is instant
- **WHEN** the user activates Unlink in the linked dropdown
- **THEN** the system SHALL perform the day-scoped unlink immediately without a confirmation dialog and SHALL NOT open the picker

#### Scenario: Unlinking is day-scoped
- **WHEN** the user unlinks a remote issue on one day's task group
- **THEN** only that day's entries SHALL move to the unlinked Task and the other days SHALL keep their reference

#### Scenario: Linked Task displays cached data
- **WHEN** a Timer Task has a remote reference
- **THEN** its group row SHALL display `#<remoteIssueId>` as a direct link derived from the configured tracker URL and issue ID, show the cached issue title (and cached remote project title when present) in a tooltip on hover or focus, and reveal a dropdown with Edit then Unlink below or above the identifier

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

#### Scenario: Empty state waits for a search
- **WHEN** the picker opens and the user has not submitted a query
- **THEN** the picker SHALL NOT announce an empty-results phrase

#### Scenario: Link inline from the Remote Sync page
- **WHEN** the user activates the inline link action on an unlinked Remote Sync row whose tracker is usable
- **THEN** the same picker Popover SHALL open, and a successful selection SHALL reassign that date's entries for the row and flip it to the manageable state in place

### Requirement: REQ-103 Search the configured tracker by execution mode
For an owned Task whose Project has an active tracker with a registered adapter, the system SHALL search that tracker's issues via the neutral remote-tracker adapter contract (`remote-adapter-contract` REQ-200) using the execution mode selected by the tracker's `executionMode`. When `executionMode` is `client`, the browser SHALL query the configured tracker origin directly using the browser-held credential, and the credential SHALL NOT be transmitted to or persisted by the OSI server. When `executionMode` is `server`, the browser SHALL send the search and the per-request credential to the OSI server, which SHALL forward the request to the tracker and return the result; the OSI server SHALL NOT persist the credential. The picker SHALL default to issue-ID search and SHALL let the user switch to title-phrase search. The user SHALL enter a query and submit it. Title search SHALL require at least three trimmed characters, match issue titles, and return a fixed bounded result set. Issue-ID search SHALL require a non-empty valid remote issue ID and perform an exact lookup without applying the title minimum length. Both modes SHALL include open and closed issues, return the same adapter-neutral issue shape containing remote issue ID, title, and optional remote project title (never a remote project id), and SHALL behave identically with respect to provider quirks and error classification (`remote-adapter-contract` REQ-201). A result whose tracker payload has no usable project title SHALL still be returned with remote issue ID and title.

#### Scenario: Client execution-mode title search returns matching issues
- **WHEN** the user selects title search, enters at least three trimmed characters, and submits the search for an eligible Task under a `client` tracker
- **THEN** the browser SHALL query the configured tracker origin directly and show a bounded set of matching issues regardless of status

#### Scenario: Server execution-mode title search returns matching issues
- **WHEN** the user submits a valid title search for an eligible Task under a `server` tracker
- **THEN** the browser SHALL send the search to the OSI server, which forwards it to the tracker, and the picker SHALL show a bounded set of matching issues regardless of status

#### Scenario: Exact issue-ID search returns an issue
- **WHEN** the user selects issue-ID search, enters a valid remote issue ID, and submits the search under either execution mode
- **THEN** the system SHALL retrieve that exact issue via the configured execution mode and SHALL show it as a selectable result regardless of status

#### Scenario: Search result includes remote project title
- **WHEN** a title search or issue-ID lookup returns an issue whose tracker payload includes a project title
- **THEN** the adapter-neutral result SHALL include that remote project title and SHALL NOT include a remote project id

#### Scenario: Search result omits a missing remote project title
- **WHEN** a title search or issue-ID lookup returns an otherwise valid issue whose tracker payload has no usable project title
- **THEN** the adapter-neutral result SHALL still include remote issue ID and title and SHALL omit the remote project title

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
