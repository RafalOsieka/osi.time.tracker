## MODIFIED Requirements

### Requirement: REQ-201 Execution-mode equivalence is a contract invariant

The contract SHALL behave identically under `client`, `server`, and `extension` execution modes for supported, authorized operations: for the same operation and inputs, results, provider-quirk handling, and upstream error classification SHALL be identical, with only the execution path differing. `client` mode SHALL send remote requests directly from the browser to the configured tracker origin; `server` mode SHALL route them through the OSI server, which forwards them to the tracker by delegating to the same provider adapter used in `client` mode. `extension` mode SHALL delegate to that same provider implementation bundled in the approved browser extension and SHALL NOT route tracker requests through the OSI server. Extension availability, protocol, and permission errors SHALL remain distinguishable from upstream errors.

#### Scenario: Same operation yields identical results across modes
- **WHEN** the same contract operation runs under authorized `client`, `server`, and `extension` configurations against equivalent upstream responses
- **THEN** the returned adapter-neutral result, quirk handling, and upstream error classification SHALL be identical and only the execution path SHALL differ

#### Scenario: Server mode delegates to the same adapter
- **WHEN** the OSI server forwards a contract operation for a `server`-mode configuration
- **THEN** it SHALL delegate to the same provider adapter used in `client` mode rather than reimplementing provider behavior

#### Scenario: Extension mode delegates all operations
- **WHEN** a configured extension operation performs search, lookup, activities, account resolution, same-day logs, date-range logs, or creation
- **THEN** it SHALL invoke the shared provider implementation through the extension's guarded network transport

### Requirement: REQ-203 Credential hygiene across the contract

For every contract operation the API secret SHALL NOT be persisted, logged, serialized, or returned by the OSI server, and SHALL NOT appear in any error payload. Under `client` execution mode the secret SHALL be transmitted only to the configured tracker origin and SHALL NOT appear in any OSI API request, response, or persisted record. Under `server` execution mode the secret MAY be transmitted to the OSI server per request solely for immediate upstream forwarding and SHALL NOT be persisted, logged, or returned. Under `extension` execution mode the browser-held secret SHALL pass transiently through the approved extension solely to authenticate requests to the approved tracker destination; it SHALL NOT appear in OSI API traffic, extension persistent storage, logs, handshake messages, or responses to the page. The credential-bearing local request message is permitted; serialized errors and diagnostics SHALL NOT contain it.

#### Scenario: Client-mode secret stays browser-to-tracker only
- **WHEN** a contract operation runs under a `client` configuration
- **THEN** the secret SHALL be sent only to the configured tracker origin and SHALL NOT appear in any OSI request, response, or record

#### Scenario: Server-mode secret is used once and never retained
- **WHEN** the browser forwards the secret to the OSI server for a `server`-mode operation
- **THEN** the server SHALL use it only for the single upstream call and SHALL NOT persist, log, serialize, or return it

#### Scenario: Extension secret is transient
- **WHEN** an operation succeeds or fails through the extension
- **THEN** the secret SHALL have been used only for that approved operation and SHALL NOT be retained in extension storage, returned, logged, or sent to OSI APIs

### Requirement: REQ-206 Shared translated error contract for all providers

The contract SHALL map upstream outcomes into distinct translated `{ messageKey, params }` errors that mirror the client-mode error states across every provider and all three execution modes: rejected credential, connection failure or timeout, and not-found. Raw upstream status text or response bodies SHALL NOT be returned to the client, so callers render equivalent translated states regardless of provider or execution mode. Extension-specific availability, compatibility, permission, and unknown-create-outcome failures SHALL use distinct safe translated errors rather than masquerading as upstream credential failures.

#### Scenario: Rejected credential maps to a distinct key
- **WHEN** the tracker rejects the credential in any execution mode
- **THEN** the contract SHALL surface a distinct translated authentication `messageKey` without exposing the raw upstream body

#### Scenario: Connection failure maps to a distinct key
- **WHEN** the upstream request fails to connect, times out, or its host cannot be resolved
- **THEN** the contract SHALL surface a distinct translated connection `messageKey`, with an unknown-outcome warning when extension-executed time-entry creation may already have occurred

#### Scenario: Error states are provider- and mode-independent
- **WHEN** the same upstream failure class occurs for different providers or execution modes
- **THEN** the caller SHALL receive equivalent translated `{ messageKey, params }` states

#### Scenario: Extension failure is actionable
- **WHEN** extension authorization or protocol negotiation fails before tracker execution
- **THEN** the caller SHALL receive the corresponding extension-specific message without raw payloads or credentials