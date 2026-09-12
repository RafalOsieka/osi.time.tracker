## ADDED Requirements

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
