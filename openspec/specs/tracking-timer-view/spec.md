# tracking-timer-view Specification

## Purpose
Define the timer view, the home page at `/`: entries grouped by day and task from the timer-view feed, loading more history, adding and editing entries, continuing a task, editing a day's task in place (name, project, remote issue), and the row layout and accessibility rules. The endpoints it calls are in `tracking-api`; the remote-issue picker's server-side rules are in `remote-issue-linking`.

## Requirements

### Requirement: REQ-152 Continue a task from the timer view
Each task group SHALL offer continue: a new running entry bound to the group's **task identity**, not its name, so it keeps the task's project and remote issue (REQ-137), stopping any running entry (REQ-141). The "(no task)" group SHALL offer the same continue/stop control (starting an untitled entry), a title editor that reassigns that day's untitled entries (REQ-179), a project control disabled until a title exists, no remote-issue control, and no bulk-assign button.

#### Scenario: Continue starts a timer for the task
- **WHEN** the user activates continue on a task group
- **THEN** a new running entry SHALL be started bound to that group's task, stopping any currently running entry first

#### Scenario: Continue inherits the remote issue
- **WHEN** the user continues a task group that is linked to a remote issue
- **THEN** the new running entry SHALL be bound to that same linked task and SHALL show the same remote issue

#### Scenario: Continue is unambiguous under duplicate names
- **WHEN** the continued task shares its name and project with another task carrying a different remote issue
- **THEN** the new entry SHALL bind to the continued task and SHALL NOT be re-resolved to the other one

#### Scenario: Running entry reflected in the shell
- **WHEN** a continue action succeeds
- **THEN** the shell timer widget SHALL show the new running entry's title and live elapsed time

#### Scenario: Titling the "(no task)" group assigns the day's untitled entries
- **WHEN** the user commits a title on a day's "(no task)" group
- **THEN** all of that day's untitled entries SHALL be reassigned via the day-scoped reassignment operation and the page SHALL regroup them under the resolved task

#### Scenario: No task group has no remote issue editor
- **WHEN** the "(no task)" group is rendered
- **THEN** it SHALL offer the inline title editor, SHALL keep the project control disabled with an accessible name explaining that a title is required first, and SHALL NOT offer a remote issue control

#### Scenario: Untitled group uses the same chrome as a named group
- **WHEN** a day's untitled entries are grouped
- **THEN** the group SHALL show the same title, project, and continue/stop controls as a named group and SHALL NOT offer a separate bulk-assign button

#### Scenario: Untitled title assign is day-scoped reassign
- **WHEN** the user commits a title on the untitled group
- **THEN** that day's untitled entry ids SHALL be sent to the day-scoped reassignment operation with the new name

#### Scenario: Project assign is disabled without a title
- **WHEN** a group has no task name
- **THEN** the project control SHALL be disabled and its accessible name SHALL explain that a title is required first

### Requirement: REQ-153 Mini task editor on the timer view
Each task group SHALL let the user edit its task name, project and remote issue in the header. Every such edit SHALL be **day-scoped**: it sends that day's entry ids to the reassignment (REQ-179), moving them to the find-or-create target, and SHALL never rename, re-project or re-link the task itself, so other days keep it; a task's only day MAY leave it garbage-collected. On success the page SHALL update and regroup the affected groups and refresh the running state.

#### Scenario: Inline rename is day-scoped
- **WHEN** the user activates the group title, types a new name, and commits (blur or Enter)
- **THEN** only that day's entries SHALL move to the find-or-create target task via the day-scoped reassignment, and the same task's entries on other days SHALL keep the old name

#### Scenario: Rename onto an existing task merges that day's entries
- **WHEN** the user renames a day's group so it matches another existing task with the same remote issue state
- **THEN** that day's entries SHALL move into the existing task's group and the page SHALL show them under the survivor for that day

#### Scenario: Remote issue change is day-scoped
- **WHEN** the user links, replaces or unlinks the remote issue on a day's group while the same task has entries on other days
- **THEN** only that day's entries SHALL move to the find-or-create target task and the other days' groups SHALL keep their previous remote issue

#### Scenario: No task-global mutation from the timer view
- **WHEN** any group-level edit (title, project, or remote issue) is committed
- **THEN** the request SHALL be the day-scoped reassignment and the page SHALL make no call that mutates a task row directly

### Requirement: REQ-462 Group title and project editors
The group title SHALL be activatable and swap to a text input that commits on blur or Enter and cancels on Escape; an empty or whitespace-only name SHALL silently revert without a request. The project context, or a localized "(no project)" placeholder, SHALL swap to a project select with a clear option, labelled by project name only and listing the current project even when soft-deleted. Choosing an option, including clearing, SHALL commit; dismissing SHALL change nothing.

#### Scenario: Empty name silently reverts
- **WHEN** the user commits an empty or whitespace-only name in the inline title editor
- **THEN** the title SHALL revert to the previous name and no request SHALL be sent

#### Scenario: Escape cancels the inline edit
- **WHEN** the user presses Escape while editing the group title, choosing a project, or picking a remote issue
- **THEN** the edit SHALL be discarded and no request SHALL be sent

#### Scenario: Project changed inline is day-scoped
- **WHEN** the user activates the group's project context and selects a different project (or clears it)
- **THEN** only that day's entries SHALL be reassigned to the target task in the chosen project scope and the group SHALL show the updated context for that day

#### Scenario: Missing project shows a clickable placeholder
- **WHEN** a task group has no project assigned
- **THEN** the group SHALL render a localized "(no project)" placeholder that the user can activate to assign a project inline

#### Scenario: Soft-deleted project retained in the select
- **WHEN** the task's current project has been soft-deleted
- **THEN** the project select SHALL still list it as the current option

### Requirement: REQ-463 One inline editor at a time
At most one inline editor — group title, group project or remote issue picker, across all groups and days — SHALL be open. Opening one SHALL close any other without committing, returning it to its read-only display, and SHALL be ready after a single click: a text input focused, a project select with its list open.

#### Scenario: Project editor opens on a single click
- **WHEN** the user activates the group's project context (or the "(no project)" placeholder)
- **THEN** the project select SHALL render with its option list already open, without requiring a second click

#### Scenario: Activating one editor cancels another
- **WHEN** an inline editor is active in one group and the user activates a title, project or remote issue editor elsewhere (in the same or a different group)
- **THEN** the previously active editor SHALL close without committing, its control SHALL return to the read-only display, and the newly opened editor SHALL receive focus

### Requirement: REQ-154 Accessible, localized, tokenized timer view
The timer view SHALL meet WCAG 2.1 AA: semantic headings or landmarks for days and groups; keyboard-operable expand controls exposing their state; labelled actions; named, keyboard-operable inline editors cancellable with Escape. A group header SHALL keep its expand control and edit triggers as siblings, never nested. Colors SHALL come from theme tokens, dates and durations follow the locale, strings have `en`/`pl` parity, and API failures show a translated Toast.

#### Scenario: Group toggle is accessible
- **WHEN** a task group's expand control is rendered
- **THEN** it SHALL be keyboard operable and expose its expanded/collapsed state to assistive technology

#### Scenario: No nested interactive controls in the group header
- **WHEN** a group header renders the expand control together with the inline title/project edit triggers
- **THEN** the controls SHALL be rendered as siblings inside a non-interactive container, with no button or input nested inside another interactive element

#### Scenario: Inline group editors are accessible
- **WHEN** a task group's title and project context are rendered
- **THEN** they SHALL be activatable buttons with accessible names, and the swapped-in input/select SHALL be labelled, keyboard operable, and cancellable with Escape

#### Scenario: Strings localized in parity
- **WHEN** new user-facing timer-view strings are added
- **THEN** they SHALL exist in both `en.json` and `pl.json` with matching keys

#### Scenario: API failure surfaced
- **WHEN** a timer-view action fails with an API error
- **THEN** the client SHALL show a Toast translated from the returned `messageKey`

### Requirement: REQ-265 Timer view group and entry row density
Group and entry text SHALL sit in stable layout slots. A task name, project context (including "(no project)") or entry title too long for its slot SHALL be truncated with an ellipsis, the full text shown as a tooltip on hover and focus and kept as the accessible name; text that fits SHALL have no tooltip. Activating a truncated title SHALL edit the full value. Activating or typing in a title, project or time editor SHALL NOT resize its slot or shift neighbors.

#### Scenario: Long task name truncates with a full-name tooltip
- **WHEN** a task group's name is longer than the title slot
- **THEN** the visible title SHALL end with an ellipsis, and hover or keyboard focus SHALL expose the complete name

#### Scenario: Fitting task name has no tooltip
- **WHEN** a task group's name fits entirely in the title slot
- **THEN** the group SHALL NOT show a title tooltip

#### Scenario: Long project context truncates
- **WHEN** a group's project name or "(no project)" placeholder is longer than the project slot
- **THEN** the visible project text SHALL be truncated and the complete string SHALL be available on hover or focus

#### Scenario: Long entry title truncates
- **WHEN** an expanded entry's title is longer than its title slot
- **THEN** the visible title SHALL be truncated and the complete string SHALL be available on hover or focus

#### Scenario: Activating a truncated title shows the full value
- **WHEN** the user activates a truncated group or entry title
- **THEN** the editor SHALL contain the complete current value

#### Scenario: Activating an editor does not jump the layout
- **WHEN** the user activates a group title, group project, or entry title control, or focuses a segment of an entry's time field
- **THEN** the reserved width of that control SHALL stay the same and neighboring controls SHALL NOT shift

#### Scenario: Typing does not resize the slot
- **WHEN** the user types a longer or shorter value in an active title, project, or time editor
- **THEN** the reserved slot and surrounding row SHALL NOT grow or shrink with the typed text

### Requirement: REQ-458 Entry-count indicator
Each group SHALL show its entry count as a compact, fixed-width numeric indicator immediately left of the title, even for one entry: the integer for 1–9 and `9+` above nine. Its accessible name SHALL be the localized count phrase with the actual count; that phrase need not be visible.

#### Scenario: Entry count is a numeric indicator
- **WHEN** a group contains two or more entries and at most nine
- **THEN** the header SHALL show a compact numeric indicator to the left of the title whose visible text is that integer and whose accessible name is the localized many-count phrase

#### Scenario: Single-entry group still shows the count indicator
- **WHEN** a group contains exactly one entry
- **THEN** the header SHALL still show the numeric indicator `1` to the left of the title with the localized singular count phrase as its accessible name

#### Scenario: Entry count above nine is capped
- **WHEN** a group contains more than nine entries
- **THEN** the indicator's visible text SHALL be `9+` and its accessible name SHALL still use the actual count

### Requirement: REQ-459 Durations and the entry time slot
Group, entry and day durations SHALL use the shell timer's monospace, tabular-figure style and SHALL NOT be activating controls. An expanded entry's start and stop SHALL be one permanently shown segmented time-range field (REQ-361) in a fixed-width slot showing full `HH:mm` values; a running entry SHALL show its start plus a localized "now" in a slot of the same width, so durations align. It SHALL edit the wall-clock time on the entry's existing local day only.

#### Scenario: Durations match the shell elapsed presentation
- **WHEN** a group total, entry duration, or day-heading total is rendered
- **THEN** it SHALL use the same monospace tabular-numeral presentation as the shell running-timer elapsed display and SHALL NOT be an activating control

#### Scenario: Inline time editor shows a full HH:mm
- **WHEN** an expanded entry row is rendered
- **THEN** its start–stop field SHALL show both complete `HH:mm` values without clipping and without requiring activation

#### Scenario: Running and stopped rows align
- **WHEN** a group lists a running entry alongside stopped entries
- **THEN** the running row's start field plus "now" label SHALL occupy the same slot width as a stopped row's range field, and the duration column SHALL align across the rows

#### Scenario: Inline time edit stays on the same local day
- **WHEN** the user commits a new start or stop time from the expanded row
- **THEN** the entry SHALL keep its previous local calendar day and only the wall-clock time SHALL change

### Requirement: REQ-107 Timer view remote issue picker
A task whose project has an active tracker SHALL show a compact remote-issue control in a fixed-width slot. Linked: a `#<remoteIssueId>` link, a tooltip with the cached issue and project titles, and on hover or focus an Edit then Unlink menu; Unlink SHALL act at once (REQ-105), no confirmation or popover. Unlinked: an icon whose name and tooltip say so, opening the picker. Without a usable tracker: a disabled icon explaining why. Every supported `systemType`, Redmine included, SHALL work.

#### Scenario: Linked Task displays cached data
- **WHEN** a Timer Task has a remote reference
- **THEN** its group row SHALL display `#<remoteIssueId>` as a direct link derived from the configured tracker URL and issue ID, show the cached issue title (and cached remote project title when present) in a tooltip on hover or focus, and reveal a dropdown with Edit then Unlink below or above the identifier

#### Scenario: Eligible Task is unlinked
- **WHEN** a Timer Task has an active tracker but no remote reference
- **THEN** its group row SHALL display a compact unlinked status icon whose accessible name and tooltip are a localized sentence that the task is not linked, and SHALL NOT display that sentence as visible text

#### Scenario: Unlinked icon and one-digit id share a slot
- **WHEN** one group is unlinked and another shows `#<single digit>`
- **THEN** both remote-issue controls SHALL occupy the same reserved width so the columns align

#### Scenario: Task cannot resolve a tracker
- **WHEN** a Task is project-less, its project is local, or its tracker is missing or deleted
- **THEN** the Timer row SHALL display a disabled compact unlinked-status icon in the same slot, whose accessible name and tooltip explain that a remote issue cannot be linked, and SHALL NOT open the picker

#### Scenario: Redmine search is available
- **WHEN** the Task's Project is attached to a Redmine tracker
- **THEN** the row SHALL display the same compact control with an enabled picker action, and the picker SHALL search Redmine issues via the configured execution mode

#### Scenario: Unlink is in the linked dropdown
- **WHEN** a linked Task's identifier is hovered or focused
- **THEN** the dropdown SHALL show Edit and then Unlink, and the popover SHALL NOT contain an unlink action

#### Scenario: Unlink is instant
- **WHEN** the user activates Unlink in the linked dropdown
- **THEN** the system SHALL perform the day-scoped unlink immediately without a confirmation dialog and SHALL NOT open the picker

### Requirement: REQ-460 Remote issue picker popover
Edit, or the unlinked icon, SHALL open a reusable search popover with issue-ID mode selected and listed first, focus in the query input, and Enter submitting. Empty and error states SHALL appear only after a submit. Each result SHALL show the issue title, then `#<id>` and the remote project title when present, all in its accessible name. It SHALL have no unlink action, SHALL translate its validation, loading, empty, error and link states, and SHALL meet WCAG 2.1 AA.

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

#### Scenario: Picker is keyboard accessible
- **WHEN** a keyboard user opens, searches, selects, or dismisses the picker
- **THEN** focus order, form controls, result announcements, selection, and dismissal SHALL remain operable without a pointer

#### Scenario: Empty state waits for a search
- **WHEN** the picker opens and the user has not submitted a query
- **THEN** the picker SHALL NOT announce an empty-results phrase

### Requirement: REQ-461 Picker selections are day-scoped
Linking, replacing or unlinking SHALL send exactly that day's group entry ids to the reassignment (REQ-179) with the chosen issue or an explicit null, never changing the task's reference, so other days keep theirs. On success the page SHALL update and regroup the affected groups and refresh the running state. The same picker SHALL link an unlinked, usable Remote Sync row inline, reassigning that date's entries and updating the row without a reload; there it SHALL offer no unlink.

#### Scenario: Linking is day-scoped
- **WHEN** the user links a remote issue on a task group of one day while the same Task also has entries on other days
- **THEN** only that day's entries SHALL move to the Task carrying the issue, and the other days' groups SHALL keep their previous reference

#### Scenario: Unlinking is day-scoped
- **WHEN** the user unlinks a remote issue on one day's task group
- **THEN** only that day's entries SHALL move to the unlinked Task and the other days SHALL keep their reference

#### Scenario: Link inline from the Remote Sync page
- **WHEN** the user activates the inline link action on an unlinked Remote Sync row whose tracker is usable
- **THEN** the same picker Popover SHALL open, and a successful selection SHALL reassign that date's entries for the row and flip it to the manageable state in place

### Requirement: REQ-396 Timer view page
The timer view at `/` SHALL group entries by the local day of `startedAt` in the user's timezone (REQ-398), newest first, skipping empty days, then by task. A group shows the task name with its project only, total and count, expanding into entries. A day shows its date, total and a Remote Sync link (`/sync/{dayKey}`), no add control. The first feed page SHALL render in SSR; client navigation shows a skeleton until it arrives (REQ-391). A timezone change SHALL regroup without refetching.

#### Scenario: Entries grouped by effective-timezone day and task
- **WHEN** the authenticated user opens `/` with entries on multiple days in the feed
- **THEN** the page SHALL show one section per day in the effective timezone, newest first, each with a day total and per-task groups showing name, project context only (when present), entry count, and group total

#### Scenario: Group label omits tracker and client
- **WHEN** a task group belongs to a project that has a tracker
- **THEN** the group label SHALL show the project name only and SHALL NOT append a client or tracker name

#### Scenario: Day list renders from the SSR-resolved feed
- **WHEN** the timer view is served with server-side rendering enabled
- **THEN** the initial feed payload SHALL be resolved during SSR and the day/group list (or never-tracked empty state) SHALL render from that payload on first paint

#### Scenario: Client navigation shows a skeleton, not the empty state
- **WHEN** the user navigates client-side to `/` and the feed response has not arrived yet
- **THEN** the page SHALL already be shown with a day-list loading skeleton and SHALL NOT show the never-tracked empty state, and SHALL replace the skeleton with the day list once the feed arrives

#### Scenario: Expanding a task group lists its entries
- **WHEN** the user expands a task group
- **THEN** the group SHALL list its individual entries with start/stop times and durations, each with inline edit and delete controls

#### Scenario: Untitled entries form the "(no task)" group
- **WHEN** a day contains entries with `taskId` `null`
- **THEN** those entries SHALL appear in a "(no task)" group for that day

#### Scenario: Timezone change regroups without refetch
- **WHEN** the user changes their timezone setting while entries are displayed
- **THEN** the page SHALL regroup the loaded entries under the day boundaries of the new timezone without requiring a reload

### Requirement: REQ-454 Initial content and load more
The first page SHALL show the newest seven activity days (REQ-452); a user with no entries SHALL see a never-tracked empty state whose action focuses the shell timer, without "load more". There SHALL be no "empty window" state, anchored-week banner or "back to this week" control. "Load more" SHALL show only while `hasMore` is true, fetch the next page with `nextBefore`, append up to seven older activity days, and stay a keyboard-reachable fallback to automatic loading (REQ-392).

#### Scenario: Old history opens on its newest activity days
- **WHEN** the user opens `/` and their newest entries are months old with nothing tracked since
- **THEN** the initial list SHALL show the newest seven local activity days of that history and SHALL NOT show a dedicated empty-window message whose only action is load more

#### Scenario: No anchored-week banner or reset control
- **WHEN** the initial list covers a period that does not include today
- **THEN** the page SHALL NOT show an anchored-week banner or reset-to-current-week control

#### Scenario: Initial list shows the newest seven activity days
- **WHEN** the user has entries on more than seven distinct local days
- **THEN** the initial list SHALL show exactly the newest seven of those days, SHALL NOT apply week-start alignment, and SHALL offer further history through load more

#### Scenario: Never-tracked user sees a start-tracking empty state
- **WHEN** the user has no time entries at all
- **THEN** the page SHALL render the never-tracked empty state whose CTA focuses the timer widget and SHALL NOT offer "load more"

#### Scenario: Load more pages further back
- **WHEN** the user activates "load more" while `hasMore` is true
- **THEN** the page SHALL append entries for up to seven older activity days; when a response reports `hasMore` false the control SHALL not be shown

### Requirement: REQ-455 Page-level manual entry dialog
The page header's primary action SHALL open a manual-entry dialog: an optional title with task autocomplete, a date defaulting to today, and a start–end pair in one segmented time-range field (REQ-361). Times SHALL convert to instants in that timezone and be sent as a manual pair (REQ-446). An end before the start, or an incomplete time, SHALL block submission with an inline error. A new entry on a day not yet loaded SHALL appear without "load more", keeping `hasMore` consistent.

#### Scenario: Add a manual entry to a day
- **WHEN** the user activates the page header add-entry action and submits a valid date, start/end pair, and optional title
- **THEN** a stopped entry SHALL be created for that date (times in the effective timezone) and appear under the matching day/task group

#### Scenario: Smart include outside loaded set
- **WHEN** the user creates a manual entry on a local day not currently present in the loaded feed
- **THEN** that day SHALL appear in the list with the new entry without requiring the user to press load more

#### Scenario: Manual form accepts compact typed times
- **WHEN** the user focuses the start group of the manual form's time-range field and types `9` `0` `0`
- **THEN** the start SHALL show `09:00` without a separate commit step and the form SHALL submit that time

#### Scenario: Manual form blocks inverted times
- **WHEN** the user submits the manual-entry form with an end time earlier than the start time
- **THEN** an inline error SHALL be shown and no request SHALL be sent

#### Scenario: Manual form blocks an incomplete time
- **WHEN** the user clears a segment of the start or end group and submits
- **THEN** an inline error SHALL be shown and no request SHALL be sent

### Requirement: REQ-456 Inline entry edits
Each entry SHALL be editable in place (start, stop, title) and deletable after confirmation (REQ-143, REQ-151). A time edit SHALL change only the edited hour and minute, keeping stored seconds and milliseconds; an unchanged value SHALL send nothing; the same-minute clamp (REQ-432) SHALL be on, saving zero length instead of an error. Retitling one entry SHALL move only that entry. A start moved across midnight SHALL regroup it. The list SHALL refresh when the running entry stops or is replaced.

#### Scenario: Inline edit of an entry's times
- **WHEN** the user changes a segment of an entry's start or stop in the row's time field and commits (focus leaving the field or Enter)
- **THEN** the entry SHALL be patched and the row, group, and day totals SHALL update from the response

#### Scenario: Invalid inline time reverts silently
- **WHEN** the user types digits that cannot form a valid segment value (e.g. `7` `5` into an entry's minute segment) or presses Escape while editing
- **THEN** the field SHALL keep a valid value (Escape restores the committed one), no invalid time SHALL be committed, and no request SHALL be sent on that basis

#### Scenario: Inline edit preserves stored seconds
- **WHEN** an entry stopped at `10:42:31` and the user changes its stop minute segment to `45` and commits
- **THEN** the patch SHALL set `stoppedAt` to `10:45:31` on the same day (seconds and milliseconds unchanged)

#### Scenario: Unchanged inline time sends no request
- **WHEN** an entry started at `10:42:17` and stopped at `10:42:31`, and the user focuses the stop minute segment, retypes `42`, and leaves the field
- **THEN** no request SHALL be sent and no error toast SHALL appear

#### Scenario: Same-minute inversion is clamped before patching
- **WHEN** an entry started at `10:42:50` and stopped at `10:43:10`, and the user changes the start minute segment to `43` and commits
- **THEN** the patch SHALL set `startedAt` to `10:43:10`, the server SHALL accept it, and the row SHALL show `10:43 – 10:43` with a zero duration

#### Scenario: Inline retitle splits the entry off
- **WHEN** the user retitles a single entry inside an expanded group
- **THEN** the entry SHALL move to the group of the re-resolved task and the remaining entries of the original group SHALL be unaffected

#### Scenario: Cross-midnight edit regroups the entry
- **WHEN** an inline `startedAt` edit moves an entry to a different day in the effective timezone
- **THEN** the page SHALL show the entry under the new day's section

#### Scenario: Top-bar stop refreshes the list
- **WHEN** the user stops the running timer from the top-bar widget while viewing the timer page
- **THEN** the page SHALL refresh or merge its entries so the finished entry appears in its day/task group without a manual reload

#### Scenario: Delete an entry with confirmation
- **WHEN** the user activates an entry's delete action and confirms
- **THEN** the entry SHALL be deleted, removed from the page, and a group left with no entries SHALL disappear

### Requirement: REQ-392 Automatic load more on scroll
While `hasMore` is true, the timer view SHALL request the next feed page automatically when the end of the loaded day list scrolls into (or near) view, without requiring the user to activate "load more". At most one load-more request SHALL be in flight at a time. While a page is loading, the list end SHALL show a loading indicator announced politely to assistive technologies. A failed automatic load SHALL leave the "load more" control usable for a manual retry and SHALL NOT retry in a loop.

#### Scenario: Scrolling to the end loads older days
- **WHEN** `hasMore` is true and the user scrolls the end of the day list into view
- **THEN** the page SHALL append up to seven older activity days without the user activating "load more"

#### Scenario: No duplicate requests while loading
- **WHEN** the end of the list stays in view while a load-more request is in flight
- **THEN** the page SHALL NOT issue a second load-more request until the first one settles

#### Scenario: No automatic load when history is exhausted
- **WHEN** the last response reported `hasMore` false
- **THEN** reaching the end of the list SHALL NOT issue any feed request

#### Scenario: Failed automatic load falls back to the button
- **WHEN** an automatic load-more request fails
- **THEN** the page SHALL keep the already loaded days, SHALL show the "load more" control for a manual retry, and SHALL NOT repeatedly re-issue the failed request on its own

### Requirement: REQ-393 Single-request refresh of the loaded window
When the timer view refreshes its list after a mutation (entry edit, delete, add within the loaded range, continue, or the running entry stopping or being replaced), it SHALL re-fetch the whole loaded window in **one** feed request using the range-refresh mode of REQ-395 (`from` = the local start of the oldest loaded day), replacing the held entries with the response. The refresh SHALL NOT shrink the loaded window, and `hasMore` / `nextBefore` SHALL be taken from the response.

#### Scenario: Edit deep in loaded history refreshes in one request
- **WHEN** the user has loaded 28 activity days through load more and edits an entry
- **THEN** the page SHALL issue exactly one feed request to refresh the list and SHALL still show all 28 days afterwards

#### Scenario: Refresh keeps pagination consistent
- **WHEN** a refresh completes and older unloaded history exists
- **THEN** `hasMore` SHALL be true and the next load more SHALL continue from the oldest loaded day

#### Scenario: Failed refresh keeps the current list
- **WHEN** the refresh request fails
- **THEN** the page SHALL keep showing the previously held entries rather than clearing the list

### Requirement: REQ-394 Live duration updates scoped to the running entry
While a timer is running, the per-second live duration update SHALL change only the running entry's row duration, its task group's total, and its day's total. Stopped entries' groups and days SHALL NOT be recomputed or re-rendered by the tick. Displayed totals SHALL remain equal to the sum of their entries' durations, with the running entry measured up to the current second.

#### Scenario: Running group total ticks
- **WHEN** a timer is running and one second elapses
- **THEN** the running entry's row duration, its group total, and its day total SHALL each advance by one second

#### Scenario: Other groups are unaffected by the tick
- **WHEN** a timer is running and the page shows other task groups with only stopped entries
- **THEN** those groups' displayed totals SHALL stay constant and the tick SHALL NOT re-render them

#### Scenario: Totals include the running entry after it stops
- **WHEN** the running entry is stopped
- **THEN** its group and day totals SHALL show the stopped entry's final duration and SHALL stop advancing

### Requirement: REQ-501 Group row layout and live group
Each task group SHALL be a row of the shared column list (REQ-496) with the columns expansion, entry count, title, project, remote issue, duration and continue/stop. In the narrow layout (REQ-500) its first line SHALL hold expansion, count, title, duration and continue/stop, and its second line project and remote issue. A group holding the running entry SHALL show the shell widget's animated stop control, which stops it, and no separate live-status phrase.

#### Scenario: Wide list keeps a single-row group
- **WHEN** the timer view list is in its column layout
- **THEN** each group SHALL keep expansion, count, title, project, remote issue, duration and continue on one row, each in its column

#### Scenario: Narrow list uses a two-line group
- **WHEN** the timer view list uses the narrow layout
- **THEN** a group SHALL place count, title, duration and continue on its first line and project and remote issue on its second, without horizontal overflow

#### Scenario: Live group uses the shell stop control
- **WHEN** a group contains the running entry
- **THEN** the group SHALL NOT show a separate live-status phrase, and the group action SHALL be the same animated stop control as the shell timer widget

#### Scenario: Live group stop stops the running entry
- **WHEN** the user activates the stop control on a live group
- **THEN** the running entry SHALL stop through the shared timer stop operation

### Requirement: REQ-502 Entry rows use the group's columns
An expanded entry SHALL be a row of the same list: its editable title in the title column, its time-range field ending where the remote-issue column ends, its duration in the duration column and its delete control in the action column. In the narrow layout (REQ-500) its first line SHALL hold the time range, duration and delete control, and its second line the editable title.

#### Scenario: Entry duration lines up with the group
- **WHEN** a group is expanded in the column layout
- **THEN** each entry's duration SHALL share the group duration's end edge, and each delete control SHALL sit in the group's action column

#### Scenario: Entry title lines up with the group title
- **WHEN** a group is expanded in the column layout
- **THEN** each entry title SHALL start at the group title's start edge

#### Scenario: Narrow entry shows times first
- **WHEN** a group is expanded in the narrow layout
- **THEN** each entry SHALL show its time range, duration and delete control on its first line and its editable title on the second

### Requirement: REQ-503 One list across days
All loaded days SHALL share one list with one header row naming the Task, Project, Issue and Duration columns. Each day SHALL begin with a heading row holding its date and Remote Sync link, with the day total in the duration column. Rows added by load more or a refresh SHALL join the same columns.

#### Scenario: Days share their columns
- **WHEN** the timer view shows groups of two or more days
- **THEN** the project, issue and duration columns SHALL have the same edges in every day

#### Scenario: Day total sits in the duration column
- **WHEN** a day heading row is rendered
- **THEN** its total SHALL share the group durations' end edge, and its date and Remote Sync link SHALL sit at the row's start

#### Scenario: Loaded days join the same columns
- **WHEN** load more appends older days
- **THEN** their rows SHALL use the same columns and SHALL NOT change any column width
