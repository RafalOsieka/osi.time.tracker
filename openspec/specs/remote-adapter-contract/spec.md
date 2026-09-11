# remote-adapter-contract Specification

## Purpose

Define the single provider-neutral remote-tracker adapter contract that every
tracker provider implements: the six-operation set over adapter-neutral DTOs,
`client`/`server` execution-mode equivalence, transport neutrality with
single-point per-provider auth construction, credential hygiene, 404→not-found
resolution, per-`systemType` issue-URL derivation, and the shared translated
`{ messageKey, params }` error contract — so callers depend only on the contract
and never branch on `systemType`.
## Requirements
### Requirement: REQ-200 Neutral remote-tracker adapter operation set

The system SHALL define one provider-neutral remote-tracker adapter contract implemented by every
provider. It SHALL expose issue title search, exact issue-ID lookup, activity options, current-account
resolution, same-day time-log fetch, date-range time-log fetch, time-entry creation, and time-entry
deletion. Operations SHALL use adapter-neutral DTOs and callers SHALL NOT branch on provider type.

#### Scenario: Every provider adapter satisfies the operation set
- **WHEN** a provider is registered
- **THEN** it SHALL implement all eight neutral operations

#### Scenario: Callers depend on the contract, not the provider
- **WHEN** a caller creates, reads, or deletes a remote time entry
- **THEN** it SHALL use the neutral contract without provider-specific branching

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

### Requirement: REQ-266 Search and lookup results include optional remote project title
Issue title search and exact issue-ID lookup SHALL return the same adapter-neutral result shape: remote issue ID, issue title, and an optional remote project title. The remote project title SHALL be the tracker's project display name when the provider payload supplies a usable string, and SHALL be omitted when it does not. The result SHALL NOT include a remote project id, href, or any other remote-project identifier. Provider adapters SHALL map only the provider's project display name into that field and SHALL NOT leak provider-specific project objects across the contract boundary.

#### Scenario: Result includes a remote project title
- **WHEN** title search or exact-ID lookup receives a provider payload that includes a usable project display name
- **THEN** the adapter-neutral result SHALL include that name as the remote project title and SHALL NOT include a remote project id

#### Scenario: Result omits a missing project title
- **WHEN** title search or exact-ID lookup receives an otherwise valid issue payload with no usable project display name
- **THEN** the adapter-neutral result SHALL still include remote issue ID and title and SHALL omit the remote project title

#### Scenario: Callers do not branch on provider project fields
- **WHEN** a caller renders or persists a search result
- **THEN** it SHALL read only the adapter-neutral remote project title and SHALL NOT inspect provider-specific project fields

### Requirement: REQ-201 Execution-mode equivalence is a contract invariant

The contract SHALL behave equivalently under authorized client and extension execution for all eight
operations, except for extension-specific setup failures. Client mode SHALL call the tracker directly;
extension mode SHALL delegate to the same provider implementation in the approved extension. Tracker
requests and credentials SHALL NOT pass through the OSI server.

#### Scenario: Same operation yields identical results across modes
- **WHEN** equivalent upstream responses occur in client and extension modes
- **THEN** results and upstream error classifications SHALL be equivalent

#### Scenario: Server mode delegates to the same adapter
- **WHEN** a stale configuration still contains server mode
- **THEN** migration SHALL convert it to client mode rather than invoking a server adapter

#### Scenario: Extension mode delegates all operations
- **WHEN** a time-entry deletion runs in extension mode
- **THEN** it SHALL invoke the same provider deletion behavior through the guarded extension transport

#### Scenario: Extension remains distinguishable
- **WHEN** extension availability, compatibility, or permission fails before tracker execution
- **THEN** the caller SHALL receive the corresponding extension-specific error

### Requirement: REQ-307 Provider-neutral time-entry deletion

Deletion SHALL target one remote log ID and distinguish confirmed deletion, not found, rejected requests,
and unknown outcomes. A not-found result SHALL be safe for idempotent local cleanup. Connection loss or an
unparseable response after sending the request SHALL NOT be treated as confirmed deletion.

#### Scenario: Entry is deleted
- **WHEN** the tracker confirms deletion of the requested current-account entry
- **THEN** the adapter SHALL return a confirmed-deleted result

#### Scenario: Entry is not found
- **WHEN** the tracker responds that the remote log does not exist
- **THEN** the adapter SHALL return a distinct not-found result rather than an error

#### Scenario: Outcome cannot be determined
- **WHEN** transport fails after the deletion request may have reached the tracker
- **THEN** the adapter SHALL report an unknown outcome and SHALL NOT claim confirmed deletion

### Requirement: REQ-202 Transport neutrality and single-point auth construction

Transports SHALL be credential-scheme-agnostic: a transport SHALL attach only the headers supplied with the request and SHALL NOT construct any provider-specific credential itself. Each provider adapter SHALL construct its own authentication header in exactly one place. The credential scheme (e.g. an API-key header, a Basic-auth header) is a provider concern owned entirely by that provider's adapter, never by the contract or the transports.

#### Scenario: Transport attaches only supplied headers
- **WHEN** either transport executes a remote request
- **THEN** it SHALL attach only the headers provided by the adapter and SHALL NOT add provider-specific credentials of its own

#### Scenario: Auth header is built in one adapter location
- **WHEN** a provider adapter authenticates an upstream request
- **THEN** it SHALL construct its credential header in exactly one place and no other component SHALL replicate that scheme

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

### Requirement: REQ-204 Not-found resolves to an empty result, not an error

An exact issue-ID lookup that the tracker answers with an upstream 404 SHALL resolve to an empty (not-found) result rather than an error, uniformly across all providers. Other upstream failures SHALL be surfaced as errors per the shared error contract and SHALL NOT be conflated with not-found.

#### Scenario: Upstream 404 becomes not-found
- **WHEN** an exact issue-ID lookup receives an upstream 404 from any provider
- **THEN** the contract SHALL return an empty not-found result rather than raising an error

#### Scenario: Non-404 failure is not treated as not-found
- **WHEN** an exact issue-ID lookup fails for a reason other than 404
- **THEN** the contract SHALL classify it as the appropriate error rather than as not-found

### Requirement: REQ-205 Provider-specific issue-URL derivation via abstraction

The contract SHALL derive an issue URL from a configuration's normalized base URL and remote issue ID using the URL pattern of the configuration's `systemType`, resolved through a per-provider abstraction rather than conditional branching. Each provider adapter SHALL own its own URL pattern.

#### Scenario: URL is derived from the provider's pattern
- **WHEN** a reference's originating configuration is active and available
- **THEN** the contract SHALL derive a direct issue URL from the current base URL and encoded remote issue ID using that `systemType`'s registered URL pattern

#### Scenario: URL derivation avoids conditional branching
- **WHEN** a new provider's URL pattern is added
- **THEN** it SHALL be provided through the per-provider abstraction without adding `systemType` conditionals in shared code

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

### Requirement: REQ-287 Upstream payloads are parsed with zod
Every remote transport `execute` SHALL accept a zod schema for the expected
payload type `T` and SHALL parse the upstream JSON with that schema
(`schema.safeParse`). A parse failure SHALL yield `payload: null` (or the
transport's documented empty result), not an untyped object. Provider adapters
SHALL supply the schema at each call; callers SHALL NOT treat raw upstream JSON
as `T`.

#### Scenario: Transport parse success yields typed payload
- **WHEN** an upstream response body matches the schema passed to `execute`
- **THEN** the transport SHALL return that parsed value as `payload`

#### Scenario: Transport parse failure does not leak raw JSON as T
- **WHEN** an upstream response body fails the schema passed to `execute`
- **THEN** the transport SHALL return `payload: null` (or the operation's empty result) and SHALL NOT cast the raw JSON to `T`

