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

The browser-orchestrated remote adapter SHALL fetch only the configured credential's own time logs for the
selected local date and linked issues, following pagination, using the provider's current-user filter
(REQ-333) rather than a separate account-resolution request. The page SHALL issue one log fetch per
tracker for the day, covering all of that tracker's linked issues. The page SHALL display those logs
beside the corresponding task, label each as Linked or Unlinked from tracker-scoped local provenance, and
expose eligible reconciliation actions. Remote logs SHALL NOT automatically infer provenance, alter review
values, or block export. After a task's export finalizes, the page SHALL refresh that tracker's day logs
without discarding unrelated cached remote state; an explicit user retry of a failed log fetch SHALL
discard cached state for that tracker and fetch afresh.

#### Scenario: Same-day logs for the current account are displayed
- **WHEN** the current remote account has logs on a linked issue for the selected date
- **THEN** each log SHALL be displayed with stable details and an explicit Linked or Unlinked state

#### Scenario: No account request precedes the log fetch
- **WHEN** the page loads a day with linked tasks on a tracker
- **THEN** the tracker SHALL receive the log fetch without a preceding current-account request

#### Scenario: One log fetch per tracker
- **WHEN** a day has several linked tasks on one tracker
- **THEN** the page SHALL issue a single same-day log fetch for that tracker covering all their issues

#### Scenario: Other accounts are excluded
- **WHEN** other accounts have logs on the same issue and date
- **THEN** their logs SHALL NOT be displayed or reconciled

#### Scenario: Remote logs do not change export eligibility
- **WHEN** one or more contextual remote logs are displayed
- **THEN** review values and export eligibility SHALL remain controlled by local page state and provenance

#### Scenario: Remote-log fetch fails
- **WHEN** remote-log context cannot be loaded
- **THEN** the row SHALL show an accessible retryable error without claiming no logs exist or blocking an
  otherwise valid export

#### Scenario: Post-finalization refresh is a log fetch only
- **WHEN** a task's export finalizes successfully
- **THEN** the page SHALL refetch that tracker's day logs and SHALL NOT issue any other remote request for the refresh

### Requirement: REQ-119 Successful exports persist non-locking provenance and warn on repeats

For every remote log successfully created, linked, and locally finalized, the application SHALL persist a
user- and tracker-scoped export record containing task, local date, remote issue and log IDs, exact remote
duration, required-field values, covered completed local entry IDs, and timestamps. After provenance exists
for the task/date, the row SHALL be Sent and SHALL not create another remote log from that page. Removing
provenance after confirmed remote deletion SHALL make the task/day exportable again.

#### Scenario: Successful export records exact provenance
- **WHEN** the tracker creates a log and local finalization succeeds
- **THEN** provenance and covered-entry associations SHALL be persisted atomically with submitted values

#### Scenario: Existing provenance prevents another export
- **WHEN** a task/date already has finalized provenance
- **THEN** the row SHALL be Sent and Export SHALL NOT include it

#### Scenario: Previously exported entry is selected again
- **WHEN** a task/date already has finalized provenance
- **THEN** the row SHALL remain Sent and no repeat-export confirmation SHALL be offered

#### Scenario: New entries can be exported later
- **WHEN** entries are added after an earlier export and that export is subsequently deleted remotely
- **THEN** removal of its provenance SHALL make all completed entries for the task/day exportable again

#### Scenario: Confirmed deletion clears provenance
- **WHEN** a linked remote log is confirmed deleted or absent
- **THEN** its provenance and covered-entry associations SHALL be removed atomically

#### Scenario: Stale or foreign finalization is rejected
- **WHEN** finalization references data outside the authenticated user's matching task/day
- **THEN** the endpoint SHALL reject it without persisting partial provenance

### Requirement: REQ-120 Export reports per-task outcomes without claiming strict idempotency

The page SHALL create at most one remote log for each included Ready task. After all scheduled tasks reach
a terminal outcome, the confirmation dialog SHALL close and the day review SHALL refresh. A success toast
SHALL be shown only when every included task finalized locally; otherwise a warning toast SHALL be shown.
Successfully finalized rows SHALL become Sent, while failed or unattempted rows SHALL remain actionable.
A known finalized remote log ID SHALL never be recreated automatically.

#### Scenario: Entire batch succeeds
- **WHEN** every included task is remotely created and locally finalized
- **THEN** the dialog SHALL close, the refreshed rows SHALL be Sent, and a success toast SHALL appear

#### Scenario: Mixed batch outcomes remain visible
- **WHEN** at least one included task does not finalize successfully
- **THEN** the dialog SHALL close, successful rows SHALL be Sent, remaining rows SHALL be actionable, and a
  warning toast SHALL appear

#### Scenario: Excluded tasks are not sent
- **WHEN** a task is Sent, blocked, has zero duration, or lacks a selected activity
- **THEN** no remote creation SHALL be attempted for that task

#### Scenario: Local finalization fails after remote creation
- **WHEN** remote creation succeeds but local finalization fails
- **THEN** the refreshed row SHALL remain actionable and the batch SHALL produce a warning toast

#### Scenario: Known finalized operation is not automatically recreated
- **WHEN** finalization is retried with a known finalized remote log ID
- **THEN** the stored result SHALL be returned without creating another remote log

### Requirement: REQ-121 Browser orchestration supports direct and proxied client transport
The browser SHALL orchestrate remote reads, at most one remote creation per included task, and local finalization under `client` or `extension`. Both modes SHALL provide equivalent provider behavior, retries, deduplication, and per-task isolation. `client` SHALL call the tracker directly; `extension` SHALL use the approved desktop extension. Neither mode SHALL send tracker credentials through OSI APIs, and execution SHALL NOT silently fall back between modes.

#### Scenario: Client execution mode completes the two-phase operation
- **WHEN** a `client` tracker exports a task
- **THEN** the browser SHALL create the remote log directly and finalize its remote ID locally

#### Scenario: Server execution mode completes the same two-phase operation
- **WHEN** a stale client attempts export under `server`
- **THEN** validation SHALL reject the unsupported mode before remote creation

#### Scenario: Server execution-mode credentials remain ephemeral
- **WHEN** a stale request includes server-mode credentials
- **THEN** no remote-operation OSI endpoint SHALL accept or forward them

#### Scenario: Server execution-mode destination is restricted
- **WHEN** a caller targets a former remote proxy route
- **THEN** no generic or tracker-specific server proxy SHALL contact the supplied destination

#### Scenario: Extension completes the two-phase operation
- **WHEN** an `extension` tracker exports a task on a supported desktop browser
- **THEN** the extension SHALL create the remote log and the browser SHALL finalize its remote ID locally

#### Scenario: Extension is unavailable on mobile
- **WHEN** Remote Sync loads an `extension` tracker on mobile
- **THEN** affected rows SHALL expose an actionable unavailable state and SHALL NOT attempt or fall back to direct execution

#### Scenario: Transport failures remain isolated and retryable
- **WHEN** one supported transport operation fails
- **THEN** its task SHALL expose the appropriate retryable state without blocking unaffected tasks

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

### Requirement: REQ-229 Export runs through a review, running and report dialog

Activating Export SHALL open a confirmation listing only each included task's title and to-send duration,
plus the total to-send duration. Export SHALL include every Ready row with non-zero duration and a selected
activity. No remote request SHALL occur before confirmation. Cancelling SHALL close the dialog without
changing page state or tracker data. While export is running, duplicate confirmation SHALL be prevented.

#### Scenario: Review lists exactly what will be sent
- **WHEN** Export is activated with eligible rows
- **THEN** the dialog SHALL list each included title and duration plus their total

#### Scenario: Skipped tasks are stated with reasons
- **WHEN** the day contains ineligible tasks
- **THEN** their durable row states SHALL state why they are excluded without repeating them in the dialog

#### Scenario: Nothing is sent before confirmation
- **WHEN** the confirmation is open
- **THEN** no remote creation or local finalization SHALL have occurred

#### Scenario: Cancelling changes nothing
- **WHEN** the user cancels confirmation
- **THEN** no remote creation or local finalization SHALL occur

#### Scenario: Confirmation advances to the running phase
- **WHEN** the user confirms the batch
- **THEN** export SHALL begin and the dialog SHALL prevent dismissal or duplicate confirmation until complete

#### Scenario: Export is disabled when nothing is Ready
- **WHEN** no Ready row has non-zero duration and a selected activity
- **THEN** Export SHALL be disabled

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

