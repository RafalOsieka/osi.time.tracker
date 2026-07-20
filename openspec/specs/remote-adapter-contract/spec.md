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

The system SHALL define a single provider-neutral remote-tracker adapter contract that every tracker provider implements. The contract SHALL expose exactly these operations: issue title search, exact issue-ID lookup, activity options, current-account resolution, same-day time-log fetch, and time-entry creation. Every operation SHALL accept and return only adapter-neutral DTOs defined once in `shared/types` and decoupled from any provider's wire format; a provider adapter SHALL NOT leak provider-specific field names or shapes across the contract boundary. Callers (local linking, remote sync, server proxy) SHALL depend only on this contract and SHALL NOT branch on `systemType`.

#### Scenario: Every provider adapter satisfies the operation set
- **WHEN** a provider adapter is registered for a `systemType`
- **THEN** it SHALL implement all six contract operations and SHALL expose only adapter-neutral DTOs to callers

#### Scenario: Callers depend on the contract, not the provider
- **WHEN** a caller performs a search, lookup, activity fetch, account resolution, log fetch, or entry creation
- **THEN** it SHALL invoke the neutral contract for the Client's configured `systemType` without provider-specific conditional branching

### Requirement: REQ-201 Execution-mode equivalence is a contract invariant

The contract SHALL behave identically under `client` and `server` execution modes: for the same operation and inputs, results, provider-quirk handling, and error classification SHALL be identical, with only the transport differing. `client` mode SHALL send remote requests directly from the browser to the configured tracker origin; `server` mode SHALL route them through the OSI server, which forwards them to the tracker by delegating to the same provider adapter used in `client` mode.

#### Scenario: Same operation yields identical results across modes
- **WHEN** the same contract operation runs once under a `client` configuration and once under a `server` configuration
- **THEN** the returned adapter-neutral result, quirk handling, and error classification SHALL be identical and only the transport SHALL differ

#### Scenario: Server mode delegates to the same adapter
- **WHEN** the OSI server forwards a contract operation for a `server`-mode configuration
- **THEN** it SHALL delegate to the same provider adapter used in `client` mode rather than reimplementing provider behavior

### Requirement: REQ-202 Transport neutrality and single-point auth construction

Transports SHALL be credential-scheme-agnostic: a transport SHALL attach only the headers supplied with the request and SHALL NOT construct any provider-specific credential itself. Each provider adapter SHALL construct its own authentication header in exactly one place. The credential scheme (e.g. an API-key header, a Basic-auth header) is a provider concern owned entirely by that provider's adapter, never by the contract or the transports.

#### Scenario: Transport attaches only supplied headers
- **WHEN** either transport executes a remote request
- **THEN** it SHALL attach only the headers provided by the adapter and SHALL NOT add provider-specific credentials of its own

#### Scenario: Auth header is built in one adapter location
- **WHEN** a provider adapter authenticates an upstream request
- **THEN** it SHALL construct its credential header in exactly one place and no other component SHALL replicate that scheme

### Requirement: REQ-203 Credential hygiene across the contract

For every contract operation the API secret SHALL NOT be persisted, logged, serialized, or returned by the OSI server, and SHALL NOT appear in any error payload. Under `client` execution mode the secret SHALL be transmitted only to the configured tracker origin and SHALL NOT appear in any OSI API request, response, or persisted record. Under `server` execution mode the secret MAY be transmitted to the OSI server per request solely for immediate upstream forwarding and SHALL NOT be persisted, logged, or returned.

#### Scenario: Client-mode secret stays browser-to-tracker only
- **WHEN** a contract operation runs under a `client` configuration
- **THEN** the secret SHALL be sent only to the configured tracker origin and SHALL NOT appear in any OSI request, response, or record

#### Scenario: Server-mode secret is used once and never retained
- **WHEN** the browser forwards the secret to the OSI server for a `server`-mode operation
- **THEN** the server SHALL use it only for the single upstream call and SHALL NOT persist, log, serialize, or return it

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

The contract SHALL map upstream outcomes into distinct translated `{ messageKey, params }` errors that mirror the client-mode error states across every provider and both execution modes: rejected credential, connection failure or timeout, and not-found. Raw upstream status text or response bodies SHALL NOT be returned to the client, so callers render equivalent translated states regardless of provider or execution mode.

#### Scenario: Rejected credential maps to a distinct key
- **WHEN** the tracker rejects the credential in either execution mode
- **THEN** the contract SHALL surface a distinct translated authentication `messageKey` without exposing the raw upstream body

#### Scenario: Connection failure maps to a distinct key
- **WHEN** the upstream request fails to connect, times out, or its host cannot be resolved
- **THEN** the contract SHALL surface a distinct translated connection `messageKey`

#### Scenario: Error states are provider- and mode-independent
- **WHEN** the same failure class occurs for different providers or execution modes
- **THEN** the caller SHALL receive equivalent translated `{ messageKey, params }` states

