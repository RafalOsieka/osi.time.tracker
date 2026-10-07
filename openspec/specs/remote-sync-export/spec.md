# remote-sync-export Specification

## Purpose
Define how a reviewed day is exported to the configured tracker from the Remote Sync page: the server-side day-review aggregate the page reads, the task/day selection rule with no local locking, same-day current-account remote logs as context, browser orchestration under `client` or `extension` transport, the confirm/run/report dialog, per-task outcome reporting, non-locking export provenance, and the deterministic export request key that makes retries reconcilable. The page layout, row states, durations and editors are specified in `remote-sync-review`.

## Requirements

### Requirement: REQ-115 Day-review data is aggregated server-side and user-scoped
An authenticated endpoint SHALL return a date's day review: per task with entries that day, its id and name, project and optional tracker name, unrounded total, the tracker settings its state needs (system type, rounding rule, direct-browser capability, base URL, id) and any remote issue reference, and the untitled total. It SHALL be user-scoped with ISO timestamps, and SHALL NOT include credentials, required-field defaults or a client. An invalid date SHALL get a `{ messageKey, params }` error.

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


### Requirement: REQ-117 A task's whole day is exported without local locking

A Ready task's export SHALL include every completed local entry attributed to that task on the requested local date. The page SHALL NOT offer per-entry selection; the task/day is the selection. A successful export SHALL NOT prevent any of those entries from later being edited, deleted, or reassigned, and SHALL NOT lock its Task. Sent rows SHALL NOT be exported again from this page.

#### Scenario: Every completed entry of the day is included

- **WHEN** a Ready row is exported
- **THEN** every completed entry of that task for the day SHALL be included in the remote log and local provenance

#### Scenario: No subset of a day can be exported

- **WHEN** a Ready row is expanded
- **THEN** its local entries SHALL be listed without selection controls and the user SHALL NOT be able to export a subset of that task's day entries from this page

#### Scenario: Exported local data remains mutable

- **WHEN** an export has been finalized successfully
- **THEN** normal authorized entry and task mutations SHALL remain available


### Requirement: REQ-118 Current-account remote logs provide same-day context

The page SHALL fetch only the credential's own logs for the date and linked issues via the current-user filter (REQ-333) without an account request, one paginated fetch per tracker. Each log SHALL show by its task, Linked or Unlinked per tracker-scoped provenance, with eligible reconciliation actions, and SHALL NOT create provenance, change review values or block export. Refreshing follows REQ-485.

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

### Requirement: REQ-485 Refreshing the day's remote logs
After a task's export finalizes, the page SHALL refetch that tracker's day logs without discarding unrelated cached remote state. An explicit retry of a failed log fetch SHALL discard that tracker's cached state and fetch afresh.

#### Scenario: Post-finalization refresh is a log fetch only
- **WHEN** a task's export finalizes successfully
- **THEN** the page SHALL refetch that tracker's day logs and SHALL NOT issue any other remote request for the refresh


### Requirement: REQ-119 Successful exports persist non-locking provenance

For every remote log created, linked and finalized, the application SHALL persist a user- and tracker-scoped export record: task, local date, remote issue and log ids, exact remote duration, required-field values, covered completed entry ids, and timestamps. With provenance for the task/date, the row SHALL be Sent and SHALL NOT create another remote log from that page. Removing provenance after confirmed remote deletion SHALL make the task/day exportable again.

#### Scenario: Successful export records exact provenance
- **WHEN** the tracker creates a log and local finalization succeeds
- **THEN** provenance and covered-entry associations SHALL be persisted atomically with submitted values

#### Scenario: Existing provenance prevents another export
- **WHEN** a task/date already has finalized provenance
- **THEN** the row SHALL be Sent and Export SHALL NOT include it

#### Scenario: Sent row offers no repeat export
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


### Requirement: REQ-121 Browser orchestration supports direct and extension transport
The browser SHALL orchestrate remote reads, at most one remote creation per included task, and local finalization under `client` or `extension`. Both modes SHALL provide equivalent provider behavior, retries, deduplication, and per-task isolation. `client` SHALL call the tracker directly; `extension` SHALL use the approved desktop extension. Neither mode SHALL send tracker credentials through OSI APIs, and execution SHALL NOT silently fall back between modes.

#### Scenario: Client execution mode completes the two-phase operation
- **WHEN** a `client` tracker exports a task
- **THEN** the browser SHALL create the remote log directly and finalize its remote ID locally

#### Scenario: Extension completes the two-phase operation
- **WHEN** an `extension` tracker exports a task on a supported desktop browser
- **THEN** the extension SHALL create the remote log and the browser SHALL finalize its remote ID locally

#### Scenario: Extension is unavailable on mobile
- **WHEN** Remote Sync loads an `extension` tracker on mobile
- **THEN** affected rows SHALL expose an actionable unavailable state and SHALL NOT attempt or fall back to direct execution

#### Scenario: Transport failures remain isolated and retryable
- **WHEN** one supported transport operation fails
- **THEN** its task SHALL expose the appropriate retryable state without blocking unaffected tasks


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


### Requirement: REQ-233 Export request key makes a retry reconcilable

Each task attempt SHALL carry a deterministic request key from the task, local date, entry ids and export duration, sent with finalization and stored with the export record, unique per user. Finalizing with a key that already has a record SHALL return that record instead of storing another. A retry after failed finalization SHALL reuse the key and known remote log id, with no second remote log. Export records without a key SHALL stay valid; key reconciliation applies only to keyed records.

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

#### Scenario: Legacy records without a key remain valid
- **WHEN** export records without a request key are read
- **THEN** they SHALL remain valid and reconciliation SHALL apply only to records carrying a key

### Requirement: REQ-484 An export without a known remote log stays unverified
When the client never received the remote log id of an attempt, the task SHALL stay reported as needing verification, SHALL NOT be reconciled automatically, and the user SHALL be told to check the tracker before retrying.

#### Scenario: Unknown remote log stays unverified
- **WHEN** a remote creation attempt failed before the client learned a remote log identifier
- **THEN** the task SHALL be reported as needing verification in the tracker and SHALL NOT be reconciled automatically


