## RENAMED Requirements

- FROM: `### Requirement: REQ-103 Search OpenProject issues by configured transport`
- TO: `### Requirement: REQ-103 Search the configured tracker by execution mode`

## MODIFIED Requirements

### Requirement: REQ-103 Search the configured tracker by execution mode

For an owned Task whose Project's Client has an active remote-system configuration with a registered adapter, the system SHALL search the configured tracker's issues via the neutral remote-tracker adapter contract (`remote-adapter-contract` REQ-200) using the execution mode selected by the configuration's `executionMode`. When `executionMode` is `client`, the browser SHALL query the configured tracker origin directly using the browser-held credential, and the credential SHALL NOT be transmitted to or persisted by the OSI server. When `executionMode` is `server`, the browser SHALL send the search and the per-request credential to the OSI server, which SHALL forward the request to the tracker and return the result; the OSI server SHALL NOT persist the credential. In both execution modes the user SHALL explicitly choose title-phrase or issue-ID search, enter a query, and submit it. Title search SHALL require at least three trimmed characters, match issue titles, and return a fixed bounded result set. Issue-ID search SHALL require a non-empty valid remote issue ID and perform an exact lookup without applying the title minimum length. Both modes SHALL include open and closed issues, return the same adapter-neutral issue shape containing remote issue ID and title, and SHALL behave identically with respect to provider quirks and error classification (`remote-adapter-contract` REQ-201).

#### Scenario: Client execution-mode title search returns matching issues
- **WHEN** the user selects title search, enters at least three trimmed characters, and submits the search for an eligible Task under a `client` configuration
- **THEN** the browser SHALL query the configured tracker origin directly and show a bounded set of matching issues regardless of status

#### Scenario: Server execution-mode title search returns matching issues
- **WHEN** the user submits a valid title search for an eligible Task under a `server` configuration
- **THEN** the browser SHALL send the search to the OSI server, which forwards it to the tracker, and the picker SHALL show a bounded set of matching issues regardless of status

#### Scenario: Exact issue-ID search returns an issue
- **WHEN** the user selects issue-ID search, enters a valid remote issue ID, and submits the search under either execution mode
- **THEN** the system SHALL retrieve that exact issue via the configured execution mode and SHALL show it as a selectable result regardless of status

#### Scenario: Invalid search input does not call the tracker
- **WHEN** the user submits a title shorter than three trimmed characters or an empty or invalid issue ID
- **THEN** the picker SHALL show a translated validation message and SHALL NOT send a remote request in either execution mode

#### Scenario: New search supersedes an older response
- **WHEN** an earlier remote request finishes after a newer search has been submitted
- **THEN** the system SHALL ignore or cancel the stale response and SHALL display only results for the latest query

#### Scenario: Client execution-mode credential remains browser-only
- **WHEN** the browser searches the tracker under a `client` configuration
- **THEN** the credential SHALL be sent only to the configured tracker origin and SHALL NOT appear in any OSI API request, response, or persisted record

#### Scenario: Server execution-mode credential is forwarded but not persisted
- **WHEN** the browser searches the tracker under a `server` configuration
- **THEN** the credential SHALL be sent to the OSI server only for immediate upstream forwarding and SHALL NOT be persisted, logged, or returned by the server

#### Scenario: Remote search fails
- **WHEN** the tracker rejects the credential, CORS blocks a client-mode request, or a client- or server-mode request otherwise fails
- **THEN** the picker SHALL expose a translated accessible error state without changing the Task's existing reference
