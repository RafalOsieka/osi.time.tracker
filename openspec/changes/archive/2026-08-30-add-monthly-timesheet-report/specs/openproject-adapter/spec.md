## MODIFIED Requirements

### Requirement: REQ-210 OpenProject adapter implements the neutral remote-tracker contract

For a Client with an active OpenProject configuration, the system SHALL provide an OpenProject implementation of the neutral remote-tracker adapter contract (`remote-adapter-contract`, REQ-200) supporting work-package title search, exact work-package-ID lookup, activity options, current-account resolution, same-day time-log fetch, date-range time-log fetch, and time-entry creation. The adapter SHALL speak only adapter-neutral DTOs, SHALL work identically under both `client` and `server` execution modes (REQ-201), and SHALL map upstream failures to the shared translated `{ messageKey, params }` error contract (REQ-206). Exact work-package-ID lookups answered with an upstream 404 SHALL resolve to an empty (not-found) result rather than an error (REQ-204). Title search and exact-ID lookup SHALL map the work package's project display name, when present, into the adapter-neutral optional remote project title (REQ-266) and SHALL NOT expose an OpenProject project id or href.

#### Scenario: Title search returns matching OpenProject work packages
- **WHEN** the user submits a valid title search for an eligible Task under an active OpenProject configuration
- **THEN** the adapter SHALL query the configured OpenProject origin's work-packages endpoint filtering on subject and including open and closed work packages, and SHALL return a bounded, adapter-neutral result set of remote issue IDs, titles, and remote project titles when present

#### Scenario: Exact work-package-ID lookup resolves or reports not found
- **WHEN** the user submits an exact work-package-ID search
- **THEN** the adapter SHALL fetch that OpenProject work package and return it, or resolve to a not-found result when OpenProject answers 404

#### Scenario: Project title is mapped when OpenProject provides it
- **WHEN** a work-package payload includes a usable project display name
- **THEN** the adapter-neutral result SHALL include that name as the remote project title and SHALL NOT include the OpenProject project id or href

#### Scenario: Missing project title does not drop the work package
- **WHEN** a work-package payload is otherwise valid but has no usable project display name
- **THEN** the adapter SHALL still return the remote issue ID and title and SHALL omit the remote project title

#### Scenario: Works in both execution modes
- **WHEN** the same operation runs under a `client` configuration and under a `server` configuration
- **THEN** results, quirk handling, and error classification SHALL be identical, with only the transport differing

## ADDED Requirements

### Requirement: REQ-297 OpenProject date-range time-log fetch

The OpenProject adapter SHALL implement the contract's date-range time-log operation (REQ-296) by querying OpenProject time entries for the current account with `spent_on` between the inclusive `from` and `to` dates, without an entity/work-package id filter, following OpenProject pagination bounded by the same maximum page count as the same-day fetch. Each log SHALL map to `RemoteTimeLogDto` (duration as whole seconds). Upstream failures SHALL map to the shared translated error contract.

#### Scenario: Month range is a single filtered query loop
- **WHEN** reports request OpenProject logs from `2026-08-01` through `2026-08-31`
- **THEN** the adapter SHALL filter on the date range and current user, SHALL NOT add a work-package id filter, and SHALL follow bounded pagination until complete or the page cap

#### Scenario: Logs on unlinked work packages are included
- **WHEN** the current account has a time log in range on a work package that is not linked in OSI
- **THEN** that log SHALL be present in the adapter-neutral result

#### Scenario: Upstream failure is classified
- **WHEN** OpenProject rejects or fails the range fetch
- **THEN** the adapter SHALL raise a `RemoteAdapterError` with `error.remoteTimeLogsFetchFailed` (or the shared logs-fetch key) and SHALL NOT return a silent empty list
