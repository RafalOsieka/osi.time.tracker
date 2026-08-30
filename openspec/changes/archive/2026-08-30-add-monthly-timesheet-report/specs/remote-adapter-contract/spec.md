## MODIFIED Requirements

### Requirement: REQ-200 Neutral remote-tracker adapter operation set

The system SHALL define a single provider-neutral remote-tracker adapter contract that every tracker provider implements. The contract SHALL expose exactly these operations: issue title search, exact issue-ID lookup, activity options, current-account resolution, same-day time-log fetch, **date-range time-log fetch**, and time-entry creation. Every operation SHALL accept and return only adapter-neutral DTOs defined once in `shared/types` and decoupled from any provider's wire format; a provider adapter SHALL NOT leak provider-specific field names or shapes across the contract boundary. Callers (local linking, remote sync, reports, server proxy) SHALL depend only on this contract and SHALL NOT branch on `systemType`.

#### Scenario: Every provider adapter satisfies the operation set
- **WHEN** a provider adapter is registered for a `systemType`
- **THEN** it SHALL implement all seven contract operations and SHALL expose only adapter-neutral DTOs to callers

#### Scenario: Callers depend on the contract, not the provider
- **WHEN** a caller performs a search, lookup, activity fetch, account resolution, same-day log fetch, date-range log fetch, or entry creation
- **THEN** it SHALL invoke the neutral contract for the Client's configured `systemType` without provider-specific conditional branching

## ADDED Requirements

### Requirement: REQ-296 Date-range time-log fetch

The contract SHALL expose a date-range time-log operation that fetches the current remote account's time logs whose `spentOn` falls on an inclusive `from`/`to` pair of local calendar days (`YYYY-MM-DD`). The operation SHALL NOT filter by work-package or issue id. It SHALL return the same adapter-neutral `RemoteTimeLogDto` list as the same-day fetch. Pagination SHALL be bounded by a fixed maximum page count so an inconsistent upstream total cannot cause unbounded requests. Same-day `fetchTimeLogs` (issue-filtered, one day) SHALL remain for Remote Sync and SHALL NOT be used by looping the range operation per day. Under `client` execution mode the secret SHALL go only to the tracker origin; under `server` execution mode the browser SHALL send the range request and per-request secret to the OSI server, which SHALL forward it and SHALL NOT persist the secret (REQ-201, REQ-203).

#### Scenario: Range returns logs across the month without issue filter
- **WHEN** a caller requests logs from `2026-08-01` through `2026-08-31` for the current account
- **THEN** the adapter SHALL return that account's logs in the range, including logs on issues that are not linked in OSI

#### Scenario: Pagination is bounded
- **WHEN** the upstream total would imply more pages than the fixed maximum
- **THEN** the adapter SHALL stop at the bound rather than issuing unbounded requests

#### Scenario: Same-day fetch is unchanged
- **WHEN** Remote Sync requests same-day logs for linked issues
- **THEN** it SHALL continue to use the existing same-day operation and SHALL NOT be required to call the range operation

#### Scenario: Server-mode proxy does not keep the secret
- **WHEN** a `server`-mode range fetch is proxied through the OSI server
- **THEN** the server SHALL use the secret only for that upstream call and SHALL NOT persist, log, serialize, or return it
