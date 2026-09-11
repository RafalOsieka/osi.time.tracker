# openproject-adapter Specification

## Purpose

Define the OpenProject implementation of the neutral remote-tracker adapter:
work-package title search and exact ID lookup, project-scoped activity options,
current-account resolution, bounded same-day time-log fetch, and time-entry
creation — speaking only adapter-neutral DTOs, authenticating via the
OpenProject API-key Basic auth header, and mapping upstream failures to the
shared translated error contract.
## Requirements
### Requirement: REQ-210 OpenProject adapter implements the neutral remote-tracker contract
For an active OpenProject tracker, the adapter SHALL implement all nine neutral operations under `client` and `extension`, expose only adapter-neutral DTOs, map project display titles when usable, map upstream failures to the shared translated contract, and resolve exact-lookup 404 responses as not found. Provider behavior SHALL remain equivalent across the two modes.

#### Scenario: Title search returns matching OpenProject work packages
- **WHEN** the user submits a valid title search under a supported execution mode
- **THEN** the adapter SHALL return a bounded neutral result set including optional project titles

#### Scenario: Exact work-package-ID lookup resolves or reports not found
- **WHEN** the user submits an exact work-package ID
- **THEN** the adapter SHALL return its neutral result or not found for an upstream 404

#### Scenario: Project title is mapped when OpenProject provides it
- **WHEN** a work package has a usable project display name
- **THEN** the result SHALL include it without a project id or href

#### Scenario: Missing project title does not drop the work package
- **WHEN** a valid work package lacks a usable project title
- **THEN** the result SHALL retain its issue id and title

#### Scenario: Works in both execution modes
- **WHEN** the same OpenProject operation receives equivalent upstream responses under `client` and `extension`
- **THEN** its result, quirks, and upstream error classification SHALL be identical

### Requirement: REQ-323 OpenProject remote project catalog
The OpenProject adapter SHALL implement the catalog operation (REQ-318) by listing projects through the projects collection endpoint with page-size/offset pagination, following pages until the reported total is reached or the same fixed maximum page count used for time logs. Each project SHALL map to the neutral entry using its numeric id as opaque text, its name as the title, and the id extracted from its parent link when present. No hrefs SHALL cross the contract boundary.

#### Scenario: Projects are listed across pages
- **WHEN** OpenProject reports more projects than one page
- **THEN** the adapter SHALL follow pagination and return the combined neutral list

#### Scenario: Parent is mapped from the parent link
- **WHEN** a project payload carries a parent link
- **THEN** the neutral entry SHALL expose only the parent's id derived from that link

### Requirement: REQ-324 OpenProject scoped search includes all subprojects
When a scope is supplied, the OpenProject adapter SHALL query the project-scoped work-packages endpoint for the given project id (which includes descendant projects), combined with the existing subject filter and result bound. Exact-lookup scope membership (REQ-320) SHALL be decided by querying the same scoped endpoint filtered to the requested work-package id; an empty scoped answer followed by a successful direct work-package lookup SHALL yield `inScope: false`.

#### Scenario: Descendants are included
- **WHEN** a scoped title search runs against a project with subprojects
- **THEN** matching work packages from the root and all subprojects SHALL be returned

#### Scenario: Scoped lookup finds a subproject work package
- **WHEN** an exact lookup with a scope targets a work package in a subproject of the scoped project
- **THEN** the scoped query SHALL find it and the adapter SHALL return `inScope: true` without a second request

#### Scenario: Scoped lookup misses, direct lookup finds
- **WHEN** the scoped query returns no work package for the id but the direct work-package endpoint returns it
- **THEN** the adapter SHALL return that result with `inScope: false`

#### Scenario: Scoped project is gone
- **WHEN** OpenProject answers the scoped query with 404 or 403 for the project
- **THEN** the adapter SHALL raise the shared translated search error

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

