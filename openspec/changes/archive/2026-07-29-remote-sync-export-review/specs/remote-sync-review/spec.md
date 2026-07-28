## ADDED Requirements

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

## MODIFIED Requirements

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
