## MODIFIED Requirements

### Requirement: REQ-296 Date-range time-log fetch
The contract SHALL expose one bounded date-range operation for the current account's logs on an inclusive `from`/`to` local-date pair, without issue filtering. `client` SHALL send the secret only to the tracker origin; `extension` SHALL use it transiently only for the approved tracker request. Same-day issue-filtered fetch SHALL remain available for Remote Sync.

#### Scenario: Range returns logs across the month without issue filter
- **WHEN** a caller requests a valid date range
- **THEN** the adapter SHALL return current-account logs across that range, including unlinked issues, within the pagination bound

#### Scenario: Secrets avoid OSI APIs
- **WHEN** either supported mode performs a range fetch
- **THEN** the secret SHALL NOT appear in OSI API traffic

#### Scenario: Pagination is bounded
- **WHEN** an upstream total exceeds the fixed page bound
- **THEN** the adapter SHALL stop at that bound

#### Scenario: Same-day fetch is unchanged
- **WHEN** Remote Sync requests issue-filtered same-day logs
- **THEN** it SHALL continue using the same-day operation

#### Scenario: Server-mode proxy does not keep the secret
- **WHEN** a stale caller attempts a server-mode range fetch
- **THEN** boundary validation SHALL reject the unsupported mode before any secret reaches OSI

### Requirement: REQ-201 Execution-mode equivalence is a contract invariant
The contract SHALL behave identically under authorized `client` and `extension` execution for all seven operations, with only the execution path and extension-specific setup failures differing. `client` SHALL call the tracker directly. `extension` SHALL delegate to the same provider implementation bundled in the approved browser extension and SHALL NOT route tracker requests through the OSI server.

#### Scenario: Same operation yields identical results across modes
- **WHEN** equivalent upstream responses are processed under `client` and `extension`
- **THEN** results, provider quirks, and upstream error classification SHALL be identical

#### Scenario: Server mode delegates to the same adapter
- **WHEN** a stale configuration still contains `server` before migration
- **THEN** migration SHALL convert it to `client` rather than invoking a server adapter

#### Scenario: Extension mode delegates all operations
- **WHEN** any neutral operation runs under `extension`
- **THEN** it SHALL invoke the shared provider implementation through the guarded extension transport

#### Scenario: Extension remains distinguishable
- **WHEN** extension availability, compatibility, or permission fails before tracker execution
- **THEN** the caller SHALL receive the corresponding extension-specific error

### Requirement: REQ-203 Credential hygiene across the contract
For every operation the secret SHALL NOT be persisted, logged, serialized, returned, or included in an error. Under `client`, it SHALL travel only to the configured tracker origin. Under `extension`, it SHALL pass transiently through the approved extension solely for the approved destination and SHALL NOT enter OSI API traffic, extension storage, handshake messages, logs, or responses to the page.

#### Scenario: Client-mode secret stays browser-to-tracker only
- **WHEN** an operation runs under `client`
- **THEN** its secret SHALL go only to the configured tracker origin

#### Scenario: Extension secret is transient
- **WHEN** an extension operation succeeds or fails
- **THEN** its secret SHALL NOT be retained, returned, logged, or sent to OSI APIs

#### Scenario: Server-mode secret is used once and never retained
- **WHEN** a stale caller submits `server` with a secret
- **THEN** validation SHALL reject the mode and SHALL NOT transmit the secret to an OSI remote-operation endpoint

### Requirement: REQ-206 Shared translated error contract for all providers
The contract SHALL map rejected credentials, connection failures or timeouts, and not-found outcomes into equivalent translated `{ messageKey, params }` states across providers and the two supported modes. Raw upstream payloads SHALL NOT be exposed. Extension availability, compatibility, permission, and unknown-create-outcome failures SHALL remain distinct.

#### Scenario: Rejected credential maps to a distinct key
- **WHEN** the tracker rejects a credential
- **THEN** the contract SHALL expose a safe translated authentication key

#### Scenario: Connection failure maps to a distinct key
- **WHEN** the tracker cannot be reached or times out
- **THEN** the contract SHALL expose a safe translated connection key

#### Scenario: Error states are provider- and mode-independent
- **WHEN** the same upstream failure occurs through `client` or `extension`
- **THEN** the caller SHALL receive an equivalent safe translated state

#### Scenario: Extension failure is actionable
- **WHEN** extension setup fails before tracker execution
- **THEN** the caller SHALL receive a distinct extension-specific message