# redmine-adapter Specification

## Purpose

Define the Redmine implementation of the neutral remote-tracker adapter: issue
title search and exact ID lookup, global activity options, current-account
resolution, bounded same-day time-log fetch, and time-entry creation — speaking
only adapter-neutral DTOs, authenticating via the Redmine API key header, and
mapping upstream failures to the shared translated error contract.
## Requirements
### Requirement: REQ-093 Redmine adapter implements the neutral remote-tracker contract
For an active Redmine tracker, the adapter SHALL implement all nine neutral operations under `client` and `extension`, expose only adapter-neutral DTOs, map project display titles when usable, map upstream failures to the shared translated contract, and resolve exact-lookup 404 responses as not found. Provider behavior SHALL remain equivalent across the two modes.

#### Scenario: Title search returns matching Redmine issues
- **WHEN** the user submits a valid title search under a supported execution mode
- **THEN** the adapter SHALL return a bounded neutral result set including optional project titles

#### Scenario: Exact issue-ID lookup resolves or reports not found
- **WHEN** the user submits an exact issue ID
- **THEN** the adapter SHALL return its neutral result or not found for an upstream 404

#### Scenario: Project title is mapped when Redmine provides it
- **WHEN** an issue has a usable project display name
- **THEN** the result SHALL include it without a project id

#### Scenario: Missing project title does not drop the issue
- **WHEN** a valid issue lacks a usable project title
- **THEN** the result SHALL retain its issue id and title

#### Scenario: Works in both execution modes
- **WHEN** the same Redmine operation receives equivalent upstream responses under `client` and `extension`
- **THEN** its result, quirks, and upstream error classification SHALL be identical

### Requirement: REQ-321 Redmine remote project catalog
The Redmine adapter SHALL implement the catalog operation (REQ-318) by listing projects through the projects endpoint with offset/limit pagination, following pages until the reported total is reached or the same fixed maximum page count used for time logs. Each project SHALL map to the neutral entry using its numeric id as opaque text, its name as the title, and its parent id when present.

#### Scenario: Projects are listed across pages
- **WHEN** Redmine reports more projects than one page
- **THEN** the adapter SHALL follow offset/limit pagination and return the combined neutral list

#### Scenario: Parent is mapped from the project payload
- **WHEN** a Redmine project payload carries a parent reference
- **THEN** the neutral entry SHALL expose that parent's id and nothing else from the payload

### Requirement: REQ-322 Redmine scoped search always includes the subtree
When a scope is supplied, the Redmine adapter SHALL scope the issues query to the given project id and SHALL explicitly request all subprojects so that descendants are included regardless of the instance's "display subprojects issues" setting. Exact-lookup scope membership (REQ-320) SHALL be decided by querying the issues endpoint scoped the same way and filtered to the requested issue id; an empty scoped answer followed by a successful unscoped lookup SHALL yield `inScope: false`.

#### Scenario: Descendants are included when the instance setting is off
- **WHEN** the Redmine instance has "display subprojects issues" disabled and a scoped title search runs
- **THEN** issues from descendant projects SHALL still be returned

#### Scenario: Scoped lookup finds a descendant issue
- **WHEN** an exact lookup with a scope targets an issue in a subproject of the scoped project
- **THEN** the scoped issues query SHALL find it and the adapter SHALL return `inScope: true` without a second request

#### Scenario: Scoped lookup misses, unscoped finds
- **WHEN** the scoped issues query returns no issue for the id but the direct issue endpoint returns it
- **THEN** the adapter SHALL return that result with `inScope: false`

#### Scenario: Scoped project is gone
- **WHEN** Redmine answers the scoped issues query with 404 or 403 for the project
- **THEN** the adapter SHALL raise the shared translated search error

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

### Requirement: REQ-343 Redmine time logs map the project from the payload
When mapping a Redmine time entry to the neutral time-log DTO (REQ-341), the adapter SHALL derive the remote project id from `project.id` and the remote project title from `project.name`, omitting each when missing. Redmine time-entry payloads do not carry the issue subject, so the adapter SHALL omit the remote issue title and SHALL NOT look it up. The mapping SHALL apply to both the same-day and the date-range fetch. Time entries without an issue SHALL continue to be dropped.

#### Scenario: Project present
- **WHEN** a time entry carries `project: { id: 7, name: "Internal" }`
- **THEN** the neutral log SHALL have remote project id `7` and remote project title `Internal` and no remote issue title

#### Scenario: Project missing
- **WHEN** a time entry carries no `project`
- **THEN** the neutral log SHALL omit both project fields and SHALL still be returned

#### Scenario: Issue-less entry is still dropped
- **WHEN** a time entry carries a project but no `issue`
- **THEN** it SHALL NOT appear in the neutral result

### Requirement: REQ-094 Redmine authentication uses the API access key header

The Redmine client SHALL authenticate every upstream request with the user's Redmine API access key sent in the `X-Redmine-API-Key` request header. The auth header SHALL be constructed by the Redmine client in exactly one place; transports SHALL remain credential-scheme-agnostic and SHALL only attach headers provided with the request, per the contract's transport-neutrality rule (`remote-adapter-contract` REQ-202). Existing credential-hygiene rules apply unchanged (`remote-adapter-contract` REQ-203): the secret SHALL NOT be persisted, logged, serialized, or returned by the OSI server, and under `client` execution mode it SHALL be sent only to the configured Redmine origin.

#### Scenario: Requests carry the Redmine API key header
- **WHEN** the adapter executes any Redmine operation with a provided secret
- **THEN** the upstream request SHALL include the `X-Redmine-API-Key` header and SHALL NOT include any other provider's credential header

#### Scenario: Transports contain no provider auth logic
- **WHEN** either transport executes a remote request
- **THEN** it SHALL attach only the headers supplied by the provider client and SHALL NOT construct provider-specific credentials itself

### Requirement: REQ-095 Global activity options independent of the issue

The Redmine adapter SHALL provide time-entry activity options from Redmine's global time-entry-activities enumeration. The adapter's activity-options operation SHALL accept the remote issue ID argument required by the neutral contract but MAY ignore it; per-project activity overrides are out of scope.

#### Scenario: Activity options come from the global enumeration
- **WHEN** the Remote Sync page requests activity options for a Redmine-linked task
- **THEN** the adapter SHALL return the global enumeration's active activities as adapter-neutral options regardless of the issue id supplied

### Requirement: REQ-096 Durations are exported as decimal hours with shared rounding

Redmine time entries SHALL be created with decimal `hours` derived from the already-rounded duration produced by the shared rounding rules; the adapter SHALL NOT apply any additional rounding rule of its own. Conversion SHALL use 0.01-hour precision on write and SHALL convert fetched decimal hours back to whole seconds on read, so that a value round-trips stably and all `up_15m`/`up_30m`/`up_1h` rounded durations convert losslessly.

#### Scenario: Rounded duration exports losslessly
- **WHEN** a duration rounded by an `up_*` rule is exported to Redmine
- **THEN** the created time entry's `hours` SHALL equal the exact decimal representation of that duration

#### Scenario: Fetched logs convert back to seconds
- **WHEN** the adapter fetches same-day Redmine time entries
- **THEN** each entry's decimal hours SHALL be converted to whole seconds such that re-exporting an unchanged value produces the same `hours`

### Requirement: REQ-097 Same-day time-log fetch with bounded pagination

The Redmine adapter SHALL fetch the current account's time entries for a given day, filtered to the linked issue IDs and the resolved remote user, following Redmine's offset/limit pagination. The page loop SHALL be bounded by a fixed maximum page count so an inconsistent upstream total cannot cause unbounded requests.

#### Scenario: Day logs are fetched across pages
- **WHEN** the day's matching time entries span multiple Redmine result pages
- **THEN** the adapter SHALL follow offset/limit pagination and return the combined adapter-neutral log list

#### Scenario: Pagination is bounded
- **WHEN** the upstream total would imply more pages than the fixed maximum
- **THEN** the adapter SHALL stop at the bound rather than issuing unbounded requests

