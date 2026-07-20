# redmine-adapter Specification

## Purpose
TBD - created by archiving change add-redmine-adapter. Update Purpose after archive.
## Requirements
### Requirement: REQ-TTR-125 Redmine adapter implements the neutral remote-tracker contract

For a Client with an active Redmine configuration, the system SHALL provide a Redmine implementation of the neutral remote-tracker adapter supporting issue title search, exact issue-ID lookup, activity options, current-account resolution, same-day time-log fetch, and time-entry creation. The adapter SHALL speak only adapter-neutral DTOs, SHALL work identically under both `client` and `server` execution modes, and SHALL map upstream failures to the shared translated `{ messageKey, params }` error contract. Exact issue-ID lookups answered with an upstream 404 SHALL resolve to an empty (not-found) result rather than an error, matching the OpenProject convention.

#### Scenario: Title search returns matching Redmine issues
- **WHEN** the user submits a valid title search for an eligible Task under an active Redmine configuration
- **THEN** the adapter SHALL query the configured Redmine origin's issues endpoint with a subject filter including open and closed issues and SHALL return a bounded, adapter-neutral result set of remote issue IDs and titles

#### Scenario: Exact issue-ID lookup resolves or reports not found
- **WHEN** the user submits an exact issue-ID search
- **THEN** the adapter SHALL fetch that Redmine issue and return it, or resolve to a not-found result when Redmine answers 404

#### Scenario: Works in both execution modes
- **WHEN** the same operation runs under a `client` configuration and under a `server` configuration
- **THEN** results, quirk handling, and error classification SHALL be identical, with only the transport differing

### Requirement: REQ-TTR-126 Redmine authentication uses the API access key header

The Redmine client SHALL authenticate every upstream request with the user's Redmine API access key sent in the `X-Redmine-API-Key` request header. The auth header SHALL be constructed by the Redmine client in exactly one place; transports SHALL remain credential-scheme-agnostic and SHALL only attach headers provided with the request. Existing credential-hygiene rules apply unchanged: the secret SHALL NOT be persisted, logged, serialized, or returned by the OSI server, and under `client` execution mode it SHALL be sent only to the configured Redmine origin.

#### Scenario: Requests carry the Redmine API key header
- **WHEN** the adapter executes any Redmine operation with a provided secret
- **THEN** the upstream request SHALL include the `X-Redmine-API-Key` header and no OpenProject-style Basic auth header

#### Scenario: Transports contain no provider auth logic
- **WHEN** either transport executes a remote request
- **THEN** it SHALL attach only the headers supplied by the provider client and SHALL NOT construct provider-specific credentials itself

### Requirement: REQ-TTR-127 Global activity options independent of the issue

The Redmine adapter SHALL provide time-entry activity options from Redmine's global time-entry-activities enumeration. The adapter's activity-options operation SHALL accept the remote issue ID argument required by the neutral contract but MAY ignore it; per-project activity overrides are out of scope.

#### Scenario: Activity options come from the global enumeration
- **WHEN** the Remote Sync page requests activity options for a Redmine-linked task
- **THEN** the adapter SHALL return the global enumeration's active activities as adapter-neutral options regardless of the issue id supplied

### Requirement: REQ-TTR-128 Durations are exported as decimal hours with shared rounding

Redmine time entries SHALL be created with decimal `hours` derived from the already-rounded duration produced by the shared rounding rules; the adapter SHALL NOT apply any additional rounding rule of its own. Conversion SHALL use 0.01-hour precision on write and SHALL convert fetched decimal hours back to whole seconds on read, so that a value round-trips stably and all `up_15m`/`up_30m`/`up_1h` rounded durations convert losslessly.

#### Scenario: Rounded duration exports losslessly
- **WHEN** a duration rounded by an `up_*` rule is exported to Redmine
- **THEN** the created time entry's `hours` SHALL equal the exact decimal representation of that duration

#### Scenario: Fetched logs convert back to seconds
- **WHEN** the adapter fetches same-day Redmine time entries
- **THEN** each entry's decimal hours SHALL be converted to whole seconds such that re-exporting an unchanged value produces the same `hours`

### Requirement: REQ-TTR-129 Same-day time-log fetch with bounded pagination

The Redmine adapter SHALL fetch the current account's time entries for a given day, filtered to the linked issue IDs and the resolved remote user, following Redmine's offset/limit pagination. The page loop SHALL be bounded by a fixed maximum page count so an inconsistent upstream total cannot cause unbounded requests.

#### Scenario: Day logs are fetched across pages
- **WHEN** the day's matching time entries span multiple Redmine result pages
- **THEN** the adapter SHALL follow offset/limit pagination and return the combined adapter-neutral log list

#### Scenario: Pagination is bounded
- **WHEN** the upstream total would imply more pages than the fixed maximum
- **THEN** the adapter SHALL stop at the bound rather than issuing unbounded requests
