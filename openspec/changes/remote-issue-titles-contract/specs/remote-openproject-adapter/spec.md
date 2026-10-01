## MODIFIED Requirements

### Requirement: REQ-342 OpenProject time logs map project and issue title from HAL links
When mapping an OpenProject time entry to the neutral time-log DTO (REQ-341), the adapter SHALL derive the remote project id from the last path segment of `_links.project.href` and the remote project title from `_links.project.title`, and SHALL derive the remote issue title from `_links.entity.title` (falling back to `_links.workPackage.title` on older payloads). Each project field SHALL be omitted when its source is missing or empty. When neither link carries a usable issue title, the adapter SHALL resolve it per REQ-378 by filtering work packages on the missing ids. The mapping SHALL apply to both the same-day and the date-range fetch, and SHALL add no request when every entry carries its title.

#### Scenario: Full HAL links present
- **WHEN** a time entry carries `_links.project.href` `/api/v3/projects/12` with title `Nordwind` and `_links.entity.title` `Fix rounding`
- **THEN** the neutral log SHALL have remote project id `12`, remote project title `Nordwind`, and remote issue title `Fix rounding`, and no work-package request SHALL be made

#### Scenario: Legacy work-package link
- **WHEN** a time entry has no `_links.entity` but `_links.workPackage.title`
- **THEN** the remote issue title SHALL come from the work-package link

#### Scenario: Link without a title
- **WHEN** a time entry's work-package link carries no title and the work package is visible
- **THEN** the adapter SHALL resolve the title through a work-package filter request and the neutral log SHALL carry it

#### Scenario: Work package not visible
- **WHEN** the work-package filter does not return a referenced id
- **THEN** that log's remote issue title SHALL be `null`

#### Scenario: Missing project link
- **WHEN** a time entry carries no `_links.project`
- **THEN** the neutral log SHALL omit the remote project id and title and SHALL still be returned
