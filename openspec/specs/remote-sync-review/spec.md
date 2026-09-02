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
Each task row on the Remote Sync page SHALL expose exactly one effective state: **read-only with a translated stated reason** when the Task has no Project, the Project has no tracker, the tracker is soft-deleted/missing, the system type is unsupported, or a successful activity fetch yielded no activities; **read-only but linkable** when the tracker is usable but no remote issue reference exists; **temporarily unavailable with a retryable error** when required remote data failed to load; or **manageable** when every prerequisite is met. The "(no task)" bucket SHALL always be read-only. Read-only rows SHALL still display task name, entries, original duration, and any successfully loaded remote-log context.

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
- **WHEN** a listed Task is linked and all required remote data loaded successfully with at least one activity
- **THEN** its row SHALL be manageable and expose entry selection, duration, activity, and export controls

### Requirement: REQ-113 Original and editable rounded durations
Each task row SHALL display the **original duration**, calculated from all of that Task's entries for the day. Each manageable row SHALL additionally display the selected-entry total and a separately labeled editable export duration, pre-filled by applying the Project's active tracker's rounding rule once to the selected-entry total. Eligible completed entries SHALL be selected by default. A user override SHALL be retained when selection changes until explicitly reset. No selected entries or an export duration of `0` SHALL exclude the task from export. Reviewed values SHALL remain page state until a successful export is finalized.

#### Scenario: Rounded default is computed from selected entries
- **WHEN** selected entries sum to 50 minutes under an `up_15m` rule
- **THEN** the editable export duration SHALL default to 60 minutes while original and selected totals remain separately visible

#### Scenario: Exact multiple is unchanged
- **WHEN** the selected total is an exact multiple of the rounding increment
- **THEN** the default export duration SHALL equal the selected total

#### Scenario: Selection changes a non-overridden default
- **WHEN** the user changes entry selection before overriding the export duration
- **THEN** the application SHALL recompute the rounded default once from the new selected total

#### Scenario: Selection does not silently replace an override
- **WHEN** the user changes entry selection after overriding the export duration
- **THEN** the application SHALL retain the override until the user explicitly resets it

#### Scenario: Zero or empty selection excludes the task
- **WHEN** no entries are selected or the export duration is `0`
- **THEN** the task SHALL be excluded and display a translated explanation

#### Scenario: Invalid duration input reverts
- **WHEN** the user enters a value that cannot be normalized to a valid duration
- **THEN** the field SHALL revert to the previous value without emitting a change

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

The Remote Sync page SHALL meet WCAG 2.1 AA: row states and reasons SHALL be conveyed in text (not
color alone), duration and field controls SHALL have accessible labels, asynchronous option loading
and errors SHALL be announced via live regions, and all interactions SHALL be keyboard operable.
Table semantics SHALL be conveyed programmatically, each row's expansion control SHALL expose its
expanded state and be operable from the keyboard, and the day summaries and per-row deltas SHALL be
labelled text rather than unlabelled numbers. Warnings, including the possible-duplicate warning,
SHALL pair an icon with translated text and SHALL never rely on colour alone. All user-facing strings
SHALL come from the i18n catalogs with `en`/`pl` parity, and stable `data-testid` hooks SHALL be
provided for rows, states, durations, field controls, expansion controls, day summaries, day
navigation, the primary export action, and duplicate warnings. Hooks for removed day-level bulk
actions and separate Today and Pick date actions SHALL be retired; all other hooks in use before this
change SHALL remain on equivalent elements.

#### Scenario: States are announced as text

- **WHEN** a row is read-only for any reason
- **THEN** the reason SHALL be available as translated text to assistive technologies, not conveyed
  by styling alone

#### Scenario: Keyboard-only review

- **WHEN** a keyboard user tabs through the page
- **THEN** the compact day switcher, export action, row expansion controls, rounded-duration fields,
  activity selects, per-task selection actions, and inline link actions SHALL all be reachable and
  operable without a pointer

#### Scenario: Expansion state is programmatically exposed

- **WHEN** assistive technology inspects a task row's expansion control
- **THEN** the control SHALL expose whether the row is expanded or collapsed and which region it
  controls

#### Scenario: Existing test hooks keep addressing the same data

- **WHEN** a test queries a retained `data-testid` from before the header refactor
- **THEN** it SHALL resolve to the element carrying the same information in the new layout

#### Scenario: Removed controls are absent

- **WHEN** the Remote Sync page header is rendered
- **THEN** the retired day-level bulk, separate Today, and separate Pick date controls and their test
  hooks SHALL NOT be present

### Requirement: REQ-117 Users select entries for export without local locking

The application SHALL list every completed local entry beneath its task with an individually
operable selection control. Eligible entries SHALL be selected by default. A successful export SHALL
NOT prevent any selected entry from later being edited, deleted, reassigned, or selected again, and
SHALL NOT lock its Task.

#### Scenario: Eligible entries default to selected
- **WHEN** a manageable row first loads
- **THEN** all completed entries eligible for that row SHALL be selected

#### Scenario: User exports a subset
- **WHEN** the user deselects one or more entries and exports the task
- **THEN** the remote log and local provenance SHALL use only the remaining selected entries

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

For every remote log successfully created and locally finalized, the application SHALL persist a
user-scoped append-only export record containing task, local date, remote issue and log IDs, exact
export duration, required-field values, selected local entry IDs, the export request key, and timestamps.
Previously exported entries SHALL remain selectable. If any selected entry has provenance, the
application SHALL identify the affected task in the export review phase and require explicit
confirmation of that review before any remote creation; no separate repeat-confirmation dialog SHALL
be required in addition to it.

#### Scenario: Successful export records exact provenance
- **WHEN** the tracker creates a log and local finalization succeeds
- **THEN** one export record and its selected-entry associations SHALL be persisted atomically with
  the exact submitted values, the export request key, and returned remote log ID

#### Scenario: Previously exported entry is selected again
- **WHEN** the selection contains an entry associated with an earlier export
- **THEN** the export review phase SHALL mark the affected task as a repeat, warn about repeat-export
  risk, and require the user's confirmation while allowing the export to continue

#### Scenario: New entries can be exported later
- **WHEN** entries are added to a task/day after an earlier export
- **THEN** those entries SHALL be selectable and exportable in another remote log

#### Scenario: Stale or foreign finalization is rejected
- **WHEN** finalization references an entry not owned by the user, not completed, on another local
  date, or assigned to another task
- **THEN** the endpoint SHALL reject the request without persisting partial provenance

### Requirement: REQ-120 Export reports per-task outcomes without claiming strict idempotency

The page SHALL create at most one remote log for each included task in one batch action and SHALL
display a succeeded, failed, or needs-verification outcome per task without hiding successful
tasks. Tasks with no selected entries, zero duration, no activity, or unresolved prerequisites SHALL
be excluded and SHALL be listed as skipped with their reason. A known finalized remote log ID SHALL
never be recreated automatically. Failure after remote creation and before local finalization SHALL be
reported as needing verification; when the remote log identifier is known, a retry SHALL reuse the
attempt's export request key to complete the same logical export rather than create a duplicate, and
when it is not known the user SHALL be warned to verify in the tracker before retrying.

#### Scenario: Mixed batch outcomes remain visible
- **WHEN** some task exports succeed and others fail
- **THEN** the report SHALL show the outcome and actionable error for every attempted task

#### Scenario: Excluded tasks are not sent
- **WHEN** a task has no selection, zero duration, no activities, or an unresolved prerequisite
- **THEN** no remote create request SHALL be made for that task and it SHALL be listed as skipped with its reason

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

### Requirement: REQ-228 Bulk selection within a task

Within each manageable task, the page SHALL provide actions to select and deselect all of that
task's completed entries. These actions SHALL affect only that task, SHALL update the row and day
summaries immediately, and SHALL be keyboard operable with translated labels. The page SHALL NOT
provide day-level actions to include or exclude all exportable tasks at once; users SHALL retain
control through task inclusion and per-entry selection.

#### Scenario: Select all entries of a task

- **WHEN** the user activates the select-all-entries action inside a manageable row
- **THEN** every completed entry of that task SHALL become selected and the row's tracked and to-send
  durations SHALL update

#### Scenario: Deselect all entries excludes the task

- **WHEN** the user deselects all entries of a task
- **THEN** the task SHALL be excluded from export with a translated explanation

#### Scenario: Task bulk action does not affect other rows

- **WHEN** the user selects or deselects all entries within one task
- **THEN** selections for every other task and the untitled bucket SHALL remain unchanged

#### Scenario: Day-level bulk task actions are unavailable

- **WHEN** the user reviews a day containing multiple exportable tasks
- **THEN** no action to include all or exclude all exportable tasks SHALL be presented

### Requirement: REQ-229 Export runs through a review, running and report dialog

Activating the export action SHALL open a single dialog that carries the run through three phases without closing: **review**, **running**, and **report**. The dialog SHALL present one row per included task throughout all three phases so row identity never changes. In the review phase it SHALL state, per task, the linked issue, the selected activity, the tracked and to-send durations, the comment that will be written, a repeat indicator when any selected entry has prior provenance, and a possible-duplicate indicator when one applies; it SHALL also state the day's day-total, tracked and to-send summaries and list what is being skipped with its translated reason. No remote request SHALL be made before the user confirms. Cancelling the review SHALL leave all local review state unchanged and SHALL create nothing remotely. While running, the dialog SHALL NOT be dismissible except through the stop action. All phases SHALL be keyboard operable, use translated text, and expose stable `data-testid` hooks.

#### Scenario: Review lists exactly what will be sent
- **WHEN** the user activates the export action with several pushable tasks
- **THEN** the dialog SHALL open in the review phase listing each task's issue, activity, tracked and to-send durations and comment, together with the day's three summaries

#### Scenario: Skipped tasks are stated with reasons
- **WHEN** the day contains tasks that will not be exported
- **THEN** the review phase SHALL list them with their translated reason rather than omitting them silently

#### Scenario: Nothing is sent before confirmation
- **WHEN** the review phase is open
- **THEN** no remote time-entry creation and no finalization request SHALL have been made

#### Scenario: Cancelling changes nothing
- **WHEN** the user cancels the review phase
- **THEN** the dialog SHALL close, no remote log SHALL exist, and entry selection, activity selection and export durations SHALL be unchanged

#### Scenario: Confirmation advances to the running phase
- **WHEN** the user confirms the review
- **THEN** the dialog SHALL move to the running phase with the same rows and begin the sequential export

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

Each task SHALL have an editable comment that is sent as the remote log's free-text note. It SHALL default to the comment of the most recent fetched remote log for that task's linked issue when one exists, and otherwise to the task name. The comment SHALL be editable in the task's detail region and visible in the review phase before confirmation. Comments SHALL be page state for the day being reviewed and SHALL NOT be persisted locally. An empty comment SHALL fall back to the task name rather than sending an empty note. The comment field SHALL have an accessible label and translated hint text.

#### Scenario: Comment defaults to the task name
- **WHEN** a linked task has no fetched remote log with a comment
- **THEN** its export comment SHALL default to the task name

#### Scenario: Comment defaults to the last remote log comment
- **WHEN** the task's linked issue has a fetched remote log carrying a comment
- **THEN** its export comment SHALL default to that comment

#### Scenario: Edited comment is what gets sent
- **WHEN** the user edits a task's comment and confirms the export
- **THEN** the review phase SHALL have shown the edited value and the remote log SHALL be created with it

#### Scenario: Empty comment falls back
- **WHEN** the user clears a task's comment and exports
- **THEN** the remote log SHALL be created with the task name instead of an empty note

#### Scenario: Comments are not persisted locally
- **WHEN** the user edits comments and then reloads the page or navigates to another day
- **THEN** the edited values SHALL NOT be restored from local storage and the defaults SHALL apply again

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

### Requirement: REQ-222 One-tap rounding suggestions on a manageable row

A manageable task row SHALL offer one-tap alternatives for the editable export duration, derived from the selected-entry total and the Client configuration's rounding increment: the exact selected total, the previous multiple of the increment, and the next multiple of the increment. Duplicate alternatives SHALL be shown once; when the rule is `none` only the exact total SHALL be offered. Activating an alternative SHALL set the same per-task export-duration override as typing the value, so REQ-113 override retention and the reset action SHALL behave identically. Each alternative SHALL be keyboard operable, SHALL be labelled with translated text stating its duration, and SHALL expose a stable `data-testid`.

#### Scenario: Alternatives reflect the selected total and increment
- **WHEN** a manageable row under `nearest_15m` has a selected total of 1 hour 3 minutes
- **THEN** the row SHALL offer 1 hour 3 minutes, 1 hour 0 minutes and 1 hour 15 minutes as one-tap alternatives

#### Scenario: Choosing an alternative overrides the export duration
- **WHEN** the user activates one of the offered alternatives
- **THEN** the editable export duration SHALL become that value, SHALL be treated as an explicit user override, and SHALL be retained when the entry selection changes until the user resets it

#### Scenario: Reset returns to the configured rule
- **WHEN** the user resets the export duration after choosing an alternative
- **THEN** the row SHALL recompute the default by applying the Client configuration's rounding rule once to the current selected total

#### Scenario: Duplicate alternatives collapse
- **WHEN** the selected total is already an exact multiple of the increment
- **THEN** the row SHALL offer that single value rather than three identical alternatives

#### Scenario: Passthrough rule offers only the exact total
- **WHEN** the Client configuration's rounding rule is `none`
- **THEN** the row SHALL offer only the exact selected total as an alternative

#### Scenario: Alternatives are keyboard operable
- **WHEN** a keyboard user tabs to the export-duration field of a manageable row
- **THEN** every offered alternative SHALL be reachable and activatable without a pointer

