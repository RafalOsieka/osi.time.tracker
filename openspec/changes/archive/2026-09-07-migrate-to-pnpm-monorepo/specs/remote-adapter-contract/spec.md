## MODIFIED Requirements

### Requirement: REQ-200 Neutral remote-tracker adapter operation set

The system SHALL define a single provider-neutral remote-tracker adapter contract that every tracker provider implements. The contract SHALL expose exactly these operations: issue title search, exact issue-ID lookup, activity options, current-account resolution, same-day time-log fetch, **date-range time-log fetch**, and time-entry creation. Every operation SHALL accept and return only adapter-neutral DTOs defined once in the independently consumable tracker package and decoupled from any provider's wire format; a provider adapter SHALL NOT leak provider-specific field names or shapes across the contract boundary. Callers (local linking, remote sync, reports, server proxy) SHALL depend only on this contract and SHALL NOT branch on `systemType`.

#### Scenario: Every provider adapter satisfies the operation set
- **WHEN** a provider adapter is registered for a `systemType`
- **THEN** it SHALL implement all seven contract operations and SHALL expose only adapter-neutral DTOs to callers

#### Scenario: Callers depend on the contract, not the provider
- **WHEN** a caller performs a search, lookup, activity fetch, account resolution, same-day log fetch, date-range log fetch, or entry creation
- **THEN** it SHALL invoke the neutral contract for the Client's configured `systemType` without provider-specific conditional branching