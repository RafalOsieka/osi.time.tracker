## MODIFIED Requirements

### Requirement: REQ-343 Redmine time logs map the project from the payload
When mapping a Redmine time entry to the neutral time-log DTO (REQ-341), the adapter SHALL derive the remote project id from `project.id` and the remote project title from `project.name`, omitting each when missing. Redmine time-entry payloads do not carry the issue subject, so the adapter SHALL resolve the remote issue title per REQ-378 through the issues endpoint filtered by the distinct issue ids with every issue status included, using each issue's `subject`. An id the issues endpoint does not return SHALL yield a `null` title. The mapping SHALL apply to both the same-day and the date-range fetch. Time entries without an issue SHALL continue to be dropped and SHALL NOT trigger a lookup.

#### Scenario: Project present
- **WHEN** a time entry carries `project: { id: 7, name: "Internal" }` and `issue: { id: 42 }`, and issue 42 has subject `Fix rounding`
- **THEN** the neutral log SHALL have remote project id `7`, remote project title `Internal`, and remote issue title `Fix rounding`

#### Scenario: Closed issue is included
- **WHEN** a time entry references an issue whose status is closed
- **THEN** the lookup SHALL include closed statuses and the neutral log SHALL carry the issue subject

#### Scenario: Issue not visible
- **WHEN** the issues endpoint does not return a referenced issue id
- **THEN** that log's remote issue title SHALL be `null` and the log SHALL still be returned

#### Scenario: Project missing
- **WHEN** a time entry carries no `project`
- **THEN** the neutral log SHALL omit both project fields and SHALL still be returned

#### Scenario: Issue-less entry is still dropped
- **WHEN** a time entry carries a project but no `issue`
- **THEN** it SHALL NOT appear in the neutral result and its absence SHALL NOT cause a lookup
