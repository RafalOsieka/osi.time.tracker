## ADDED Requirements

### Requirement: REQ-343 Redmine time logs map the project from the payload
When mapping a Redmine time entry to the neutral time-log DTO (REQ-341), the adapter SHALL derive the remote project id from `project.id` and the remote project title from `project.name`, omitting each when missing. Redmine time-entry payloads do not carry the issue subject, so the adapter SHALL omit the remote issue title and SHALL NOT look it up. The mapping SHALL apply to both the same-day and the date-range fetch. Time entries without an issue SHALL continue to be dropped.

#### Scenario: Project present
- **WHEN** a time entry carries `project: { id: 7, name: "Internal" }`
- **THEN** the neutral log SHALL have remote project id `7` and remote project title `Internal` and no remote issue title

#### Scenario: Project missing
- **WHEN** a time entry carries no `project`
- **THEN** the neutral log SHALL omit both project fields and SHALL still be returned

#### Scenario: Issue-less entry is still dropped
- **WHEN** a time entry carries a project but no `issue`
- **THEN** it SHALL NOT appear in the neutral result
