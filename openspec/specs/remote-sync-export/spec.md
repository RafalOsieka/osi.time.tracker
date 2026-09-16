# remote-sync-export Specification

## Purpose
Define how a reviewed day is exported to the configured tracker from the Remote Sync page: the server-side day-review aggregate the page reads, the task/day selection rule with no local locking, same-day current-account remote logs as context, browser orchestration under `client` or `extension` transport, the confirm/run/report dialog, per-task outcome reporting, non-locking export provenance, and the deterministic export request key that makes retries reconcilable. The page layout, row states, durations and editors are specified in `remote-sync-review`.

## Requirements

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


