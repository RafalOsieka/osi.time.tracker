## MODIFIED Requirements

### Requirement: REQ-108 Proxy remote issue search through the OSI server

For a remote-system configuration whose `executionMode` is `server`, the system SHALL expose authenticated, user-scoped OSI server endpoints that forward title-phrase search and exact issue-ID lookup to the configured tracker and return the adapter-neutral issue shape. The client SHALL identify only the owned configuration and search input; the server SHALL derive the target tracker base URL from the authenticated user's owned stored configuration and SHALL NOT accept a target URL from the client. The endpoints SHALL forward exactly the known contract operations, SHALL NOT act as a generic HTTP pass-through, and SHALL delegate to the same provider adapter used in `client` execution mode so quirks and error classification stay identical (`remote-adapter-contract` REQ-201). Title search SHALL require at least three trimmed characters and return a fixed bounded result set; issue-ID search SHALL require a non-empty valid remote issue ID and perform an exact lookup; both SHALL include open and closed issues.

#### Scenario: Server execution-mode title search returns matching issues
- **WHEN** an authenticated user submits a title search of at least three trimmed characters for their eligible Task under a `server` configuration
- **THEN** the OSI server SHALL query the configuration's tracker server-side and return a bounded set of adapter-neutral issues regardless of status

#### Scenario: Server execution-mode exact issue-ID lookup returns an issue
- **WHEN** an authenticated user submits a valid remote issue ID under a `server` configuration
- **THEN** the OSI server SHALL request that exact issue server-side and return it as a single adapter-neutral result regardless of status

#### Scenario: Target tracker is derived server-side, not client-supplied
- **WHEN** a server execution-mode search request includes any client-supplied target URL or origin
- **THEN** the server SHALL ignore it and resolve the tracker base URL solely from the authenticated user's owned stored configuration

#### Scenario: Invalid search input does not call the tracker
- **WHEN** a server execution-mode request has a title shorter than three trimmed characters or an empty or invalid issue ID
- **THEN** the server SHALL respond with a translated `{ messageKey, params }` validation error and SHALL NOT contact the tracker

#### Scenario: Only known operations are forwarded
- **WHEN** a request targets any operation other than the defined contract operations
- **THEN** the server SHALL reject it and SHALL NOT forward an arbitrary request to the tracker
