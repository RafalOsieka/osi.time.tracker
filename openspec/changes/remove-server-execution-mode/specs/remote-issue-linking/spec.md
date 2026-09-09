## MODIFIED Requirements

### Requirement: REQ-103 Search the configured tracker by execution mode
For an owned Task whose Project has an active tracker and registered adapter, the system SHALL search through `client` or `extension` according to `executionMode`. `client` SHALL query the configured tracker origin directly with the browser-held secret; `extension` SHALL execute through the approved desktop extension. Neither mode SHALL transmit the secret to an OSI API. Existing validation, bounded title search, exact-ID lookup, stale-response suppression, neutral results, and translated error behavior remain unchanged.

#### Scenario: Client execution-mode title search returns matching issues
- **WHEN** a user submits valid search input under `client`
- **THEN** the browser SHALL query the configured tracker origin and render neutral results

#### Scenario: Server execution-mode title search returns matching issues
- **WHEN** a stale client submits a search for a `server` tracker
- **THEN** the unsupported mode SHALL be rejected without contacting the tracker

#### Scenario: Exact issue-ID search returns an issue
- **WHEN** a valid exact-ID search runs through `client` or `extension`
- **THEN** the matching issue SHALL be shown regardless of status

#### Scenario: Search result includes remote project title
- **WHEN** the provider supplies a usable project title
- **THEN** the neutral result SHALL include it without a project id

#### Scenario: Search result omits a missing remote project title
- **WHEN** the provider omits a usable project title
- **THEN** the issue id and title SHALL remain selectable

#### Scenario: Extension search bypasses CORS
- **WHEN** a desktop user submits valid search input under `extension`
- **THEN** the approved extension SHALL perform the tracker request without routing it through OSI

#### Scenario: Mobile extension mode is unavailable
- **WHEN** a mobile browser encounters a tracker configured for `extension`
- **THEN** remote search SHALL expose an actionable extension-unavailable state and SHALL NOT fall back to another mode

#### Scenario: Invalid search input does not call the tracker
- **WHEN** title input is too short or an issue ID is invalid
- **THEN** the picker SHALL show translated validation and make no remote request

#### Scenario: New search supersedes an older response
- **WHEN** an older request completes after a newer search
- **THEN** only the newer result SHALL be displayed

#### Scenario: Client execution-mode credential remains browser-only
- **WHEN** client search runs
- **THEN** the secret SHALL travel only to the configured tracker origin

#### Scenario: Server execution-mode credential is forwarded but not persisted
- **WHEN** a stale caller requests server search
- **THEN** validation SHALL reject it and SHALL NOT forward the credential

#### Scenario: Remote search fails
- **WHEN** a supported mode encounters authentication, CORS, connection, or extension failure
- **THEN** the picker SHALL expose a translated accessible error without changing the reference