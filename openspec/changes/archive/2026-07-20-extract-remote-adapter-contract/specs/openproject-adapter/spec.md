## ADDED Requirements

### Requirement: REQ-210 OpenProject adapter implements the neutral remote-tracker contract

For a Client with an active OpenProject configuration, the system SHALL provide an OpenProject implementation of the neutral remote-tracker adapter contract (`remote-adapter-contract`, REQ-200) supporting work-package title search, exact work-package-ID lookup, activity options, current-account resolution, same-day time-log fetch, and time-entry creation. The adapter SHALL speak only adapter-neutral DTOs, SHALL work identically under both `client` and `server` execution modes (REQ-201), and SHALL map upstream failures to the shared translated `{ messageKey, params }` error contract (REQ-206). Exact work-package-ID lookups answered with an upstream 404 SHALL resolve to an empty (not-found) result rather than an error (REQ-204).

#### Scenario: Title search returns matching OpenProject work packages
- **WHEN** the user submits a valid title search for an eligible Task under an active OpenProject configuration
- **THEN** the adapter SHALL query the configured OpenProject origin's work-packages endpoint filtering on subject and including open and closed work packages, and SHALL return a bounded, adapter-neutral result set of remote issue IDs and titles

#### Scenario: Exact work-package-ID lookup resolves or reports not found
- **WHEN** the user submits an exact work-package-ID search
- **THEN** the adapter SHALL fetch that OpenProject work package and return it, or resolve to a not-found result when OpenProject answers 404

#### Scenario: Works in both execution modes
- **WHEN** the same operation runs under a `client` configuration and under a `server` configuration
- **THEN** results, quirk handling, and error classification SHALL be identical, with only the transport differing

### Requirement: REQ-211 OpenProject authentication uses the Basic auth header

The OpenProject client SHALL authenticate every upstream request with the user's OpenProject API key encoded as an HTTP Basic authentication header (the fixed username `apikey` and the API key as password), sent in the `Authorization` request header. The auth header SHALL be constructed by the OpenProject client in exactly one place; transports SHALL remain credential-scheme-agnostic and SHALL only attach headers provided with the request (REQ-202). Existing credential-hygiene rules apply unchanged (REQ-203): the secret SHALL NOT be persisted, logged, serialized, or returned by the OSI server, and under `client` execution mode it SHALL be sent only to the configured OpenProject origin.

#### Scenario: Requests carry the OpenProject Basic auth header
- **WHEN** the adapter executes any OpenProject operation with a provided secret
- **THEN** the upstream request SHALL include the `Authorization: Basic` header derived from the API key and no other provider's credential header

#### Scenario: Transports contain no provider auth logic
- **WHEN** either transport executes a remote request
- **THEN** it SHALL attach only the headers supplied by the provider client and SHALL NOT construct provider-specific credentials itself

### Requirement: REQ-212 Project-scoped activity options

The OpenProject adapter SHALL provide time-entry activity options for the work package's resolved project scope. The adapter's activity-options operation SHALL use the remote issue ID argument required by the neutral contract to resolve the applicable project-scoped activities, and rows resolving to the same scope SHALL be able to reuse a single fetch.

#### Scenario: Activity options come from the project scope
- **WHEN** the Remote Sync page requests activity options for an OpenProject-linked task
- **THEN** the adapter SHALL return the project-scoped active time-entry activities for the work package as adapter-neutral options

#### Scenario: Same scope reuses one fetch
- **WHEN** multiple linked tasks resolve to the same OpenProject activity scope
- **THEN** the adapter SHALL be able to fetch the activities once and reuse the result

### Requirement: REQ-213 Durations use shared rounding without additional adapter rounding

OpenProject time entries SHALL be created from the already-rounded duration produced by the shared rounding rules; the adapter SHALL NOT apply any additional rounding rule of its own. Fetched same-day logs SHALL convert their durations back to whole seconds so that an unchanged value round-trips stably and all `up_15m`/`up_30m`/`up_1h` rounded durations convert losslessly.

#### Scenario: Rounded duration exports losslessly
- **WHEN** a duration rounded by an `up_*` rule is exported to OpenProject
- **THEN** the created time entry's duration SHALL equal the exact representation of that duration without further rounding

#### Scenario: Fetched logs convert back to seconds
- **WHEN** the adapter fetches same-day OpenProject time logs
- **THEN** each log's duration SHALL be converted to whole seconds such that re-exporting an unchanged value produces the same value

### Requirement: REQ-214 Same-day time-log fetch with bounded pagination

The OpenProject adapter SHALL resolve the current remote account and fetch that account's time logs for a given day, filtered to the linked work-package IDs and the resolved remote user, following OpenProject's pagination. The page loop SHALL be bounded by a fixed maximum page count so an inconsistent upstream total cannot cause unbounded requests. Fetched logs SHALL be returned as informational, adapter-neutral context only.

#### Scenario: Day logs are fetched across pages
- **WHEN** the day's matching time logs span multiple OpenProject result pages
- **THEN** the adapter SHALL follow pagination and return the combined adapter-neutral log list for the current account

#### Scenario: Pagination is bounded
- **WHEN** the upstream total would imply more pages than the fixed maximum
- **THEN** the adapter SHALL stop at the bound rather than issuing unbounded requests
