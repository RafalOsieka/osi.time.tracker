## MODIFIED Requirements

### Requirement: REQ-093 Redmine adapter implements the neutral remote-tracker contract

For a Client with an active Redmine configuration, the system SHALL provide a Redmine implementation of the neutral remote-tracker adapter supporting issue title search, exact issue-ID lookup, activity options, current-account resolution, same-day time-log fetch, date-range time-log fetch, and time-entry creation. The adapter SHALL speak only adapter-neutral DTOs, SHALL work identically under both `client` and `server` execution modes, and SHALL map upstream failures to the shared translated `{ messageKey, params }` error contract. Exact issue-ID lookups answered with an upstream 404 SHALL resolve to an empty (not-found) result rather than an error, matching the OpenProject convention. Title search and exact-ID lookup SHALL map the issue's project display name, when present, into the adapter-neutral optional remote project title (REQ-266) and SHALL NOT expose a Redmine project id.

#### Scenario: Title search returns matching Redmine issues
- **WHEN** the user submits a valid title search for an eligible Task under an active Redmine configuration
- **THEN** the adapter SHALL query the configured Redmine origin's issues endpoint with a subject filter including open and closed issues and SHALL return a bounded, adapter-neutral result set of remote issue IDs, titles, and remote project titles when present

#### Scenario: Exact issue-ID lookup resolves or reports not found
- **WHEN** the user submits an exact issue-ID search
- **THEN** the adapter SHALL fetch that Redmine issue and return it, or resolve to a not-found result when Redmine answers 404

#### Scenario: Project title is mapped when Redmine provides it
- **WHEN** an issue payload includes a usable project display name
- **THEN** the adapter-neutral result SHALL include that name as the remote project title and SHALL NOT include the Redmine project id

#### Scenario: Missing project title does not drop the issue
- **WHEN** an issue payload is otherwise valid but has no usable project display name
- **THEN** the adapter SHALL still return the remote issue ID and title and SHALL omit the remote project title

#### Scenario: Works in both execution modes
- **WHEN** the same operation runs under a `client` configuration and under a `server` configuration
- **THEN** results, quirk handling, and error classification SHALL be identical, with only the transport differing

## ADDED Requirements

### Requirement: REQ-298 Redmine date-range time-log fetch

The Redmine adapter SHALL implement the contract's date-range time-log operation (REQ-296) by querying Redmine time entries for the current account with `from`/`to` (or equivalent) covering the inclusive date range, without an issue-id filter, following offset/limit pagination bounded by the same maximum page count as the same-day fetch. Each log SHALL map to `RemoteTimeLogDto` (duration as whole seconds). Upstream failures SHALL map to the shared translated error contract.

#### Scenario: Month range is a single filtered query loop
- **WHEN** reports request Redmine logs from `2026-08-01` through `2026-08-31`
- **THEN** the adapter SHALL filter on the date range and current user, SHALL NOT add an issue id filter, and SHALL follow bounded offset/limit pagination until complete or the page cap

#### Scenario: Logs on unlinked issues are included
- **WHEN** the current account has a time log in range on an issue that is not linked in OSI
- **THEN** that log SHALL be present in the adapter-neutral result

#### Scenario: Upstream failure is classified
- **WHEN** Redmine rejects or fails the range fetch
- **THEN** the adapter SHALL raise a `RemoteAdapterError` with the shared time-logs-fetch translation key and SHALL NOT return a silent empty list
