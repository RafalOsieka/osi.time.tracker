## ADDED Requirements

### Requirement: REQ-341 Time logs carry optional remote project and issue title
The neutral time-log DTO returned by the same-day and date-range fetches SHALL carry, in addition to the existing fields, an optional remote project id (opaque text), an optional remote project title, and an optional remote issue title. A provider adapter SHALL fill each field only from data already present in the time-log payload it fetched and SHALL omit the field when the payload does not supply a usable value; it SHALL NOT issue additional requests to populate them. Callers SHALL treat the fields as optional and SHALL NOT branch on provider type to obtain them. The extension transport SHALL pass the optional fields through unchanged.

#### Scenario: Provider supplies the project on the log
- **WHEN** a range fetch returns a log whose payload names its project
- **THEN** the neutral log SHALL carry that project's remote id and title

#### Scenario: Provider supplies the issue title on the log
- **WHEN** a log payload includes the issue's display title
- **THEN** the neutral log SHALL carry it as the remote issue title

#### Scenario: Provider omits a field
- **WHEN** a log payload has no usable project or issue title
- **THEN** the corresponding optional field SHALL be absent and the log SHALL otherwise be returned unchanged

#### Scenario: No extra requests
- **WHEN** an adapter maps a page of time logs
- **THEN** it SHALL NOT perform any request beyond the page fetch to populate the optional fields

#### Scenario: Extension mode preserves the fields
- **WHEN** a range fetch runs through the approved extension
- **THEN** the optional fields present in the adapter result SHALL reach the page unchanged
