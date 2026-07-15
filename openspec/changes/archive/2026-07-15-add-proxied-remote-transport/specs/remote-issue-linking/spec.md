## MODIFIED Requirements

### Requirement: REQ-TTR-106 Search OpenProject issues by configured transport

For an owned Task whose Project's Client has an active OpenProject configuration, the system SHALL search OpenProject work packages using the transport selected by the configuration's `transportMode`. When `transportMode` is `direct`, the browser SHALL query the configured OpenProject origin directly using the browser-held credential, and the credential SHALL NOT be transmitted to or persisted by the OSI server. When `transportMode` is `proxied`, the browser SHALL send the search and the per-request credential to the OSI server, which SHALL forward the request to the tracker and return the result; the OSI server SHALL NOT persist the credential. In both transports the user SHALL explicitly choose title-phrase or issue-ID search, enter a query, and submit it. Title search SHALL require at least three trimmed characters, match issue subjects, and return a fixed bounded result set. Issue-ID search SHALL require a non-empty valid OpenProject work-package ID and perform an exact lookup without applying the title minimum length. Both modes SHALL include open and closed issues and return the same adapter-neutral issue shape containing remote issue ID and title.

#### Scenario: Direct-transport title search returns matching issues
- **WHEN** the user selects title search, enters at least three trimmed characters, and submits the search for an eligible Task under a `direct` configuration
- **THEN** the browser SHALL query the configured OpenProject origin directly and show a bounded set of matching work packages regardless of status

#### Scenario: Proxied-transport title search returns matching issues
- **WHEN** the user submits a valid title search for an eligible Task under a `proxied` configuration
- **THEN** the browser SHALL send the search to the OSI server, which forwards it to the tracker, and the picker SHALL show a bounded set of matching work packages regardless of status

#### Scenario: Exact issue-ID search returns an issue
- **WHEN** the user selects issue-ID search, enters a valid work-package ID, and submits the search under either transport
- **THEN** the system SHALL retrieve that exact OpenProject work package via the configured transport and SHALL show it as a selectable result regardless of status

#### Scenario: Invalid search input does not call the tracker
- **WHEN** the user submits a title shorter than three trimmed characters or an empty or invalid issue ID
- **THEN** the picker SHALL show a translated validation message and SHALL NOT send a direct or proxied remote request

#### Scenario: New search supersedes an older response
- **WHEN** an earlier remote request finishes after a newer search has been submitted
- **THEN** the system SHALL ignore or cancel the stale response and SHALL display only results for the latest query

#### Scenario: Direct-transport credential remains browser-only
- **WHEN** the browser searches OpenProject under a `direct` configuration
- **THEN** the credential SHALL be sent only to the configured OpenProject origin and SHALL NOT appear in any OSI API request, response, or persisted record

#### Scenario: Proxied credential is forwarded but not persisted
- **WHEN** the browser searches OpenProject under a `proxied` configuration
- **THEN** the credential SHALL be sent to the OSI server only for immediate upstream forwarding and SHALL NOT be persisted, logged, or returned by the server

#### Scenario: Remote search fails
- **WHEN** OpenProject rejects the credential, CORS blocks a direct request, or a direct or proxied request otherwise fails
- **THEN** the picker SHALL expose a translated accessible error state without changing the Task's existing reference
