## MODIFIED Requirements

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
