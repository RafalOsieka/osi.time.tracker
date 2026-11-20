# remote-log-reconciliation

## Purpose

Define how users reconcile remote logs with local export records by explicitly matching or
deleting remote logs from the per-day Remote Sync review.

## Requirements

### Requirement: Tracker-scoped remote-log identity

The system SHALL identify a remote log by the user's tracker and remote log ID together. A remote
log SHALL be matched to at most one local export in a workspace, and all reconciliation operations SHALL
verify ownership of the tracker, task, day, and remote issue.

#### Scenario: Same provider ID on different trackers

- **WHEN** two trackers return the same remote log ID
- **THEN** each remote log SHALL remain independently matchable because its tracker identity differs

#### Scenario: Remote log is already matched

- **WHEN** the user attempts to match a remote log that already has an export record
- **THEN** the system SHALL reject the duplicate match without changing the existing export record

### Requirement: Unmatched remote log can be matched to a local task day

For a linked task, the Remote Sync details SHALL label fetched current-account remote logs Matched or Unmatched. An Unmatched remote log SHALL be matchable when its tracker, issue and local date match the task and the task has no finalized export that day. The confirmation SHALL show the remote duration and comment, the task title, and the completed local entries it will cover. Matching SHALL create an export record from the remote log's date, duration, issue, activity or required fields and id, with no tracker write.

#### Scenario: Eligible remote log is matched

- **WHEN** the user confirms matching an eligible Unmatched remote log
- **THEN** the export record SHALL cover all completed entries for that task/day and the remote log SHALL
  become Matched without a remote write

#### Scenario: Remote duration differs from local duration

- **WHEN** a matching remote log has a different duration from the completed local entries
- **THEN** linking SHALL preserve the remote duration and the review SHALL expose the tracked/exported delta

#### Scenario: Entry does not match the task

- **WHEN** the tracker, issue, account, or local date does not match the target task/day
- **THEN** linking SHALL be rejected without creating an export record

### Requirement: Matched remote log can be deleted with its export record

The user SHALL be able to confirm deletion of a Matched remote log after seeing its remote ID, duration, issue,
and comment. The application SHALL delete the remote log first and then atomically remove the export
record and covered-entry associations. A remote not-found response SHALL count as confirmed absence
and permit local cleanup. Any ambiguous remote result SHALL retain the export record.

#### Scenario: Remote deletion succeeds

- **WHEN** the tracker confirms deletion
- **THEN** the export record SHALL be removed and the task/day SHALL become exportable again

#### Scenario: Remote log is already absent

- **WHEN** deletion returns not found
- **THEN** the export record SHALL still be removed as an idempotent cleanup

#### Scenario: Deletion outcome is ambiguous

- **WHEN** the application cannot determine whether the tracker deleted the remote log
- **THEN** the export record SHALL remain and the user SHALL receive a translated error

### Requirement: Import-created export records are reconciled like exported ones

An export record from the remote-log import (`remote-log-import`) SHALL behave exactly like an export- or match-created one: the same tracker-scoped identity, the remote log labelled Matched in Remote Sync, deletable with its remote log through the confirmed-deletion flow, and its hours counted as Exported in the monthly report (`tracking-reports`). Since deletion removes the remote log first, a deleted imported log SHALL NOT come back on a later import.

#### Scenario: Imported remote log shows as Matched

- **WHEN** the user opens Remote Sync for a day that was backfilled by import
- **THEN** the day's remote logs SHALL be labelled Matched and the task rows SHALL be Sent

#### Scenario: Imported remote log counts as Exported hours

- **WHEN** the monthly report fetches range logs for a backfilled month
- **THEN** those logs SHALL count as Exported hours, not Direct

#### Scenario: Deleting an imported log

- **WHEN** the user confirms deletion of a Matched remote log that was created by import
- **THEN** the remote log SHALL be deleted first and the export record and association removed atomically, exactly as for an exported remote log

#### Scenario: Deleted imported log does not come back

- **WHEN** an imported remote log was deleted through the confirmed-deletion flow and the same range is imported again
- **THEN** the range fetch SHALL no longer return that log and nothing SHALL be recreated for it
