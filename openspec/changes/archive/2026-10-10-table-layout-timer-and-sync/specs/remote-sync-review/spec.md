## MODIFIED Requirements

### Requirement: REQ-113 Original and editable rounded durations

Each collapsed task row SHALL show **tracked** (the sum of the task's completed entries that day) and **to send** (the export duration) in their own columns at every list width, never only in the expanded region, with their signed **delta** in a tooltip and as accessible text, not as a third visible value. Sent and read-only rows SHALL show them as text, to send being the last finalized export duration when provenance exists, otherwise `0`.

#### Scenario: Sent row shows exported duration

- **WHEN** a task has finalized provenance and additional local entries that day
- **THEN** tracked SHALL include the later local time, to-send SHALL remain the last exported duration, and neither value SHALL be editable

#### Scenario: Cluster stays on the collapsed row

- **WHEN** the user reviews the day without expanding a row
- **THEN** tracked and to-send SHALL be visible on that row and the signed delta SHALL be available from the to-send tooltip

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

### Requirement: REQ-489 Remote Sync test hooks and absent controls
Stable `data-testid` hooks SHALL exist for rows, state indicators, durations, field controls, expansion controls, the actions cell, day summaries, day navigation, the Export action and detail rows. The page SHALL have no include checkbox, per-entry selection, rounding-suggestion action, day-level bulk action or separate Today and Pick date actions, nor hooks for them.

#### Scenario: Removed controls are absent

- **WHEN** the Remote Sync page is rendered
- **THEN** include checkboxes, per-entry selection, rounding-suggestion actions, and their test hooks SHALL NOT be present

## ADDED Requirements

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

## REMOVED Requirements

### Requirement: REQ-486 Row state badge
**Reason**: The state moves from a text badge next to the title to an icon in its own column, which REQ-486's "no State column" scenario forbids.
**Migration**: REQ-504.

### Requirement: REQ-488 Remote Sync row layout and actions slot
**Reason**: Rows switched layout on the viewport breakpoint and kept the durations on the first narrow line, leaving the title almost no room.
**Migration**: REQ-505, on the shared narrow layout REQ-500.

### Requirement: REQ-363 Two-pane expanded row details
**Reason**: Side-by-side panes of sentences could not line up with the task's duration columns.
**Migration**: REQ-507.

### Requirement: REQ-225 Three reconciling day summaries with deltas
**Reason**: Seven amounts that reconcile the day by state duplicated what the rows show, and none answered what the tracker will hold after Export.
**Migration**: REQ-508 (day total) and REQ-509 with REQ-510 (in tracker after export).
