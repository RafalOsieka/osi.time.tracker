## MODIFIED Requirements

### Requirement: REQ-342 OpenProject time logs map project and issue title from HAL links
When mapping an OpenProject time entry to the neutral time-log DTO (REQ-341), the adapter SHALL derive the remote project id from the last path segment of `_links.project.href` and the remote project title from `_links.project.title`, and SHALL derive the remote issue title from `_links.entity.title` (falling back to `_links.workPackage.title` on older payloads). Each project field SHALL be omitted when its source is missing or empty. OpenProject time-entry links carry the work package's title even when the work package itself is no longer visible to the account, so the time-entry payload is the only title source: when neither link carries a usable issue title, the remote issue title SHALL be `null` (the tracker does not disclose it) and the adapter SHALL NOT issue a work-package request to resolve it. OpenProject's work-package `id` filter rejects the whole request when any listed id is missing or not visible, so it is not a usable batched lookup. The mapping SHALL apply to both the same-day and the date-range fetch and SHALL add no request beyond the time-entry pages.

#### Scenario: Full HAL links present
- **WHEN** a time entry carries `_links.project.href` `/api/v3/projects/12` with title `Nordwind` and `_links.entity.title` `Fix rounding`
- **THEN** the neutral log SHALL have remote project id `12`, remote project title `Nordwind`, and remote issue title `Fix rounding`, and no work-package request SHALL be made

#### Scenario: Legacy work-package link
- **WHEN** a time entry has no `_links.entity` but `_links.workPackage.title`
- **THEN** the remote issue title SHALL come from the work-package link

#### Scenario: Work package no longer visible
- **WHEN** the account can still see its own time entry but no longer the work package, and the entry's link carries the work package's title
- **THEN** the neutral log SHALL carry that title and no work-package request SHALL be made

#### Scenario: Link without a title
- **WHEN** a time entry's entity and work-package links carry no title
- **THEN** that log's remote issue title SHALL be `null` and no work-package request SHALL be made

#### Scenario: Missing project link
- **WHEN** a time entry carries no `_links.project`
- **THEN** the neutral log SHALL omit the remote project id and title and SHALL still be returned
