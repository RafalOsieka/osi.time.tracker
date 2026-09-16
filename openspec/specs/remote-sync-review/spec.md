# remote-sync-review Specification

## Purpose
Define the per-day Remote Sync page as a review surface: listing every task with entries that day, deriving each row's state and stated reason, the tracked/to-send duration cluster with editable rounded defaults, fetched activity options with pre-fill, the compact expandable-row layout and two-pane details, on-page day navigation, the three reconciling day summaries, remote-log comments, the editable per-task export comment, and the page's accessibility and i18n guarantees. The export pipeline behind the Export action (aggregate endpoint, transport, provenance, outcomes, request keys) is specified in `remote-sync-export`.

## Requirements

### Requirement: REQ-111 Per-day Remote Sync page lists all of the day's tasks

The application SHALL provide a Remote Sync page for a specific day, reachable from each day header
in the Timer view. The page SHALL list **all** Tasks that have time entries on that day, plus a
"(no task)" bucket when untitled entries exist that day, so the page's total matches the Timer view's
day total. The day boundary SHALL be computed in the user's configured timezone using the same rule
as the Timer view. The page SHALL be private (authentication required) and SHALL expose export
actions only for eligible linked tasks.

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

Each task row on the Remote Sync page SHALL expose exactly one effective state: **Sent** when at least one finalized export exists for that task on the requested local date; **read-only with a translated stated reason** when the Task has no Project, the Project has no tracker, the tracker is soft-deleted/missing, the system type is unsupported, or a successful activity fetch yielded no activities; **read-only but linkable** when the tracker is usable but no remote issue reference exists; **temporarily unavailable with a retryable error** when required remote data failed to load; or **Ready** (manageable) when every prerequisite is met and no finalized export exists for that task/date. The "(no task)" bucket SHALL always be read-only. Read-only and Sent rows SHALL still display task name, tracked duration, and any successfully loaded remote-log context in the expanded region.

The collapsed row SHALL convey the kind with a compact badge whose visible label is short translated text (Ready, Sent, Loading while remote activities are in flight, or the blocking reason in compact form) plus an accessible name and tooltip for the full reason. Unlinked Ready-path rows MAY omit the Ready badge and keep the existing inline link control. State SHALL NOT occupy a dedicated column. Color alone SHALL NOT convey the kind. While activities are loading, a linked never-exported row SHALL keep the same title, duration, and activity control chrome as Ready (non-interactive) rather than swapping plain text for inputs after load.

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

#### Scenario: Activities in flight show Loading, not blocked

- **WHEN** a linked never-exported task is waiting on remote activities
- **THEN** its badge SHALL be the Loading kind and SHALL NOT use the blocked compact label

#### Scenario: Fully eligible task is manageable

- **WHEN** a listed Task is linked, has no finalized export for that date, and all required remote data loaded successfully with at least one activity
- **THEN** its row SHALL be Ready (manageable) and expose in-place title-to-send, duration, and activity controls

#### Scenario: Any finalized export makes the row Sent

- **WHEN** a listed Task has at least one finalized export for the requested local date
- **THEN** its row SHALL be Sent, SHALL NOT expose export editors, and SHALL NOT be included in Export even if later local entries exist that day

#### Scenario: Kind is not a dedicated column

- **WHEN** the day review is rendered
- **THEN** no State column SHALL be present and each row's kind SHALL be available as translated text on a compact badge or equivalent control


### Requirement: REQ-113 Original and editable rounded durations

Each task row SHALL display a duration cluster on the collapsed row: **tracked** (the sum of all of that Task's completed entries for the day) and **to send** (the export duration) on a single line, with their signed **delta** available from a tooltip on that cluster and as accessible text (not as a third visible token on the row). For a Ready row, to-send SHALL be an in-place editable value pre-filled by applying the Project's active tracker's rounding rule once to the tracked total. A user override SHALL be retained until explicitly reset (Escape while editing, or an explicit reset if one is offered while the field is active). An export duration of `0` SHALL exclude the task from Export. Sent and other read-only rows SHALL show the cluster as text: to-send is the last finalized export duration when provenance exists, otherwise `0`. Reviewed values SHALL remain page state until a successful export is finalized. The cluster SHALL remain visible on the collapsed row at every supported viewport; it SHALL NOT be moved into the expanded region.

#### Scenario: Rounded default is computed from selected entries

- **WHEN** a Ready task's completed entries (the whole day, with no per-entry picking) sum to 50 minutes under an `up_15m` rule
- **THEN** the editable to-send duration SHALL default to 60 minutes while tracked remains 50 minutes and the signed delta SHALL be available from the duration cluster tooltip

#### Scenario: Exact multiple is unchanged

- **WHEN** the tracked total is an exact multiple of the rounding increment
- **THEN** the default to-send duration SHALL equal the tracked total

#### Scenario: Selection changes a non-overridden default

- **WHEN** the day's completed entries for a Ready task change before the user overrides to-send
- **THEN** the application SHALL recompute the rounded default once from the new tracked total

#### Scenario: Selection does not silently replace an override

- **WHEN** the user has overridden the export duration
- **THEN** the application SHALL retain the override until the user explicitly resets it; absence of per-entry selection SHALL NOT clear the override

#### Scenario: Invalid duration input reverts

- **WHEN** the user enters a value that cannot be normalized to a valid duration
- **THEN** the field SHALL revert to the previous value without emitting a change

#### Scenario: Zero or empty selection excludes the task

- **WHEN** a Ready row's export duration is `0`
- **THEN** the task SHALL be excluded from Export and SHALL NOT be sent

#### Scenario: Sent row shows exported duration

- **WHEN** a task has finalized provenance and additional local entries that day
- **THEN** tracked SHALL include the later local time, to-send SHALL remain the last exported duration, and neither value SHALL be editable

#### Scenario: Cluster stays on the collapsed row

- **WHEN** the user reviews the day without expanding a row
- **THEN** tracked and to-send SHALL be visible on that row and the signed delta SHALL be available from the duration cluster tooltip


### Requirement: REQ-114 Required remote fields with fetched options and pre-fill

For each otherwise manageable row, the Remote Sync page SHALL fetch the configured tracker's
required-field activity options through the neutral remote-tracker adapter contract once per
provider-defined activity scope (REQ-332) and expose them in a labeled select. Rows whose issues resolve
to the same scope SHALL share one fetch and one cached result; the page SHALL NOT issue one activity
request per row when the provider's scope is coarser than the issue. The select SHALL
prefer the task's most recently finalized activity when it matches a fetched option, and SHALL
otherwise remain unselected. The page SHALL NOT pre-fill from tracker-level required-field defaults.
Selected values SHALL remain page state until finalization. A successful empty response SHALL produce a
read-only no-activity state stating that no activity is available and the task will not be pushed.
A failed request SHALL produce a translated accessible retryable error without blocking unrelated
rows; a retry SHALL refetch that scope once and update every row sharing it.

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

#### Scenario: Config default is the fallback
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

The Remote Sync page SHALL meet WCAG 2.1 AA: row kinds and reasons SHALL be conveyed in text (not color alone), duration and field controls SHALL have accessible labels, asynchronous option loading and errors SHALL be announced via live regions, and all interactions SHALL be keyboard operable. Each row's expansion control SHALL expose its expanded state and be operable from the keyboard, and the day summaries and per-row duration cluster SHALL be labelled text rather than unlabelled numbers. Warnings SHALL pair an icon with translated text and SHALL never rely on colour alone. All user-facing strings SHALL come from the i18n catalogs with `en`/`pl` parity, and stable `data-testid` hooks SHALL be provided for rows, kind badges, durations, field controls, expansion controls, the reserved actions slot, day summaries, day navigation, the primary export action, and detail panes. Hooks for the include checkbox, State column, per-entry selection, rounding suggestions, day-level bulk actions, and separate Today and Pick date actions SHALL be retired.

#### Scenario: States are announced as text

- **WHEN** a row is read-only for any reason
- **THEN** the reason SHALL be available as translated text to assistive technologies, not conveyed by styling alone

#### Scenario: Keyboard-only review

- **WHEN** a keyboard user tabs through the page
- **THEN** the compact day switcher, export action, row expansion controls, in-place to-send fields, activity selects, title-to-send fields, and inline link actions SHALL all be reachable and operable without a pointer

#### Scenario: Expansion state is programmatically exposed

- **WHEN** assistive technology inspects a task row's expansion control
- **THEN** the control SHALL expose whether the row is expanded or collapsed and which region it controls

#### Scenario: Existing test hooks keep addressing the same data

- **WHEN** a test queries a retained `data-testid` from before this workflow change
- **THEN** it SHALL resolve to the element carrying the same information in the new layout (row, durations, activity, expansion, summaries, export)

#### Scenario: Removed controls are absent

- **WHEN** the Remote Sync page is rendered
- **THEN** include checkboxes, a State column, per-entry selection, rounding-suggestion actions, and their test hooks SHALL NOT be present


### Requirement: REQ-223 Day review is presented as a dense table with expandable rows

The Remote Sync page SHALL present the day's tasks as a compact expandable list that uses the shared compact expandable-row shell (REQ-303). It SHALL NOT use a multi-column data table as the primary layout. Each collapsed row SHALL show: expansion control; title-to-send (in-place editable on Ready rows, text otherwise) with a compact kind badge; issue reference or link control; activity (in-place select on Ready rows, text otherwise); the tracked / to-send duration cluster (signed delta on tooltip); and a reserved actions slot. The actions slot SHALL be present and empty (no control) in this change, sized for a later single icon button so adding undo does not reflow the row.

On viewports at or above the shell desktop rail breakpoint the row SHALL occupy a single line. Below that breakpoint it SHALL use two lines: expansion, title and badge, duration cluster, and actions on the first line; issue and activity on the second. Expansion SHALL default to collapsed, SHALL be per row, and SHALL NOT affect activity, title-to-send, or to-send values. The untitled-entries bucket SHALL appear as a non-editable row of the same list. Ready, Sent, and not-exportable rows SHALL share this list, distinguished by badge and which controls are interactive, not by separate lists.

#### Scenario: Day opens with all rows collapsed

- **WHEN** the user opens the Remote Sync page for a day with several tasks
- **THEN** each task SHALL be one collapsed compact row showing title, kind, issue, activity, duration cluster, and an empty actions slot

#### Scenario: Narrow viewport uses two lines

- **WHEN** the page is shown below the shell desktop rail breakpoint
- **THEN** each task row SHALL place title, duration cluster, and actions on the first line and issue and activity on the second, without horizontal overflow

#### Scenario: Expanding a row reveals its detail

- **WHEN** the user activates the expansion control of a task row
- **THEN** that row SHALL reveal REQ-363 details while other rows remain collapsed and the collapsed duration cluster SHALL stay unchanged

#### Scenario: Collapsing a row preserves review state

- **WHEN** the user collapses a row after changing its to-send duration or activity
- **THEN** those values SHALL be retained and SHALL still be reflected in the collapsed row

#### Scenario: Blocked rows are grouped and still legible

- **WHEN** the day contains Sent or read-only rows
- **THEN** those rows SHALL remain in the same list as Ready rows, distinguished by badge and non-editable controls, and SHALL show their reason text and duration cluster without being expanded

#### Scenario: Untitled bucket is a non-selectable row

- **WHEN** untitled entries exist on the day
- **THEN** the list SHALL contain a row for them that contributes to the day total and offers no title, duration, activity, or export control

#### Scenario: Actions slot is reserved and empty

- **WHEN** a Ready or Sent row is rendered
- **THEN** the actions slot SHALL occupy space and SHALL contain no button or menu

#### Scenario: Only Ready rows expose export editors

- **WHEN** a Sent or not-exportable row is collapsed
- **THEN** title-to-send, activity, and to-send SHALL NOT be editable


### Requirement: REQ-363 Two-pane expanded row details

Expanding a Remote Sync task row SHALL reveal extra information only: a read-only list of that task's local completed entries for the day, and the same-day current-account remote time logs for the linked issue (REQ-118, REQ-226). The expanded region SHALL NOT contain export-duration editors, rounding alternatives, export-comment editors, or per-entry selection controls. On viewports at or above the shell desktop rail breakpoint the two lists SHALL appear side by side (local entries first, remote logs second). Below that breakpoint they SHALL stack, local entries above remote logs. A row without a linked issue SHALL omit the remote-logs pane rather than show an empty column. Loading, retryable error, and empty remote-log states SHALL remain in the remote-logs pane.

#### Scenario: Wide viewport shows two columns

- **WHEN** a linked task row is expanded at or above the shell desktop rail breakpoint
- **THEN** local entries and remote logs SHALL appear as two adjacent panes

#### Scenario: Narrow viewport stacks the panes

- **WHEN** a linked task row is expanded below the shell desktop rail breakpoint
- **THEN** local entries SHALL appear above remote logs

#### Scenario: Unlinked row has no remote-logs pane

- **WHEN** an unlinked or not-exportable task row is expanded
- **THEN** the detail region SHALL show local entries and SHALL NOT show a remote-logs pane

#### Scenario: Details are not an editor

- **WHEN** a ready task row is expanded
- **THEN** the detail region SHALL NOT offer duration, comment, rounding, or entry-selection controls

### Requirement: REQ-224 On-page day navigation

The Remote Sync page SHALL present a stable translated page title and a compact day switcher in its
header. The switcher SHALL provide previous-day and next-day actions around a short localized date
label that opens a calendar for jumping to any chosen date. That calendar SHALL be the shared
calendar grid (REQ-359, ui-shared-components) shown directly in a popover — not a text field — with
the currently displayed day pre-selected and the month of that day in view; choosing a day SHALL
navigate to it and close the popover, and choosing the already-displayed day SHALL only close the
popover. The primary Export action SHALL follow the switcher in the same header action area.
Navigation SHALL change the page's date route, SHALL recompute the day boundary in the user's
configured timezone, and SHALL reload the day review for the new date. Unfinalized review state
belongs to the day being left and SHALL NOT leak into the new day. A date with no entries SHALL
render the existing translated empty state. All controls SHALL be keyboard operable and labelled
for assistive technology, and the calendar grid SHALL be navigable with arrow keys and confirmable
with Enter or Space.

#### Scenario: Header presents the compact day switcher and primary action

- **WHEN** the user opens the Remote Sync page
- **THEN** the header SHALL show the stable page title, previous-day action, short localized date
  label, next-day action, and Export action without a long date in the title

#### Scenario: Move to the previous day

- **WHEN** the user activates the previous-day action
- **THEN** the page SHALL navigate to the preceding date and display that day's review

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

#### Scenario: Empty day after navigation

- **WHEN** navigation lands on a date with no time entries
- **THEN** the page SHALL render the translated empty state and no task rows

#### Scenario: Review state does not carry over

- **WHEN** the user has overridden an export duration and then navigates to another day
- **THEN** the new day's rows SHALL be derived from their own data with default selections and no
  inherited override

#### Scenario: Date label remains usable in narrow layouts

- **WHEN** the page is viewed at a supported narrow viewport
- **THEN** the short localized date and adjacent navigation and Export controls SHALL remain legible
  and operable without restoring the long date heading


### Requirement: REQ-225 Three reconciling day summaries with deltas

The Remote Sync page SHALL display three distinct day-level durations, each with a translated label: **day total** — the sum of every completed entry attributed to the day, including untitled time, Sent time, and rows that cannot be exported, matching the Timer view's day total; **tracked** — the sum of completed entries of Ready rows that will be included in Export; and **to send** — the sum of the export durations of those Ready rows. The signed difference between tracked and to send SHALL be displayed. Time that is neither tracked nor sendable SHALL be surfaced as separate labelled amounts for Sent rows, blocked rows, and untitled time, such that day total equals tracked plus sent plus blocked plus untitled. A Ready row with to-send `0` SHALL count as blocked for this reconciliation. The three day-level summaries SHALL appear once above the list and SHALL NOT be repeated in a list footer. All summaries SHALL update immediately when activity or export duration changes.

#### Scenario: Three summaries are displayed and reconcile

- **WHEN** a day contains Ready, Sent, blocked, and untitled time
- **THEN** the page SHALL display day total, tracked and to send, plus sent, blocked and untitled amounts, and day total SHALL equal tracked plus sent plus blocked plus untitled

#### Scenario: Day total matches the Timer view

- **WHEN** the user compares the Remote Sync day total with the Timer view's total for the same day
- **THEN** the two SHALL be equal

#### Scenario: Rounding up shows a positive delta

- **WHEN** the export durations of the Ready rows exceed their tracked totals
- **THEN** the page SHALL display to send above tracked with a positive signed difference

#### Scenario: Rounding down shows a negative delta

- **WHEN** the export durations of the Ready rows are below their tracked totals
- **THEN** the page SHALL display to send below tracked with a negative signed difference

#### Scenario: Included but blocked time is reported as blocked

- **WHEN** a row is unlinked, has no activity, or has no usable configuration
- **THEN** its duration SHALL be reported as blocked and SHALL NOT be counted in tracked or to send

#### Scenario: Deselecting a task updates the summaries

- **WHEN** a Ready row's to-send duration is set to `0`
- **THEN** tracked and to send SHALL decrease, the blocked amount SHALL increase, and the day total SHALL stay unchanged

#### Scenario: Sent time is reported as sent

- **WHEN** a task has finalized provenance for the day
- **THEN** its duration SHALL be reported as sent and SHALL NOT be counted in tracked or to send

#### Scenario: Per-row durations mirror the day summaries

- **WHEN** a Ready row's to-send duration differs from its tracked total
- **THEN** the row SHALL display both durations and their signed difference


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

Each Ready task SHALL have an editable comment that is sent as the remote log's free-text note. It SHALL default to the comment of the most recent fetched remote log for that task's linked issue when one exists, and otherwise to the task name. The comment SHALL be the in-place title-to-send field on the collapsed row and SHALL be visible in the review phase before confirmation. Comments SHALL be page state for the day being reviewed and SHALL NOT be persisted locally and SHALL NOT rename the local task. An empty comment SHALL fall back to the task name rather than sending an empty note. The field SHALL have an accessible label. Sent and not-exportable rows SHALL show the local task name as text, not this editor.

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

