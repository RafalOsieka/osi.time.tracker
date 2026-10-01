## MODIFIED Requirements

### Requirement: REQ-341 Time logs carry optional remote project and issue title
The neutral time-log DTO returned by the same-day and date-range fetches SHALL carry, in addition to the existing fields, an optional remote project id (opaque text), an optional remote project title, and a **required, nullable** remote issue title. A provider adapter SHALL fill the remote project fields only from data already present in the time-log payload it fetched and SHALL omit each when the payload does not supply a usable value. The remote issue title SHALL be the issue's display title for every provider: taken from the time-log payload when the provider's payload carries issue titles, otherwise resolved per REQ-378. It SHALL be `null` only when the tracker does not disclose the issue to the configured account (deleted, or not visible to it), never because of which provider produced the log. An optional or nullable DTO field SHALL be empty only for a reason in the remote data, never because of the provider type. Callers SHALL NOT branch on provider type to obtain any of these fields. The extension transport SHALL pass the fields through unchanged.

#### Scenario: Provider supplies the project on the log
- **WHEN** a range fetch returns a log whose payload names its project
- **THEN** the neutral log SHALL carry that project's remote id and title

#### Scenario: Provider supplies the issue title on the log
- **WHEN** a log payload includes the issue's display title
- **THEN** the neutral log SHALL carry it as the remote issue title and no issue lookup SHALL be made for that issue

#### Scenario: Payload lacks the issue title
- **WHEN** the provider's time-log payload does not carry issue titles and the issue is visible to the account
- **THEN** the neutral log SHALL still carry the issue's display title

#### Scenario: Issue not disclosed to the account
- **WHEN** a log references an issue that the tracker does not return to the configured account
- **THEN** the neutral log SHALL carry a `null` remote issue title and SHALL otherwise be returned unchanged

#### Scenario: Provider omits a field
- **WHEN** a log payload has no usable project
- **THEN** the project fields SHALL be absent and the log SHALL otherwise be returned unchanged

#### Scenario: No extra requests
- **WHEN** an adapter maps a page of time logs that all carry their issue title
- **THEN** it SHALL NOT perform any request beyond the page fetch; requests for missing titles are bounded by REQ-378

#### Scenario: Extension mode preserves the fields
- **WHEN** a range fetch runs through the approved extension
- **THEN** the fields present in the adapter result, including a `null` issue title, SHALL reach the page unchanged

## ADDED Requirements

### Requirement: REQ-378 Missing issue titles are resolved by a bounded batched lookup
When a provider's time-log payload does not carry issue titles (Redmine, REQ-343), a same-day or date-range fetch SHALL resolve the titles of the logs' distinct remote issue ids before returning, using batched issue lookups of at most 100 ids each. A provider whose payload carries issue titles (OpenProject, REQ-342) SHALL make no lookup, and a log whose payload has no title there SHALL carry `null`. A fetch SHALL make no additional request when no log needs a title, and at most ⌈distinct issues needing a title / 100⌉ additional requests otherwise. Issues in any status, including closed ones, SHALL be resolvable. An issue absent from the lookup response SHALL yield a `null` title (REQ-341). A failed lookup request (rejected credentials, connection failure, timeout, or an unparseable payload) SHALL fail the whole fetch with the same translated time-log fetch error as a failed log page, and SHALL NOT be reported as `null` titles. Lookups SHALL use the same credential, execution path, and origin confinement as the log fetch itself.

#### Scenario: Title-carrying provider needs no lookup
- **WHEN** an OpenProject fetch returns logs, including one whose link carries no title
- **THEN** the fetch SHALL make no request beyond the log pages and that log's title SHALL be `null`

#### Scenario: Lookups are batched
- **WHEN** a Redmine month's logs reference 230 distinct issues
- **THEN** the fetch SHALL make exactly 3 lookup requests in addition to the log pages

#### Scenario: Closed issue keeps its title
- **WHEN** a Redmine log references an issue that has since been closed
- **THEN** the neutral log SHALL carry that issue's title

#### Scenario: Lookup failure fails the fetch
- **WHEN** the Redmine log pages succeed but a title lookup request fails
- **THEN** the fetch SHALL fail with the translated time-log fetch error and SHALL NOT return logs with `null` titles

#### Scenario: Lookup stays on the tracker origin
- **WHEN** a lookup runs under client or extension execution
- **THEN** it SHALL target only the configured tracker origin and the secret SHALL NOT appear in OSI API traffic
