# remote-issue-linking Specification

## Purpose

Define how a Task is linked to a single remote issue: searching the configured
tracker (by title phrase or exact issue ID) under either execution mode, storing
at most one adapter-neutral issue reference per Task, deriving its issue URL,
unlinking locally, and presenting the reusable Timer-view issue picker. All rules
are user-scoped and adapter-neutral.
## Requirements
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
For an owned Task whose Project has an active tracker and registered adapter, the system SHALL search through `client` or `extension` according to `executionMode`. `client` SHALL query the configured tracker origin directly with the browser-held secret; `extension` SHALL execute through the approved desktop extension. Neither mode SHALL transmit the secret to an OSI API. Existing validation, bounded title search, exact-ID lookup, stale-response suppression, neutral results, and translated error behavior remain unchanged.

#### Scenario: Client execution-mode title search returns matching issues
- **WHEN** a user submits valid search input under `client`
- **THEN** the browser SHALL query the configured tracker origin and render neutral results

#### Scenario: Server execution-mode title search returns matching issues
- **WHEN** a stale client submits a search for a `server` tracker
- **THEN** the unsupported mode SHALL be rejected without contacting the tracker

#### Scenario: Exact issue-ID search returns an issue
- **WHEN** a valid exact-ID search runs through `client` or `extension`
- **THEN** the matching issue SHALL be shown regardless of status

#### Scenario: Search result includes remote project title
- **WHEN** the provider supplies a usable project title
- **THEN** the neutral result SHALL include it without a project id

#### Scenario: Search result omits a missing remote project title
- **WHEN** the provider omits a usable project title
- **THEN** the issue id and title SHALL remain selectable

#### Scenario: Extension search bypasses CORS
- **WHEN** a desktop user submits valid search input under `extension`
- **THEN** the approved extension SHALL perform the tracker request without routing it through OSI

#### Scenario: Mobile extension mode is unavailable
- **WHEN** a mobile browser encounters a tracker configured for `extension`
- **THEN** remote search SHALL expose an actionable extension-unavailable state and SHALL NOT fall back to another mode

#### Scenario: Invalid search input does not call the tracker
- **WHEN** title input is too short or an issue ID is invalid
- **THEN** the picker SHALL show translated validation and make no remote request

#### Scenario: New search supersedes an older response
- **WHEN** an older request completes after a newer search
- **THEN** only the newer result SHALL be displayed

#### Scenario: Client execution-mode credential remains browser-only
- **WHEN** client search runs
- **THEN** the secret SHALL travel only to the configured tracker origin

#### Scenario: Server execution-mode credential is forwarded but not persisted
- **WHEN** a stale caller requests server search
- **THEN** validation SHALL reject it and SHALL NOT forward the credential

#### Scenario: Remote search fails
- **WHEN** a supported mode encounters authentication, CORS, connection, or extension failure
- **THEN** the picker SHALL expose a translated accessible error without changing the reference

