## MODIFIED Requirements

### Requirement: REQ-292 Live remote hours split into App and Direct

After monthly aggregation loads, the client SHALL fetch date-range logs once per active tracker. App hours
SHALL be fetched logs whose tracker-scoped remote identity matches current finalized provenance; Direct
hours SHALL be fetched logs without such provenance. Linking an entry SHALL reclassify it from Direct to
App on refresh, while deleting its provenance after confirmed remote deletion SHALL remove the absent log
from live totals and from the App identity set. Fetch failures SHALL remain unavailable rather than zero.

#### Scenario: Export id matches App
- **WHEN** a fetched log's tracker and remote log ID match finalized provenance
- **THEN** its duration SHALL count as App and not Direct

#### Scenario: Unrecognized remote log is Direct
- **WHEN** a fetched log has no matching tracker-scoped provenance
- **THEN** its duration SHALL count as Direct

#### Scenario: Linked entry is reclassified
- **WHEN** an Unlinked remote entry is linked and the report refreshes
- **THEN** that entry SHALL move from Direct to App without changing the remote total

#### Scenario: One range fetch per tracker
- **WHEN** the report loads for a month with active trackers
- **THEN** the client SHALL perform at most one date-range log fetch per tracker

#### Scenario: Remote-only day appears
- **WHEN** a tracker has App or Direct hours on a day with no local hours
- **THEN** that day SHALL appear in the report

#### Scenario: Fetch failure is not zero
- **WHEN** a tracker range fetch fails or lacks a secret
- **THEN** its report group SHALL show an unavailable state rather than zero hours
