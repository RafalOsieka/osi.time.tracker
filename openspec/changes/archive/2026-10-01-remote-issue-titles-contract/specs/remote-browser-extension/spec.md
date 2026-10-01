## ADDED Requirements

### Requirement: REQ-379 Bridge protocol version for resolved issue titles
The operation bridge SHALL carry the time-log DTO with the required, nullable remote issue title (REQ-341) under a new protocol version. The website and the extension SHALL both require that version, so pairing a website with an extension built before the change SHALL fail the handshake's version check and the website SHALL show the existing incompatibility/update state (REQ-309) rather than failing a time-log result validation mid-operation. Title resolution (REQ-378) SHALL run inside the extension as part of the same time-log operation; the bridge SHALL NOT gain a separate issue-lookup operation, and lookups SHALL obey the same tracker network confinement (REQ-310) as the log fetch.

#### Scenario: Matching versions
- **WHEN** the website and extension share the new protocol version and the page requests a date-range fetch
- **THEN** the extension SHALL return logs with resolved or `null` issue titles

#### Scenario: Outdated extension
- **WHEN** the installed extension implements the previous protocol version
- **THEN** the website SHALL show the incompatibility/update state and SHALL NOT send the time-log operation or the tracker secret

#### Scenario: No separate lookup operation
- **WHEN** a page asks the extension for an issue-lookup-by-ids operation
- **THEN** the extension SHALL reject it as an unsupported operation before any tracker request
