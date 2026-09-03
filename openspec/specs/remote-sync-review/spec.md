# remote-sync-review Specification

## Purpose

Define the per-day Remote Sync page that reviews a day's tasks and exports their
time to the configured tracker: listing every task with entries that day, deriving
each row's state and reason, computing original and editable rounded durations,
fetching required remote fields, aggregating the review server-side, and
orchestrating direct or proxied export with non-locking provenance.
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
required-field activity options through the neutral remote-tracker adapter contract once per resolved
scope and expose them in a labeled select. The select SHALL
prefer the task's most recently finalized activity when it matches a fetched option, and SHALL
otherwise remain unselected. The page SHALL NOT pre-fill from tracker-level required-field defaults.
Selected values SHALL remain page state until finalization. A successful empty response SHALL produce a
read-only no-activity state stating that no activity is available and the task will not be pushed.
A failed request SHALL produce a translated accessible retryable error without blocking unrelated
rows.

#### Scenario: Activities are fetched and selectable
- **WHEN** the page loads with otherwise manageable rows whose configuration has a registered adapter
- **THEN** each row SHALL offer the activities fetched for its resolved activity scope

#### Scenario: Rows sharing a scope reuse one fetch
- **WHEN** multiple rows resolve to the same activity scope
- **THEN** the adapter SHALL fetch activities once and reuse the result

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

### Requirement: REQ-115 Day-review data is aggregated server-side and user-scoped
The application SHALL provide an authenticated read endpoint that returns the day-review aggregate for a given date: per task with entries that day — task identity and name, project name, optional tracker name, the summed original duration, the Tracker configuration surface needed for state derivation (system type, rounding rule, execution mode, base URL, tracker id), and the remote issue reference (remote issue ID and cached title) when present — plus the untitled-entries total. The tracker configuration surface SHALL NOT include required-field defaults. All data SHALL be scoped to the authenticated user; durations SHALL be returned unrounded; timestamps SHALL be ISO strings; no credential material SHALL ever be included. Invalid dates SHALL be rejected with a `{ messageKey, params }` validation error. The payload SHALL NOT include a Client identity or `clientName`.

#### Scenario: Aggregate returns one row per task with tracker and link state
- **WHEN** an authenticated user requests the day review for a valid date
- **THEN** the response SHALL contain one row per Task with entries that day, carrying the summed duration, resolvable tracker surface when present, and issue reference when present

#### Scenario: Foreign data is never included
- **WHEN** another user has entries on the same date
- **THEN** the response SHALL contain only the authenticated user's tasks and entries

#### Scenario: Invalid date is rejected
- **WHEN** the date parameter is missing or not a valid calendar date
- **THEN** the endpoint SHALL respond with a 422 `{ messageKey, params }` validation error

#### Scenario: No credentials in the payload
- **WHEN** the day review is returned for projects with trackers
- **THEN** the payload SHALL include no API secret or credential material

#### Scenario: No required-field defaults in the payload
- **WHEN** the day review is returned for projects with trackers
- **THEN** the tracker configuration surface SHALL NOT include `requiredFieldDefaults`

### Requirement: REQ-116 Remote Sync page accessibility and i18n

The Remote Sync page SHALL meet WCAG 2.1 AA: row kinds and reasons SHALL be conveyed in text (not color alone), duration and field controls SHALL have accessible labels, asynchronous option loading and errors SHALL be announced via live regions, and all interactions SHALL be keyboard operable. Each row's expansion control SHALL expose its expanded state and be operable from the keyboard, and the day summaries and per-row duration cluster SHALL be labelled text rather than unlabelled numbers. Warnings, including the possible-duplicate warning, SHALL pair an icon with translated text and SHALL never rely on colour alone. All user-facing strings SHALL come from the i18n catalogs with `en`/`pl` parity, and stable `data-testid` hooks SHALL be provided for rows, kind badges, durations, field controls, expansion controls, the reserved actions slot, day summaries, day navigation, the primary export action, detail panes, and duplicate warnings. Hooks for the include checkbox, State column, per-entry selection, rounding suggestions, day-level bulk actions, and separate Today and Pick date actions SHALL be retired.

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
- **THEN** it SHALL resolve to the element carrying the same information in the new layout (row, durations, activity, expansion, summaries, export, duplicate warning)

#### Scenario: Removed controls are absent

- **WHEN** the Remote Sync page is rendered
- **THEN** include checkboxes, a State column, per-entry selection, rounding-suggestion actions, and their test hooks SHALL NOT be present

### Requirement: REQ-117 Users select entries for export without local locking

A Ready task's export SHALL include every completed local entry attributed to that task on the requested local date. The page SHALL NOT offer per-entry selection; the task/day is the selection. A successful export SHALL NOT prevent any of those entries from later being edited, deleted, or reassigned, and SHALL NOT lock its Task. Sent rows SHALL NOT be exported again from this page.

#### Scenario: Eligible entries default to selected

- **WHEN** a Ready row is exported
- **THEN** every completed entry of that task for the day SHALL be included in the remote log and local provenance

#### Scenario: User exports a subset

- **WHEN** a Ready row is expanded
- **THEN** its local entries SHALL be listed without selection controls and the user SHALL NOT be able to export a subset of that task's day entries from this page

#### Scenario: Exported local data remains mutable

- **WHEN** an export has been finalized successfully
- **THEN** normal authorized entry and task mutations SHALL remain available

### Requirement: REQ-118 Current-account remote logs provide same-day context

The browser-orchestrated remote adapter SHALL resolve the authenticated remote account and fetch
that account's time logs for the selected local date and linked issues, following pagination. The
page SHALL display those logs beside the corresponding task as informational context only. Remote
logs SHALL NOT alter selection, infer local-entry provenance, or block export.

#### Scenario: Same-day logs for the current account are displayed
- **WHEN** the current remote account has logs on a linked issue for the selected date
- **THEN** those logs SHALL be displayed with stable identifying details beside that task

#### Scenario: Other accounts are excluded
- **WHEN** other accounts have logs on the same issue and date
- **THEN** their logs SHALL NOT be displayed

#### Scenario: Remote logs do not change export eligibility
- **WHEN** one or more contextual remote logs are displayed
- **THEN** local entries SHALL remain selected according to local page state and export SHALL remain
  available

#### Scenario: Remote-log fetch fails
- **WHEN** remote-log context cannot be loaded
- **THEN** the row SHALL show an accessible retryable context error without misrepresenting that no
  logs exist or blocking an otherwise valid export

### Requirement: REQ-119 Successful exports persist non-locking provenance and warn on repeats

For every remote log successfully created and locally finalized, the application SHALL persist a user-scoped append-only export record containing task, local date, remote issue and log IDs, exact export duration, required-field values, selected local entry IDs (all completed entries of that task/day), the export request key, and timestamps. After that record exists for the task/date, the row SHALL be Sent. Export SHALL NOT create another remote log for that task/date from this page, including when later local entries are added. The review phase SHALL NOT offer a repeat-export confirmation for previously exported entries because those rows are not included. Stale or foreign finalization SHALL still be rejected without persisting partial provenance.

#### Scenario: Successful export records exact provenance

- **WHEN** the tracker creates a log and local finalization succeeds
- **THEN** one export record and its selected-entry associations SHALL be persisted atomically with the exact submitted values, the export request key, and returned remote log ID

#### Scenario: Previously exported entry is selected again

- **WHEN** a task/date already has finalized provenance
- **THEN** the row SHALL be Sent, Export SHALL NOT include it, and no repeat-export confirmation SHALL be required

#### Scenario: New entries can be exported later

- **WHEN** entries are added to a task/day after an earlier export
- **THEN** the row SHALL remain Sent and those entries SHALL NOT be exported from this page until a future undo (out of scope here) clears provenance

#### Scenario: Stale or foreign finalization is rejected

- **WHEN** finalization references an entry not owned by the user, not completed, on another local date, or assigned to another task
- **THEN** the endpoint SHALL reject the request without persisting partial provenance

### Requirement: REQ-120 Export reports per-task outcomes without claiming strict idempotency

The page SHALL create at most one remote log for each included Ready task in one batch action and SHALL display a succeeded, failed, or needs-verification outcome per task without hiding successful tasks. Tasks that are Sent, have zero duration, have no activity, or have unresolved prerequisites SHALL be excluded and SHALL be listed as skipped with their reason. A known finalized remote log ID SHALL never be recreated automatically. Failure after remote creation and before local finalization SHALL be reported as needing verification; when the remote log identifier is known, a retry SHALL reuse the attempt's export request key to complete the same logical export rather than create a duplicate, and when it is not known the user SHALL be warned to verify in the tracker before retrying.

#### Scenario: Mixed batch outcomes remain visible

- **WHEN** some task exports succeed and others fail
- **THEN** the report SHALL show the outcome and actionable error for every attempted task

#### Scenario: Excluded tasks are not sent

- **WHEN** the day contains Sent tasks or tasks with no activity, zero duration, or unresolved prerequisites
- **THEN** no remote create request SHALL be made for those tasks and they SHALL be listed as skipped with their reason

#### Scenario: Local finalization fails after remote creation
- **WHEN** the tracker returns a remote log ID but local finalization fails
- **THEN** the task SHALL be marked as needing verification, remote-log context SHALL be refreshable,
  and a retry SHALL finalize that same remote log under the same export request key instead of creating a duplicate

#### Scenario: Known finalized operation is not automatically recreated
- **WHEN** the same finalized export operation is retried with its known remote log ID
- **THEN** the application SHALL return the stored result without creating another remote log

### Requirement: REQ-121 Browser orchestration supports direct and proxied client transport

The browser SHALL orchestrate remote reads, one remote creation per included task, and local finalization regardless of execution mode. The remote client SHALL support sending remote requests directly from the browser (`client` execution mode) or through authenticated Nitro endpoints (`server` execution mode) selected by the remote-system configuration's `executionMode`. Both modes SHALL provide equivalent account resolution, activities, paginated time logs, time-entry creation, error classification, retry behavior, deduplication, per-task outcome isolation, and identical provider-quirk handling by delegating to the same provider adapter. In `server` execution mode Nitro SHALL authorize the local user, restrict requests to that user's configured remote origin, and SHALL NOT persist or log forwarded remote credentials.

#### Scenario: Client execution mode completes the two-phase operation
- **WHEN** a remote configuration selects `client` execution mode and the user exports a task
- **THEN** the browser SHALL create the tracker log directly and finalize the returned remote ID through the authenticated local endpoint

#### Scenario: Server execution mode completes the same two-phase operation
- **WHEN** a remote configuration selects `server` execution mode and the user exports a task
- **THEN** the browser SHALL request remote creation through the Nitro endpoint and finalize the returned remote ID through the same authenticated local endpoint

#### Scenario: Server execution-mode credentials remain ephemeral
- **WHEN** Nitro forwards a remote request containing remote credentials
- **THEN** it SHALL use them only for that request and SHALL NOT persist them or include them in logs

#### Scenario: Server execution-mode destination is restricted
- **WHEN** a server execution-mode request targets an origin other than the authenticated user's configured remote system origin
- **THEN** Nitro SHALL reject the request without contacting the supplied destination

#### Scenario: Transport failures remain isolated and retryable
- **WHEN** either execution mode fails for one task or shared request scope
- **THEN** the page SHALL expose the same retryable state and SHALL NOT block unaffected tasks

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
- **THEN** that row SHALL reveal REQ-304 details while other rows remain collapsed and the collapsed duration cluster SHALL stay unchanged

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

### Requirement: REQ-304 Two-pane expanded row details

Expanding a Remote Sync task row SHALL reveal extra information only: a read-only list of that task's local completed entries for the day, and the same-day current-account remote time logs for the linked issue (REQ-118, REQ-226). The expanded region SHALL NOT contain export-duration editors, rounding alternatives, export-comment editors, or per-entry selection controls. On viewports at or above the shell desktop rail breakpoint the two lists SHALL appear side by side (local entries first, remote logs second). Below that breakpoint they SHALL stack, local entries above remote logs. A row without a linked issue SHALL omit the remote-logs pane rather than show an empty column. A possible-duplicate warning (REQ-227) SHALL appear above both panes when it applies. Loading, retryable error, and empty remote-log states SHALL remain in the remote-logs pane.

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

#### Scenario: Duplicate warning sits above the panes

- **WHEN** a possible-duplicate warning applies to an expanded row
- **THEN** the warning SHALL be shown above the local-entry and remote-log panes

### Requirement: REQ-224 On-page day navigation

The Remote Sync page SHALL present a stable translated page title and a compact day switcher in its
header. The switcher SHALL provide previous-day and next-day actions around a short localized date
label that opens a calendar for jumping to any chosen date. The primary Export action SHALL follow
the switcher in the same header action area. Navigation SHALL change the page's date route, SHALL
recompute the day boundary in the user's configured timezone, and SHALL reload the day review for
the new date. Unfinalized review state belongs to the day being left and SHALL NOT leak into the new
day. A date with no entries SHALL render the existing translated empty state. All controls SHALL be
keyboard operable and labelled for assistive technology.

#### Scenario: Header presents the compact day switcher and primary action

- **WHEN** the user opens the Remote Sync page
- **THEN** the header SHALL show the stable page title, previous-day action, short localized date
  label, next-day action, and Export action without a long date in the title

#### Scenario: Move to the previous day

- **WHEN** the user activates the previous-day action
- **THEN** the page SHALL navigate to the preceding date and display that day's review

#### Scenario: Jump to an arbitrary date

- **WHEN** the user activates the date label and picks a date in the calendar
- **THEN** the page SHALL navigate to that date, including dates with no time entries

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

### Requirement: REQ-229 Export runs through a review, running and report dialog

Activating Export SHALL open a single dialog that carries the run through three phases without closing: **review**, **running**, and **report**. Export SHALL include every Ready row with a non-zero to-send duration and a selected activity. The dialog SHALL present one row per included task throughout all three phases so row identity never changes. In the review phase it SHALL state, per task, the linked issue, the selected activity, the tracked and to-send durations, and the comment that will be written; it SHALL also state the day's day-total, tracked and to-send summaries and list what is being skipped with its translated reason (Sent, blocked, zero duration, missing activity). No remote request SHALL be made before the user confirms. Cancelling the review SHALL leave all local review state unchanged and SHALL create nothing remotely. While running, the dialog SHALL NOT be dismissible except through the stop action. All phases SHALL be keyboard operable, use translated text, and expose stable `data-testid` hooks.

#### Scenario: Review lists exactly what will be sent

- **WHEN** the user activates Export with several Ready tasks
- **THEN** the dialog SHALL open in the review phase listing each task's issue, activity, tracked and to-send durations and comment, together with the day's three summaries

#### Scenario: Skipped tasks are stated with reasons

- **WHEN** the day contains Sent or blocked tasks
- **THEN** the review phase SHALL list them with their translated reason rather than omitting them silently

#### Scenario: Nothing is sent before confirmation

- **WHEN** the review phase is open
- **THEN** no remote time-entry creation and no finalization request SHALL have been made

#### Scenario: Cancelling changes nothing

- **WHEN** the user cancels the review phase
- **THEN** the dialog SHALL close, no remote log SHALL exist, and activity selection and export durations SHALL be unchanged

#### Scenario: Confirmation advances to the running phase

- **WHEN** the user confirms the review
- **THEN** the dialog SHALL move to the running phase with the same rows and begin the sequential export

#### Scenario: Export is disabled when nothing is Ready

- **WHEN** the day has no Ready row with a non-zero to-send duration and a selected activity
- **THEN** Export SHALL be disabled

### Requirement: REQ-230 Per-task progress and a stop that never interrupts a task

During the running phase the dialog SHALL show a per-task status advancing through queued, creating the remote log, finalizing locally, and a terminal succeeded, failed or needs-verification status, plus an overall completed-of-total indicator announced through a polite live region. A stop action SHALL be available while running; it SHALL prevent any further task from starting and SHALL NOT interrupt the task currently in flight. Tasks that were never attempted SHALL be reported as not attempted rather than as failures. When the last task reaches a terminal status, the dialog SHALL advance to the report phase.

#### Scenario: Each task reports its own progress
- **WHEN** the export is running over several tasks
- **THEN** each row SHALL show its own current status and the dialog SHALL show how many tasks of the total have completed

#### Scenario: Progress is announced accessibly
- **WHEN** the completed-of-total count changes
- **THEN** the change SHALL be announced through a polite live region

#### Scenario: Stop halts before the next task
- **WHEN** the user activates the stop action while a task is in flight
- **THEN** the in-flight task SHALL be allowed to finish and no further task SHALL be started

#### Scenario: Unattempted tasks are not reported as failures
- **WHEN** the run was stopped before some tasks were attempted
- **THEN** those tasks SHALL be reported as not attempted, distinctly from failed tasks

#### Scenario: Completion advances to the report
- **WHEN** every attempted task has reached a terminal status
- **THEN** the dialog SHALL advance to the report phase without losing any row

### Requirement: REQ-231 Report groups outcomes and offers per-task retry

The report phase SHALL group the run's rows as succeeded, failed and needs-verification, SHALL never hide successful tasks, and SHALL show each task's actionable translated message. A needs-verification row SHALL be presented at warning level, SHALL state the known remote log identifier, and SHALL offer a link to that log in the configured tracker when a base URL is available. Failed and needs-verification rows SHALL offer a retry action that re-runs **only that task** with the same inputs, without re-confirming the whole batch, replacing that row's outcome in place. Retrying a needs-verification row SHALL attempt to complete the same logical export rather than start a new one. Succeeded rows SHALL identify the created remote log. Closing the report SHALL refresh the day review so provenance and remote-log context reflect the run.

#### Scenario: Mixed outcomes are all visible
- **WHEN** a run contains successes, failures and a needs-verification task
- **THEN** the report SHALL show all three groups with every attempted task and its translated message

#### Scenario: Retry re-runs a single task
- **WHEN** the user retries a failed task from the report
- **THEN** only that task SHALL be exported again, its row status SHALL be replaced in place, and no other task SHALL be re-sent

#### Scenario: Retry does not re-confirm the batch
- **WHEN** the user retries one task from the report
- **THEN** the review phase SHALL NOT be shown again and no additional repeat confirmation SHALL be required

#### Scenario: Needs-verification row is actionable
- **WHEN** a task's remote log was created but local finalization failed
- **THEN** its report row SHALL warn in text with an icon, state the remote log identifier, and offer a link to that log when the configuration provides a base URL

#### Scenario: Closing the report refreshes the day
- **WHEN** the user closes the report phase
- **THEN** the day review SHALL be refreshed so provenance and remote-log context reflect what was exported

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

### Requirement: REQ-233 Export request key makes a retry reconcilable

For each task attempt the client SHALL generate a deterministic export request key from the task, local date, selected entry identifiers and export duration, and SHALL send it with finalization. The server SHALL persist the key with the export record, scoped and unique per user. When finalization is received with a key that already has a stored export record, the server SHALL return that stored result instead of persisting a second record. A retry after a failed finalization SHALL reuse the same key and the already-known remote log identifier so it completes the same logical export instead of creating another remote log. When the remote log identifier was never received by the client, the attempt SHALL remain reported as needing verification and the user SHALL be told to verify in the tracker before retrying. Export records created before this change SHALL remain valid without a key.

#### Scenario: Finalization stores the request key
- **WHEN** a task export is finalized successfully
- **THEN** the persisted export record SHALL carry the request key generated for that attempt

#### Scenario: Repeated finalization with the same key is reconciled
- **WHEN** finalization is received again with a key that already has a stored export record
- **THEN** the server SHALL return the stored result and SHALL NOT persist a second export record

#### Scenario: Retry after a failed finalization creates no second remote log
- **WHEN** the user retries a needs-verification task whose remote log identifier is known
- **THEN** the retry SHALL finalize the same remote log under the same key and SHALL NOT create another remote log

#### Scenario: Changing the export changes the key
- **WHEN** the user alters the entry selection or export duration and exports the same task again
- **THEN** the generated key SHALL differ and the export SHALL be treated as a new, separate export

#### Scenario: Unknown remote log stays unverified
- **WHEN** a remote creation attempt failed before the client learned a remote log identifier
- **THEN** the task SHALL be reported as needing verification in the tracker and SHALL NOT be reconciled automatically

#### Scenario: Legacy records without a key remain valid
- **WHEN** export records persisted before this change are read
- **THEN** they SHALL remain valid and reconciliation SHALL apply only to records carrying a key

