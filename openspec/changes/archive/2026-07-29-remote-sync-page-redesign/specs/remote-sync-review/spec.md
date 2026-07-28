## ADDED Requirements

### Requirement: REQ-223 Day review is presented as a dense table with expandable rows

The Remote Sync page SHALL present the day's tasks as a table with one collapsed summary row per task and an expandable detail region per row. The collapsed row SHALL show the task inclusion control, task name, linked issue reference, the selected activity control, the row's tracked and to-send durations, and the row's state as an icon **plus** translated text. The detail region SHALL contain the per-entry selection list, the editable export duration with its reset action, and the row's remote-log context. Rows that cannot be exported SHALL be grouped apart from exportable rows and SHALL keep their state and durations visible while collapsed. The untitled-entries bucket SHALL appear as a non-selectable row of the same table. Expansion state SHALL be per row, SHALL default to collapsed, and SHALL NOT affect entry selection, activity selection, or the export duration.

#### Scenario: Day opens with all rows collapsed
- **WHEN** the user opens the Remote Sync page for a day with several tasks
- **THEN** each task SHALL be rendered as one collapsed summary row showing its inclusion control, name, issue, activity, tracked and to-send durations and state text

#### Scenario: Expanding a row reveals its detail
- **WHEN** the user activates the expansion control of a task row
- **THEN** that row SHALL reveal its entry selection list, editable export duration and remote-log context while other rows remain collapsed

#### Scenario: Collapsing a row preserves review state
- **WHEN** the user collapses a row after changing its entry selection or export duration
- **THEN** those values SHALL be retained and SHALL still be reflected in the collapsed row's durations

#### Scenario: Blocked rows are grouped and still legible
- **WHEN** the day contains rows that are read-only for a stated reason
- **THEN** those rows SHALL be grouped separately from exportable rows and SHALL show their reason text and tracked duration without being expanded

#### Scenario: Untitled bucket is a non-selectable row
- **WHEN** untitled entries exist on the day
- **THEN** the table SHALL contain a row for them that contributes to the day total and offers no inclusion, duration or activity control

### Requirement: REQ-224 On-page day navigation

The Remote Sync page SHALL allow moving to another day without leaving the page: a previous-day action, a next-day action, a return-to-today action, and a calendar control that jumps to any chosen date. Navigation SHALL change the page's date route, SHALL recompute the day boundary in the user's configured timezone, and SHALL reload the day review for the new date. Unfinalized review state (entry selection, activity selection, export-duration overrides) belongs to the day being left and SHALL NOT leak into the new day. A date with no entries SHALL render the existing translated empty state. All navigation controls SHALL be keyboard operable and labelled with translated text.

#### Scenario: Move to the previous day
- **WHEN** the user activates the previous-day action
- **THEN** the page SHALL navigate to the preceding date and display that day's review

#### Scenario: Jump to an arbitrary date
- **WHEN** the user picks a date in the calendar control
- **THEN** the page SHALL navigate to that date, including dates with no time entries

#### Scenario: Empty day after navigation
- **WHEN** navigation lands on a date with no time entries
- **THEN** the page SHALL render the translated empty state and no task rows

#### Scenario: Review state does not carry over
- **WHEN** the user has overridden an export duration and then navigates to another day
- **THEN** the new day's rows SHALL be derived from their own data with default selections and no inherited override

### Requirement: REQ-225 Three reconciling day summaries with deltas

The Remote Sync page SHALL display three distinct day-level durations, each with a translated label: **day total** — the sum of every completed entry attributed to the day, including untitled time and rows that cannot be exported, matching the Timer view's day total; **tracked** — the sum of the selected entries of the rows included in the export; and **to send** — the sum of the export durations of the rows that will actually be pushed. The signed difference between tracked and to send SHALL be displayed. Time that is neither tracked nor sendable SHALL be surfaced as separate labelled amounts for blocked rows, excluded rows and untitled time, such that day total equals tracked plus blocked plus excluded plus untitled. A row that is included but not pushable SHALL count as blocked and SHALL contribute to neither tracked nor to send. Each task row SHALL show its own tracked and to-send durations with the same signed difference. The three day-level summaries SHALL appear once above the table and SHALL NOT be repeated in a table footer, so the same totals are not duplicated. All summaries SHALL update immediately when selection, activity or export duration changes.

#### Scenario: Three summaries are displayed and reconcile
- **WHEN** a day contains exportable, blocked, deselected and untitled time
- **THEN** the page SHALL display day total, tracked and to send, plus blocked, excluded and untitled amounts, and day total SHALL equal tracked plus blocked plus excluded plus untitled

#### Scenario: Day total matches the Timer view
- **WHEN** the user compares the Remote Sync day total with the Timer view's total for the same day
- **THEN** the two SHALL be equal

#### Scenario: Rounding up shows a positive delta
- **WHEN** the export durations of the pushable rows exceed their selected totals
- **THEN** the page SHALL display to send above tracked with a positive signed difference

#### Scenario: Rounding down shows a negative delta
- **WHEN** the export durations of the pushable rows are below their selected totals
- **THEN** the page SHALL display to send below tracked with a negative signed difference

#### Scenario: Included but blocked time is reported as blocked
- **WHEN** a row is included for export but is unlinked, has no activity, or has no usable configuration
- **THEN** its duration SHALL be reported as blocked and SHALL NOT be counted in tracked or to send

#### Scenario: Deselecting a task updates the summaries
- **WHEN** the user excludes an exportable task from the export
- **THEN** tracked and to send SHALL decrease, the excluded amount SHALL increase, and the day total SHALL stay unchanged

#### Scenario: Per-row durations mirror the day summaries
- **WHEN** a task row's export duration differs from its selected total
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

### Requirement: REQ-227 Possible-duplicate warning without blocking export

When a row's linked issue already has a fetched remote log for the selected date whose duration equals the row's export duration, the page SHALL display a translated warning identifying the colliding log, conveyed as text with an icon and never by colour alone. The warning SHALL be dismissible per row, SHALL NOT change entry selection, SHALL NOT alter the row's state, and SHALL NOT disable or block export. Absence of remote-log context, or a failed remote-log fetch, SHALL NOT produce a warning and SHALL NOT be presented as an absence of duplicates.

#### Scenario: Matching duration raises a warning
- **WHEN** a linked issue has a same-day remote log whose duration equals the row's export duration
- **THEN** the row SHALL display a translated possible-duplicate warning naming the colliding log

#### Scenario: Export remains available
- **WHEN** a possible-duplicate warning is displayed
- **THEN** the row SHALL remain pushable and the export action SHALL remain enabled

#### Scenario: Dismissing the warning
- **WHEN** the user dismisses a possible-duplicate warning
- **THEN** the warning SHALL be hidden for that row without changing selection, duration or state

#### Scenario: Different duration raises no warning
- **WHEN** the only same-day remote log on the issue has a different duration
- **THEN** no duplicate warning SHALL be displayed

#### Scenario: Failed log fetch does not imply no duplicates
- **WHEN** remote-log context could not be loaded for a row
- **THEN** no duplicate warning SHALL be shown and the page SHALL NOT state that no duplicate exists

### Requirement: REQ-228 Bulk selection of entries and tasks

The page SHALL provide bulk selection helpers: within a task, actions to select and deselect all of its entries; and for the day, actions to include and exclude all exportable tasks at once. Bulk actions SHALL apply only to rows the user can act on, SHALL leave read-only rows and the untitled bucket untouched, SHALL be reflected immediately in the day summaries, and SHALL be keyboard operable with translated labels.

#### Scenario: Select all entries of a task
- **WHEN** the user activates the select-all-entries action inside a manageable row
- **THEN** every completed entry of that task SHALL become selected and the row's tracked and to-send durations SHALL update

#### Scenario: Deselect all entries excludes the task
- **WHEN** the user deselects all entries of a task
- **THEN** the task SHALL be excluded from export with a translated explanation

#### Scenario: Include all exportable tasks
- **WHEN** the user activates the day-level include-all action
- **THEN** every exportable task SHALL be included and the day summaries SHALL update accordingly

#### Scenario: Bulk actions skip rows that cannot be exported
- **WHEN** a day-level bulk action is applied and the day contains read-only rows and the untitled bucket
- **THEN** those rows SHALL remain unchanged

## MODIFIED Requirements

### Requirement: REQ-116 Remote Sync page accessibility and i18n

The Remote Sync page SHALL meet WCAG 2.1 AA: row states and reasons SHALL be conveyed in text (not color alone), duration and field controls SHALL have accessible labels, asynchronous option loading and errors SHALL be announced via live regions, and all interactions SHALL be keyboard operable. Table semantics SHALL be conveyed programmatically, each row's expansion control SHALL expose its expanded state and be operable from the keyboard, and the day summaries and per-row deltas SHALL be labelled text rather than unlabelled numbers. Warnings, including the possible-duplicate warning, SHALL pair an icon with translated text and SHALL never rely on colour alone. All user-facing strings SHALL come from the i18n catalogs with `en`/`pl` parity, and stable `data-testid` hooks SHALL be provided for rows, states, durations, and field controls; the hooks in use before this redesign SHALL be preserved on the equivalent elements, and new hooks SHALL be added for the expansion control, the three day summaries, the blocked/excluded/untitled amounts, bulk actions, day navigation and the duplicate warning.

#### Scenario: States are announced as text
- **WHEN** a row is read-only for any reason
- **THEN** the reason SHALL be available as translated text to assistive technologies, not conveyed by styling alone

#### Scenario: Keyboard-only review
- **WHEN** a keyboard user tabs through the page
- **THEN** the day navigation, row expansion controls, bulk actions, rounded-duration fields, activity selects, and inline link actions SHALL all be reachable and operable without a pointer

#### Scenario: Expansion state is programmatically exposed
- **WHEN** assistive technology inspects a task row's expansion control
- **THEN** the control SHALL expose whether the row is expanded or collapsed and which region it controls

#### Scenario: Existing test hooks keep addressing the same data
- **WHEN** a test queries a `data-testid` that existed before the redesign
- **THEN** it SHALL resolve to the element carrying the same information in the new layout
