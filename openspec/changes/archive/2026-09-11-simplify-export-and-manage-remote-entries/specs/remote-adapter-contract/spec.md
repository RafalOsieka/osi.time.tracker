## MODIFIED Requirements

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

## ADDED Requirements

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
