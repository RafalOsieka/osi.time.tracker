## MODIFIED Requirements

### Requirement: REQ-118 Current-account remote logs provide same-day context

The browser-orchestrated remote adapter SHALL resolve the authenticated remote account and fetch that
account's time logs for the selected local date and linked issues, following pagination. The page SHALL
display those logs beside the corresponding task, label each as Linked or Unlinked from tracker-scoped
local provenance, and expose eligible reconciliation actions. Remote logs SHALL NOT automatically infer
provenance, alter review values, or block export.

#### Scenario: Same-day logs for the current account are displayed
- **WHEN** the current remote account has logs on a linked issue for the selected date
- **THEN** each log SHALL be displayed with stable details and an explicit Linked or Unlinked state

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

## REMOVED Requirements

### Requirement: REQ-227 Possible-duplicate warning without blocking export

**Reason**: Duration equality is insufficient evidence of duplication and creates speculative noise.

**Migration**: Display explicit Linked or Unlinked provenance state and use reconciliation actions instead.

### Requirement: REQ-230 Per-task progress and a stop that never interrupts a task

**Reason**: The compact confirmation no longer carries a detailed running phase.

**Migration**: Prevent duplicate submission while the batch runs, then refresh the durable review state.

### Requirement: REQ-231 Report groups outcomes and offers per-task retry

**Reason**: Outcomes belong on the refreshed review, with a batch-level toast rather than a report phase.

**Migration**: Leave unsuccessful rows actionable for a later normal export attempt.
