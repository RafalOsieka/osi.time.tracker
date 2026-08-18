## MODIFIED Requirements

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
