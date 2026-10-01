# Spec Delta

## ADDED Requirements

### Requirement: REQ-371 Recent tracked time per project
Each project returned by `GET /api/projects` (REQ-084) SHALL include `recentTrackedSeconds`, a non-negative integer. It is the sum of the durations of the authenticated user's time entries that belong to that project through their task and whose `startedAt` falls within the 30 days before the request's server time. A running entry SHALL count up to the current server time. Entries without a task, entries of other projects, and entries of other users SHALL NOT contribute. A project with no qualifying entries SHALL report `0`. The field SHALL NOT change the list's ordering (still by name) or its filtering. Computing it SHALL NOT require a query per project.

#### Scenario: Recent time is summed per project
- **WHEN** the user has two stopped entries of 1 h and 30 min in "Helios" started within the last 30 days
- **THEN** "Helios" SHALL report `recentTrackedSeconds` of `5400`

#### Scenario: Older entries are excluded
- **WHEN** the user's only entry in "Nordwind" started 31 days ago
- **THEN** "Nordwind" SHALL report `recentTrackedSeconds` of `0`

#### Scenario: Running entry counts up to now
- **WHEN** the user's running entry in "Helios" started 10 minutes ago
- **THEN** "Helios" SHALL report at least `600` seconds for that entry

#### Scenario: Other users' time is ignored
- **WHEN** another user tracks time in their own project of the same name
- **THEN** the authenticated user's project SHALL NOT include that time

#### Scenario: Ordering is unchanged
- **WHEN** the user lists their projects
- **THEN** projects SHALL still be ordered by name regardless of `recentTrackedSeconds`

#### Scenario: Unauthenticated request
- **WHEN** a request without a valid session calls `GET /api/projects`
- **THEN** the system SHALL respond with HTTP 401 and SHALL NOT return projects
