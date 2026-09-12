# remote-entry-reconciliation Specification

## Purpose

Define how users reconcile tracker time entries with local export provenance by explicitly linking or
deleting entries from the per-day Remote Sync review.

## Requirements

### Requirement: REQ-304 Tracker-scoped remote-entry identity

The system SHALL identify a remote time entry by the user's tracker and remote log ID together. A remote
entry SHALL be linked to at most one local export in a workspace, and all reconciliation operations SHALL
verify ownership of the tracker, task, day, and remote issue.

#### Scenario: Same provider ID on different trackers
- **WHEN** two trackers return the same remote log ID
- **THEN** each entry SHALL remain independently linkable because its tracker identity differs

#### Scenario: Entry is already linked
- **WHEN** the user attempts to link a tracker entry that already has local provenance
- **THEN** the system SHALL reject the duplicate link without changing existing provenance

### Requirement: REQ-305 Unlinked remote entry can be linked to a local task day

For a task linked to a remote issue, the Remote Sync details SHALL label fetched current-account entries
as Linked or Unlinked. The user SHALL be able to link an Unlinked entry when its tracker, remote issue,
and local date match the task and the task has no finalized export for that day. Confirmation SHALL show
the remote duration and comment, local task title, and completed local entries that will be covered.
Linking SHALL create provenance from the remote entry's actual date, duration, issue, activity or required
fields, and ID without mutating the tracker.

#### Scenario: Eligible entry is linked
- **WHEN** the user confirms linking a matching Unlinked entry
- **THEN** local provenance SHALL cover all completed entries for that task/day and the remote entry SHALL
  become Linked without a remote write

#### Scenario: Remote duration differs from local duration
- **WHEN** a matching remote entry has a different duration from the completed local entries
- **THEN** linking SHALL preserve the remote duration and the review SHALL expose the tracked/exported delta

#### Scenario: Entry does not match the task
- **WHEN** the tracker, issue, account, or local date does not match the target task/day
- **THEN** linking SHALL be rejected without creating provenance

### Requirement: REQ-306 Linked remote entry can be deleted with its provenance

The user SHALL be able to confirm deletion of a Linked entry after seeing its remote ID, duration, issue,
and comment. The application SHALL delete the tracker entry first and then atomically remove local export
provenance and covered-entry associations. A remote not-found response SHALL count as confirmed absence
and permit local cleanup. Any ambiguous remote result SHALL retain provenance.

#### Scenario: Remote deletion succeeds
- **WHEN** the tracker confirms deletion
- **THEN** local provenance SHALL be removed and the task/day SHALL become exportable again

#### Scenario: Remote entry is already absent
- **WHEN** deletion returns not found
- **THEN** local provenance SHALL still be removed as an idempotent cleanup

#### Scenario: Deletion outcome is ambiguous
- **WHEN** the application cannot determine whether the tracker deleted the entry
- **THEN** local provenance SHALL remain and the user SHALL receive a translated error

### Requirement: REQ-344 Import-created provenance is reconciled like exported provenance
Provenance created by the remote-log import (REQ-335) SHALL be indistinguishable from export- or link-created provenance for every reconciliation and reporting rule: it SHALL occupy the same tracker-scoped identity (REQ-304), SHALL label the matching fetched remote entry as Linked in the Remote Sync review (REQ-305), SHALL be deletable with its remote entry through the same confirmed-deletion flow (REQ-306), and SHALL classify the remote log's hours as App in the monthly report (REQ-292). Because deletion removes the tracker entry first, a deleted imported log SHALL NOT reappear on a later import run.

#### Scenario: Imported entry shows as Linked
- **WHEN** the user opens Remote Sync for a day that was backfilled by import
- **THEN** the day's remote logs SHALL be labelled Linked and the task rows SHALL be Sent

#### Scenario: Imported entry counts as App hours
- **WHEN** the monthly report fetches range logs for a backfilled month
- **THEN** those logs SHALL count as App hours, not Direct

#### Scenario: Deleting an imported log
- **WHEN** the user confirms deletion of a Linked entry that was created by import
- **THEN** the tracker entry SHALL be deleted first and the local provenance and association removed atomically, exactly as for an exported entry

#### Scenario: Deleted imported log does not come back
- **WHEN** an imported entry was deleted through the confirmed-deletion flow and the same range is imported again
- **THEN** the range fetch SHALL no longer return that log and nothing SHALL be recreated for it
