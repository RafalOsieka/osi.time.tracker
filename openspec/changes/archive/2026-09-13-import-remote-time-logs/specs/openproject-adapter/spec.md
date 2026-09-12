## ADDED Requirements

### Requirement: REQ-342 OpenProject time logs map project and issue title from HAL links
When mapping an OpenProject time entry to the neutral time-log DTO (REQ-341), the adapter SHALL derive the remote project id from the last path segment of `_links.project.href` and the remote project title from `_links.project.title`, and SHALL derive the remote issue title from `_links.entity.title` (falling back to `_links.workPackage.title` on older payloads). Each field SHALL be omitted when its source is missing or empty. The mapping SHALL apply to both the same-day and the date-range fetch and SHALL NOT add requests.

#### Scenario: Full HAL links present
- **WHEN** a time entry carries `_links.project.href` `/api/v3/projects/12` with title `CMPL` and `_links.entity.title` `Fix rounding`
- **THEN** the neutral log SHALL have remote project id `12`, remote project title `CMPL`, and remote issue title `Fix rounding`

#### Scenario: Legacy work-package link
- **WHEN** a time entry has no `_links.entity` but `_links.workPackage.title`
- **THEN** the remote issue title SHALL come from the work-package link

#### Scenario: Missing project link
- **WHEN** a time entry carries no `_links.project`
- **THEN** the neutral log SHALL omit the remote project id and title and SHALL still be returned
