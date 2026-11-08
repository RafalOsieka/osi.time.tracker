# remote-sync-review Specification

## Purpose
The per-day Remote Sync page as a review surface: every task of the day with its state and reason, tracked and to-send durations, activity and export comment, in a compact expandable list with details, day navigation, reconciling day summaries, and its accessibility. The export pipeline behind Export is in `remote-sync-export`.

## Requirements

### Requirement: REQ-111 Per-day Remote Sync page lists all of the day's tasks

The application SHALL provide a private Remote Sync page for one day, reached from each Timer-view day header, listing **every** task with entries that day plus a "(no task)" bucket when untitled entries exist, so its total matches the Timer view's day total. The day boundary SHALL follow the user's timezone exactly as in the Timer view. Export actions SHALL appear only for eligible linked tasks.

#### Scenario: Open the Remote Sync page for a day
- **WHEN** an authenticated user activates the Remote Sync action on a Timer-view day
- **THEN** the application SHALL navigate to the Remote Sync page for that date and list every Task
  with entries on that day, including a read-only "(no task)" bucket when untitled entries exist

#### Scenario: Day with no entries
- **WHEN** the user opens the Remote Sync page for a day with no time entries
- **THEN** the page SHALL render a translated empty state and no task rows

#### Scenario: Cross-midnight entries follow the timezone day rule
- **WHEN** an entry starts near midnight in the user's timezone
- **THEN** it SHALL be attributed to the same day the Timer view attributes it to

#### Scenario: Unauthenticated access is redirected
- **WHEN** an unauthenticated visitor requests the Remote Sync page
- **THEN** the global guard SHALL redirect to `/login` with the page as the redirect target before
  any protected markup is sent

### Requirement: REQ-112 Explicit per-row state with stated reason

Each task row SHALL have exactly one state: **Sent** with a finalized export for the date; **read-only with a translated reason** when there is no project, no tracker, a missing or soft-deleted tracker, an unsupported system type, or no activity in a successful fetch; **read-only but linkable** with a usable tracker but no linked issue; **temporarily unavailable**, retryable, when required remote data failed to load; else **Ready**. The "(no task)" bucket SHALL always be read-only.

#### Scenario: Task without a Project is read-only

- **WHEN** a listed Task has no Project
- **THEN** its row SHALL be read-only and display a translated reason indicating the missing Project

#### Scenario: Project without a tracker is read-only

- **WHEN** a listed Task's Project has no tracker (`trackerId` null)
- **THEN** its row SHALL be read-only and display a translated reason indicating the missing tracker

#### Scenario: Soft-deleted or missing tracker is read-only

- **WHEN** a listed Task's Project points at a missing or soft-deleted tracker
- **THEN** its row SHALL be read-only and display a translated reason indicating the missing tracker

#### Scenario: Unsupported system type is read-only

- **WHEN** a listed Task's tracker has a system type without an implemented adapter
- **THEN** its row SHALL be read-only and display a translated reason indicating the system is not supported yet

#### Scenario: Unlinked task is read-only but linkable

- **WHEN** a listed Task resolves to a usable tracker but has no remote issue reference
- **THEN** its row SHALL be read-only for export controls while exposing an inline link action

#### Scenario: Fully eligible task is manageable

- **WHEN** a listed Task is linked, has no finalized export for that date, and all required remote data loaded successfully with at least one activity
- **THEN** its row SHALL be Ready (manageable) and expose in-place title-to-send, duration, and activity controls

#### Scenario: Any finalized export makes the row Sent

- **WHEN** a listed Task has at least one finalized export for the requested local date
- **THEN** its row SHALL be Sent, SHALL NOT expose export editors, and SHALL NOT be included in Export even if later local entries exist that day

### Requirement: REQ-113 Original and editable rounded durations

Each collapsed task row SHALL show **tracked** (the sum of the task's completed entries that day) and **to send** (the export duration) in their own columns at every list width, never only in the expanded region, with their signed **delta** in a tooltip and as accessible text, not as a third visible value. Sent and read-only rows SHALL show them as text, to send being the last finalized export duration when provenance exists, otherwise `0`.

#### Scenario: Sent row shows exported duration

- **WHEN** a task has finalized provenance and additional local entries that day
- **THEN** tracked SHALL include the later local time, to-send SHALL remain the last exported duration, and neither value SHALL be editable

#### Scenario: Cluster stays on the collapsed row

- **WHEN** the user reviews the day without expanding a row
- **THEN** tracked and to-send SHALL be visible on that row and the signed delta SHALL be available from the to-send tooltip

### Requirement: REQ-487 Editable to-send duration
On a Ready row, to send SHALL be editable in place, pre-filled by applying the project's active tracker's rounding rule once to the tracked total, and recomputed when the day's entries change unless overridden. An override SHALL stay until explicitly reset (Escape while editing, or a reset the active field offers). Input that cannot be normalized SHALL revert. A to-send of `0` SHALL exclude the task from Export. Values SHALL stay page state until a successful export finalizes.

#### Scenario: Rounded default is computed from the day's entries

- **WHEN** a Ready task's completed entries (the whole day, with no per-entry picking) sum to 50 minutes under an `up_15m` rule
- **THEN** the editable to-send duration SHALL default to 60 minutes while tracked remains 50 minutes and the signed delta SHALL be available from the duration cluster tooltip

#### Scenario: Exact multiple is unchanged

- **WHEN** the tracked total is an exact multiple of the rounding increment
- **THEN** the default to-send duration SHALL equal the tracked total

#### Scenario: Changed entries recompute a non-overridden default

- **WHEN** the day's completed entries for a Ready task change before the user overrides to-send
- **THEN** the application SHALL recompute the rounded default once from the new tracked total

#### Scenario: Entry changes do not replace an override

- **WHEN** the user has overridden the export duration
- **THEN** the application SHALL retain the override until the user explicitly resets it; absence of per-entry selection SHALL NOT clear the override

#### Scenario: Invalid duration input reverts

- **WHEN** the user enters a value that cannot be normalized to a valid duration
- **THEN** the field SHALL revert to the previous value without emitting a change

#### Scenario: Zero to-send excludes the task

- **WHEN** a Ready row's export duration is `0`
- **THEN** the task SHALL be excluded from Export and SHALL NOT be sent

### Requirement: REQ-114 Required remote fields with fetched options and pre-fill

For each otherwise manageable row the page SHALL fetch activities once per activity scope (REQ-332), shared by its rows, in a labelled select preselecting the task's last finalized activity when listed, else none, never a tracker default; selections stay page state. A successful empty answer SHALL make those rows read-only, saying no activity is available and nothing will be pushed. A failure SHALL give only those rows an accessible retryable error; retry refetches the scope once for all.

#### Scenario: Activities are fetched and selectable
- **WHEN** the page loads with otherwise manageable rows whose configuration has a registered adapter
- **THEN** each row SHALL offer the activities fetched for its resolved activity scope

#### Scenario: Rows sharing a scope reuse one fetch
- **WHEN** multiple rows resolve to the same activity scope (for example five Redmine tasks on one tracker)
- **THEN** the adapter SHALL fetch activities once and every such row SHALL reuse the result

#### Scenario: Per-issue scopes are still fetched per issue
- **WHEN** rows resolve to distinct activity scopes (for example OpenProject work packages)
- **THEN** each scope SHALL be fetched once and no row SHALL show another scope's options

#### Scenario: Previously used activity takes precedence
- **WHEN** provenance provides a valid most-recent activity that matches a fetched option
- **THEN** the previously used activity SHALL be selected

#### Scenario: No pre-fill from tracker defaults
- **WHEN** no valid previously used activity exists
- **THEN** the activity control SHALL remain unselected and SHALL NOT be pre-filled from tracker-level required-field defaults

#### Scenario: No matching pre-fill leaves the control unselected
- **WHEN** no valid previously used activity exists or it does not match a fetched option
- **THEN** the activity control SHALL remain unselected without an error

#### Scenario: Successful empty response prevents export
- **WHEN** the scope-scoped fetch succeeds with no activities
- **THEN** affected rows SHALL be read-only with a stated reason that no activity is available and
  their time will not be pushed to the remote system

#### Scenario: Options fetch fails and can be retried
- **WHEN** an activities request fails because of credentials, CORS, or network conditions
- **THEN** affected rows SHALL show an accessible retry action and SHALL NOT be classified as having
  no activities

#### Scenario: Retrying a shared scope updates all its rows
- **WHEN** the user retries a failed activity fetch from one row whose scope is shared
- **THEN** one request SHALL be made and every row sharing that scope SHALL leave the error state together

### Requirement: REQ-116 Remote Sync page accessibility and i18n

The page SHALL meet WCAG 2.1 AA: row states and reasons in text, never color alone, warnings pairing an icon with text; labelled duration and field controls; option loading and errors announced in live regions; everything keyboard operable, with expansion controls exposing their state; day summaries and duration clusters as labelled text. All strings SHALL come from the catalogs with `en`/`pl` parity.

#### Scenario: States are announced as text

- **WHEN** a row is read-only for any reason
- **THEN** the reason SHALL be available as translated text to assistive technologies, not conveyed by styling alone

#### Scenario: Keyboard-only review

- **WHEN** a keyboard user tabs through the page
- **THEN** the compact day switcher, export action, row expansion controls, in-place to-send fields, activity selects, title-to-send fields, and inline link actions SHALL all be reachable and operable without a pointer

#### Scenario: Expansion state is programmatically exposed

- **WHEN** assistive technology inspects a task row's expansion control
- **THEN** the control SHALL expose whether the row is expanded or collapsed and which region it controls

### Requirement: REQ-489 Remote Sync test hooks and absent controls
Stable `data-testid` hooks SHALL exist for rows, state indicators, durations, field controls, expansion controls, the actions cell, day summaries, day navigation, the Export action and detail rows. The page SHALL have no include checkbox, per-entry selection, rounding-suggestion action, day-level bulk action or separate Today and Pick date actions, nor hooks for them.

#### Scenario: Removed controls are absent

- **WHEN** the Remote Sync page is rendered
- **THEN** include checkboxes, per-entry selection, rounding-suggestion actions, and their test hooks SHALL NOT be present

### Requirement: REQ-223 Day review is a compact expandable list

The day's tasks SHALL be one column-aligned expandable list (REQ-496) with the columns expansion, state, title-to-send (editable on Ready rows), issue reference or link control, activity (a select on Ready rows), tracked, to send and actions. Rows start collapsed and expand singly without changing values. Ready, Sent, blocked and untitled rows share one list, told apart by their state and active controls.

#### Scenario: Day opens with all rows collapsed

- **WHEN** the user opens the Remote Sync page for a day with several tasks
- **THEN** each task SHALL be one collapsed row showing state, title, issue, activity, tracked, to send, and an empty actions cell

#### Scenario: Expanding a row reveals its detail

- **WHEN** the user activates the expansion control of a task row
- **THEN** that row SHALL reveal REQ-507 details while other rows remain collapsed and the collapsed durations SHALL stay unchanged

#### Scenario: Collapsing a row preserves review state

- **WHEN** the user collapses a row after changing its to-send duration or activity
- **THEN** those values SHALL be retained and SHALL still be reflected in the collapsed row

#### Scenario: Blocked rows are grouped and still legible

- **WHEN** the day contains Sent or read-only rows
- **THEN** those rows SHALL remain in the same list as Ready rows, distinguished by state and non-editable controls, and SHALL show their tracked and to-send durations without being expanded, their reason available from the state indicator

#### Scenario: Untitled bucket is a non-selectable row

- **WHEN** untitled entries exist on the day
- **THEN** the list SHALL contain a row for them that contributes to the day total and offers no title, duration, activity, or export control

#### Scenario: Only Ready rows expose export editors

- **WHEN** a Sent or not-exportable row is collapsed
- **THEN** title-to-send, activity, and to-send SHALL NOT be editable

### Requirement: REQ-224 On-page day navigation

The header SHALL hold a stable translated title and a compact day switcher — previous and next day around a short localized date that opens the shared calendar grid (REQ-359) in a popover, showing the displayed day's month with that day selected — followed by Export. Picking a day SHALL navigate and close the popover; picking the displayed day SHALL only close it. Controls SHALL be labelled and keyboard operable, the grid navigable with arrows and confirmed with Enter or Space.

#### Scenario: Header presents the compact day switcher and primary action

- **WHEN** the user opens the Remote Sync page
- **THEN** the header SHALL show the stable page title, previous-day action, short localized date
  label, next-day action, and Export action without a long date in the title

#### Scenario: Jump to an arbitrary date

- **WHEN** the user activates the date label and picks a date in the calendar grid
- **THEN** the popover SHALL close and the page SHALL navigate to that date, including dates with no
  time entries

#### Scenario: Calendar opens on the displayed day

- **WHEN** the user activates the date label while viewing `2026-09-07`
- **THEN** the calendar SHALL show September 2026 with the 7th selected, and picking the 7th again
  SHALL close the popover without navigating or reloading

#### Scenario: Calendar is keyboard operable

- **WHEN** a keyboard user opens the calendar from the date label
- **THEN** focus SHALL move into the grid, arrow keys SHALL move between days (crossing month
  boundaries), Enter SHALL navigate to the focused day, and Escape SHALL close the popover without
  navigating

#### Scenario: Date label remains usable in narrow layouts

- **WHEN** the page is viewed at a supported narrow viewport
- **THEN** the short localized date and adjacent navigation and Export controls SHALL remain legible
  and operable without restoring the long date heading

### Requirement: REQ-490 Navigating to another day
Navigating SHALL change the page's date route, recompute the day boundary in the user's timezone and reload the day review for the new date. Unfinalized review state belongs to the day being left and SHALL NOT carry over. A date without entries SHALL show the translated empty state.

#### Scenario: Move to the previous day

- **WHEN** the user activates the previous-day action
- **THEN** the page SHALL navigate to the preceding date and display that day's review

#### Scenario: Empty day after navigation

- **WHEN** navigation lands on a date with no time entries
- **THEN** the page SHALL render the translated empty state and no task rows

#### Scenario: Review state does not carry over

- **WHEN** the user has overridden an export duration and then navigates to another day
- **THEN** the new day's rows SHALL be derived from their own data with default selections and no
  inherited override

### Requirement: REQ-226 Remote log context includes the log comment

Each displayed remote log SHALL render its comment alongside its duration, activity and identifier. When a log has no comment, the row SHALL render a translated placeholder rather than an empty value. Long comments SHALL remain fully accessible, e.g. by truncating the visible text while exposing the full value to assistive technologies and on hover or focus. Remote logs SHALL remain informational only and SHALL NOT be editable from this page.

#### Scenario: Log with a comment shows it
- **WHEN** a fetched remote log has a comment
- **THEN** the log line SHALL display that comment together with its duration, activity and identifier

#### Scenario: Log without a comment shows a placeholder
- **WHEN** a fetched remote log has no comment
- **THEN** the log line SHALL display a translated no-comment placeholder

#### Scenario: Long comment stays accessible
- **WHEN** a log comment is too long to display in full
- **THEN** the visible text SHALL be truncated while the complete comment remains available to assistive technologies and on hover or focus

### Requirement: REQ-232 Editable per-task export comment

Each Ready task SHALL have an editable comment sent as the remote log's note: the labelled in-place title-to-send on its collapsed row, shown in the review before confirming. It SHALL default to the comment of the latest fetched remote log for its issue, else the task name; an empty value SHALL fall back to the task name. It SHALL be page state for the day, never stored locally and never renaming the task. Sent and non-exportable rows SHALL show the task name as text instead.

#### Scenario: Comment defaults to the task name

- **WHEN** a linked Ready task has no fetched remote log with a comment
- **THEN** its title-to-send SHALL default to the task name

#### Scenario: Comment defaults to the last remote log comment

- **WHEN** the task's linked issue has a fetched remote log carrying a comment
- **THEN** its title-to-send SHALL default to that comment

#### Scenario: Edited comment is what gets sent

- **WHEN** the user edits a Ready task's title-to-send and confirms the export
- **THEN** the review phase SHALL have shown the edited value and the remote log SHALL be created with it

#### Scenario: Empty comment falls back

- **WHEN** the user clears a task's title-to-send and exports
- **THEN** the remote log SHALL be created with the task name instead of an empty note

#### Scenario: Comments are not persisted locally

- **WHEN** the user edits title-to-send and then reloads the page or navigates to another day
- **THEN** the edited values SHALL NOT be restored from local storage and the defaults SHALL apply again

#### Scenario: Editing title-to-send does not rename the local task

- **WHEN** the user commits a different title-to-send on a Ready row
- **THEN** the local task name SHALL remain unchanged

### Requirement: REQ-504 Row state indicator
Each collapsed row SHALL show its state as an icon in its own column, with a distinct icon per kind (Ready, Sent, Loading while activities load, not exportable) and never color alone. Its accessible name and tooltip SHALL give the short state label and the full reason. While activities load, a linked never-exported row SHALL keep Ready's title, duration and activity chrome, inactive. Read-only and Sent rows SHALL still show name, tracked time and loaded remote logs when expanded.

#### Scenario: Activities in flight show Loading, not blocked
- **WHEN** a linked never-exported task is waiting on remote activities
- **THEN** its state SHALL be the Loading kind and SHALL NOT use the not-exportable label

#### Scenario: State reads as label and reason
- **WHEN** the user hovers or focuses a row's state icon, or assistive technology reads it
- **THEN** the tooltip and the accessible name SHALL give the translated state label followed by the full reason

#### Scenario: Kinds differ by icon
- **WHEN** rows of different kinds are shown
- **THEN** each kind SHALL use a different icon shape, so the kinds can be told apart without color

#### Scenario: State column header is for assistive technology
- **WHEN** the list shows its column headers
- **THEN** the state column SHALL have a header that assistive technology reads and that is not visible

### Requirement: REQ-505 Narrow Sync rows and the actions column
In the narrow layout (REQ-500) a task row SHALL use three lines: expansion, state and title first; issue reference with tracked second; activity with to send third, to send marked as following tracked. The actions column SHALL be present and empty, sized for one icon button, so a later action does not reflow the row.

#### Scenario: Narrow list uses three lines
- **WHEN** the Remote Sync list uses the narrow layout
- **THEN** each task row SHALL show state and title on its first line, issue and tracked on its second, and activity and to send on its third, without horizontal overflow

#### Scenario: Actions column is reserved and empty
- **WHEN** a Ready or Sent row is rendered
- **THEN** its actions cell SHALL occupy space and SHALL contain no button or menu

### Requirement: REQ-506 Activity load errors stay in their cell
When a row's activities fail to load (REQ-114), its activity cell SHALL show an error icon, whose accessible name and tooltip carry the translated message, and the retry action, without widening the column. Guidance that needs more room, such as browser-extension setup or an approval request, SHALL appear in a full-width row directly under the task row, visible without expanding it.

#### Scenario: Failure shows a compact error
- **WHEN** a row's activity fetch fails
- **THEN** its activity cell SHALL show an error icon with the translated message as its accessible name and tooltip, plus a retry action, and no column SHALL change its width

#### Scenario: Extension guidance gets its own row
- **WHEN** the failure needs browser-extension setup or approval
- **THEN** a full-width row directly under the task row SHALL show the translated guidance and, when applicable, the approval request action, while the row is collapsed

#### Scenario: A successful retry clears both
- **WHEN** a retry loads the activities
- **THEN** the error icon and the guidance row SHALL disappear and the activity select SHALL be shown

### Requirement: REQ-507 Expanded details are rows on the task columns
Expanding a row SHALL reveal information only, as rows of the same list: the task's completed local entries that day, each duration in the tracked column, then the same-day current-account remote logs for its issue (REQ-118, REQ-226), each with its link state in the state column, duration in the to-send column and reconciliation action in the actions column. It SHALL offer no duration editors, rounding alternatives, comment editors or entry selection.

#### Scenario: Local entries line up under tracked
- **WHEN** a task row is expanded
- **THEN** each local entry's duration SHALL share the tracked column's end edge

#### Scenario: Remote logs line up under to send
- **WHEN** a linked task row is expanded and its remote logs are loaded
- **THEN** each log's duration SHALL share the to-send column's end edge, its Linked or Unlinked state SHALL sit in the state column and its action in the actions column

#### Scenario: Unlinked row has no remote-logs section
- **WHEN** an unlinked or not-exportable task row is expanded
- **THEN** the detail SHALL show local entries and SHALL NOT show a remote-logs section

#### Scenario: Remote-logs states are full-width rows
- **WHEN** a linked row's remote logs are loading, failed, or empty
- **THEN** the remote-logs section SHALL show that state in a row spanning the content columns, the failure with a retry action

#### Scenario: Details are not an editor
- **WHEN** a ready task row is expanded
- **THEN** the detail SHALL NOT offer duration, comment, rounding, or entry-selection controls

### Requirement: REQ-508 Day total summary
Once above the list, the page SHALL show the labelled **day total**: every completed entry of the day, untitled, Sent and blocked time included, equal to the Timer view's total for that day. It SHALL update at once when the day's entries change.

#### Scenario: Day total matches the Timer view
- **WHEN** the user compares the Remote Sync day total with the Timer view's total for the same day
- **THEN** the two SHALL be equal

#### Scenario: Day total includes every completed entry
- **WHEN** a day contains Ready, Sent, blocked and untitled time
- **THEN** the day total SHALL include all of it

### Requirement: REQ-509 In-tracker-after-export summary
Next to the day total the page SHALL show **in tracker after export**: the current account's same-day logs on the issues linked to the day's tasks (REQ-118), each log counted once, plus the shown to-send durations of the rows not sent yet, whether or not their activity is chosen, with both parts labelled and the to-send part set apart from the logs part. It SHALL update at once when a to-send duration changes and after Export or a log refresh.

#### Scenario: Logs and to send add up
- **WHEN** the day's linked issues hold remote logs and Ready rows have to-send durations
- **THEN** the summary SHALL equal the logs' durations plus the to-send durations of the rows not sent yet, and show both parts

#### Scenario: A Ready row counts before its activity is chosen
- **WHEN** a Ready row shows a to-send duration but no activity is chosen yet
- **THEN** that duration SHALL be part of the summary's to-send part

#### Scenario: Logs added outside OSI are included
- **WHEN** a linked issue holds a same-day log of the current account that no export created
- **THEN** that log's duration SHALL be part of the summary

#### Scenario: A log shared by two tasks counts once
- **WHEN** two tasks of the day are linked to the same issue
- **THEN** each of that issue's logs SHALL be counted once

#### Scenario: Zero to send lowers the summary
- **WHEN** a Ready row's to-send duration is set to `0`
- **THEN** the summary SHALL drop by that row's previous to-send duration at once

#### Scenario: Exported time moves into the logs part
- **WHEN** Export finalizes and the logs are refreshed
- **THEN** the exported durations SHALL count in the logs part and SHALL NOT count again as to send

### Requirement: REQ-510 In-tracker summary without complete logs
While any tracker's logs for the day are loading, the in-tracker summary SHALL show no number and say that logs are loading. When a tracker's logs fail or cannot be fetched, for example an extension tracker on mobile, it SHALL show no number, name the affected tracker and the reason, and offer a retry where one exists. It SHALL never show a partial sum.

#### Scenario: Loading logs show no number
- **WHEN** the page is waiting for any tracker's logs
- **THEN** the summary SHALL show no number and an announced loading state

#### Scenario: A failed tracker shows the reason and a retry
- **WHEN** one tracker's logs fail to load and another's load
- **THEN** the summary SHALL show no number, name the failed tracker and the reason, and offer a retry

#### Scenario: An unavailable tracker shows the reason
- **WHEN** a tracker's logs cannot be fetched on this device
- **THEN** the summary SHALL show no number and state why, without a retry action
