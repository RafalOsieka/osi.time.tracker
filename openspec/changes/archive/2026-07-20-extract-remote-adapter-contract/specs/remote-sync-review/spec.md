## MODIFIED Requirements

### Requirement: REQ-112 Explicit per-row state with stated reason

Each task row on the Remote Sync page SHALL expose exactly one effective state: **read-only with a
translated stated reason** when the Task has no Project or Client, the Client has no
`RemoteSystemConfig`, the system type is unsupported, or a successful activity fetch yielded no
activities; **read-only but linkable** when configuration is usable but no `RemoteIssueRef` exists;
**temporarily unavailable with a retryable error** when required remote data failed to load; or
**manageable** when every prerequisite is met. The "(no task)" bucket SHALL always be read-only.
Read-only rows SHALL still display task name, entries, original duration, and any successfully loaded
remote-log context.

#### Scenario: Task without a Project is read-only
- **WHEN** a listed Task has no Project
- **THEN** its row SHALL be read-only and display a translated reason indicating the missing
  Client/Project

#### Scenario: Client without a remote configuration is read-only
- **WHEN** a listed Task's Client has no `RemoteSystemConfig`
- **THEN** its row SHALL be read-only and display a translated reason indicating the missing remote
  configuration

#### Scenario: Unsupported system type is read-only
- **WHEN** a listed Task's configuration has a system type without an implemented adapter
- **THEN** its row SHALL be read-only and display a translated reason indicating the system is not
  supported yet

#### Scenario: Unlinked task is read-only but linkable
- **WHEN** a listed Task resolves to a usable remote-system configuration but has no `RemoteIssueRef`
- **THEN** its row SHALL be read-only for export controls while exposing an inline link action

#### Scenario: Fully eligible task is manageable
- **WHEN** a listed Task is linked and all required remote data loaded successfully with at least one
  activity
- **THEN** its row SHALL be manageable and expose entry selection, duration, activity, and export
  controls

### Requirement: REQ-114 Required remote fields with fetched options and pre-fill

For each otherwise manageable row, the Remote Sync page SHALL fetch the configured tracker's
required-field activity options through the neutral remote-tracker adapter contract once per resolved
scope and expose them in a labeled select. The select SHALL
prefer the task's most recently finalized activity, then a matching configuration default. Selected
values SHALL remain page state until finalization. A successful empty response SHALL produce a
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
- **WHEN** provenance provides a valid most-recent activity and a different config default exists
- **THEN** the previously used activity SHALL be selected

#### Scenario: Config default is the fallback
- **WHEN** no valid previously used activity exists and the config default matches an option
- **THEN** the config default SHALL be selected

#### Scenario: No matching pre-fill leaves the control unselected
- **WHEN** neither source matches a fetched option
- **THEN** the activity control SHALL remain unselected without an error

#### Scenario: Successful empty response prevents export
- **WHEN** the scope-scoped fetch succeeds with no activities
- **THEN** affected rows SHALL be read-only with a stated reason that no activity is available and
  their time will not be pushed to the remote system

#### Scenario: Options fetch fails and can be retried
- **WHEN** an activities request fails because of credentials, CORS, or network conditions
- **THEN** affected rows SHALL show an accessible retry action and SHALL NOT be classified as having
  no activities

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
export duration, required-field values, selected local entry IDs, and timestamps. Previously
exported entries SHALL remain selectable. If any selected entry has provenance, the application
SHALL identify the affected task and require explicit repeat-export confirmation before remote
creation.

#### Scenario: Successful export records exact provenance
- **WHEN** the tracker creates a log and local finalization succeeds
- **THEN** one export record and its selected-entry associations SHALL be persisted atomically with
  the exact submitted values and returned remote log ID

#### Scenario: Previously exported entry is selected again
- **WHEN** the selection contains an entry associated with an earlier export
- **THEN** the page SHALL warn about repeat-export risk and require confirmation while allowing the
  export to continue

#### Scenario: New entries can be exported later
- **WHEN** entries are added to a task/day after an earlier export
- **THEN** those entries SHALL be selectable and exportable in another remote log

#### Scenario: Stale or foreign finalization is rejected
- **WHEN** finalization references an entry not owned by the user, not completed, on another local
  date, or assigned to another task
- **THEN** the endpoint SHALL reject the request without persisting partial provenance

### Requirement: REQ-120 Export reports per-task outcomes without claiming strict idempotency

The page SHALL create at most one remote log for each included task in one batch action and SHALL
display a success, failure, or uncertain-finalization outcome per task without hiding successful
tasks. Tasks with no selected entries, zero duration, no activity, or unresolved prerequisites SHALL
be excluded. A known finalized remote log ID SHALL never be recreated automatically, but failure
after remote creation and before local finalization SHALL be reported as uncertain and SHALL warn
that retry can duplicate the remote log.

#### Scenario: Mixed batch outcomes remain visible
- **WHEN** some task exports succeed and others fail
- **THEN** the page SHALL show the outcome and actionable error for every attempted task

#### Scenario: Excluded tasks are not sent
- **WHEN** a task has no selection, zero duration, no activities, or an unresolved prerequisite
- **THEN** no remote create request SHALL be made for that task

#### Scenario: Local finalization fails after remote creation
- **WHEN** the tracker returns a remote log ID but local finalization fails
- **THEN** the task SHALL be marked uncertain, remote-log context SHALL be refreshable, and the user
  SHALL be warned that retry may create a duplicate

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
