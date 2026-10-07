# remote-adapter-contract Specification

## Purpose

One provider-neutral contract that every tracker adapter (OpenProject, Redmine) implements, giving the same results whether called directly from the browser or through the extension, so callers never branch on provider type and tracker secrets never reach OSI.

## Requirements
### Requirement: REQ-200 Neutral remote-tracker adapter operation set

The system SHALL define one provider-neutral remote-tracker adapter contract implemented by every
provider. It SHALL expose issue title search, exact issue-ID lookup, remote project catalog listing, activity options, current-account
resolution, same-day time-log fetch, date-range time-log fetch, time-entry creation, and time-entry
deletion. Operations SHALL use adapter-neutral DTOs and callers SHALL NOT branch on provider type.

#### Scenario: Every provider adapter satisfies the operation set
- **WHEN** a provider is registered
- **THEN** it SHALL implement all nine neutral operations

#### Scenario: Callers depend on the contract, not the provider
- **WHEN** a caller creates, reads, or deletes a remote time entry
- **THEN** it SHALL use the neutral contract without provider-specific branching

### Requirement: REQ-318 Remote project catalog listing
One operation SHALL list the credential's visible remote projects as neutral entries only: an opaque remote project id, a display title, and an optional parent id. It SHALL follow pagination until the upstream total or a fixed maximum page count. Directly from the browser the secret SHALL go only to the tracker origin; through the extension, only to the approved request. An upstream failure SHALL raise the translated `{ messageKey, params }` error, never return an empty list.

#### Scenario: Catalog spans several pages
- **WHEN** the tracker reports more projects than one page holds
- **THEN** the adapter SHALL follow pagination and return the combined neutral list

#### Scenario: Pagination is bounded
- **WHEN** the upstream total would imply more pages than the fixed maximum
- **THEN** the adapter SHALL stop at the bound rather than issuing unbounded requests

#### Scenario: Hierarchy is exposed through the parent id only
- **WHEN** a remote project has a parent
- **THEN** its neutral entry SHALL carry the parent's remote project id and no other hierarchy data

#### Scenario: Catalog fetch fails
- **WHEN** the tracker rejects the credential or cannot be reached
- **THEN** the adapter SHALL raise the shared translated error rather than returning an empty catalog

### Requirement: REQ-319 Optional remote project scope on search and lookup
Issue title search and exact issue-ID lookup SHALL accept an optional scope of one remote project id. A scoped title search SHALL return only issues of that project or any of its descendants, whatever the provider's defaults or instance settings, so the scope means the same everywhere. Without a scope both SHALL search the whole tracker. The search result shape SHALL stay `{ remoteIssueId, title, remoteProjectTitle? }`, with no remote project id (REQ-266).

#### Scenario: Scoped title search returns the subtree
- **WHEN** a title search carries a scope whose remote project has descendant projects
- **THEN** the results SHALL include matching issues from the root and every descendant and SHALL exclude issues from other projects

#### Scenario: Unscoped search covers the whole tracker
- **WHEN** a title search carries no scope
- **THEN** the adapter SHALL search the whole tracker

#### Scenario: Scoped search against a missing remote project
- **WHEN** the scoped remote project no longer exists or is not visible to the credential
- **THEN** the adapter SHALL raise the shared translated search error and SHALL NOT silently return tracker-wide results

### Requirement: REQ-320 Exact lookup reports scope membership
Exact issue-ID lookup SHALL return not-found or `{ result, inScope }` with the neutral result. With a scope, `inScope` SHALL come from asking the tracker whether the issue is in the scoped subtree, and an existing issue outside it SHALL still be returned with `inScope: false`; without a scope `inScope` is `true`. An upstream 404 at either step SHALL resolve to not-found (REQ-204); other failures SHALL be errors.

#### Scenario: Issue inside the subtree
- **WHEN** an exact lookup with a scope targets an issue in a descendant of the scoped project
- **THEN** the adapter SHALL return the result with `inScope: true`

#### Scenario: Issue outside the subtree
- **WHEN** an exact lookup with a scope targets an existing issue in an unrelated project
- **THEN** the adapter SHALL return the result with `inScope: false` and SHALL NOT raise an error

#### Scenario: Issue does not exist
- **WHEN** an exact lookup with a scope targets an id the tracker answers with 404
- **THEN** the adapter SHALL return not-found

#### Scenario: Lookup without scope
- **WHEN** an exact lookup carries no scope
- **THEN** the adapter SHALL return `inScope: true` for any found issue

### Requirement: REQ-296 Date-range time-log fetch
The contract SHALL expose one bounded date-range operation for the current account's logs on an inclusive `from`/`to` local-date pair, without issue filtering. `client` SHALL send the secret only to the tracker origin; `extension` SHALL use it transiently only for the approved tracker request. Same-day issue-filtered fetch SHALL remain available for Remote Sync.

#### Scenario: Range returns logs across the month without issue filter
- **WHEN** a caller requests a valid date range
- **THEN** the adapter SHALL return current-account logs across that range, including unlinked issues, within the pagination bound

#### Scenario: Secrets avoid OSI APIs
- **WHEN** either supported mode performs a range fetch
- **THEN** the secret SHALL NOT appear in OSI API traffic

#### Scenario: Pagination is bounded
- **WHEN** an upstream total exceeds the fixed page bound
- **THEN** the adapter SHALL stop at that bound

#### Scenario: Same-day fetch stays a separate operation
- **WHEN** Remote Sync requests issue-filtered same-day logs
- **THEN** it SHALL continue using the same-day operation

### Requirement: REQ-341 Time logs carry optional remote project and issue title
Same-day and date-range time logs SHALL carry an optional remote project id (opaque) and title, and a **required, nullable** remote issue title (REQ-476). Adapters SHALL fill the project fields only from the fetched payload, omitting unusable ones. The issue title SHALL be the issue's display title, from the payload when it carries titles, otherwise resolved per REQ-378. Callers SHALL NOT branch on provider type to get these fields, and the extension SHALL pass them through unchanged.

#### Scenario: Provider supplies the project on the log
- **WHEN** a range fetch returns a log whose payload names its project
- **THEN** the neutral log SHALL carry that project's remote id and title

#### Scenario: Provider supplies the issue title on the log
- **WHEN** a log payload includes the issue's display title
- **THEN** the neutral log SHALL carry it as the remote issue title and no issue lookup SHALL be made for that issue

#### Scenario: Payload lacks the issue title
- **WHEN** the provider's time-log payload does not carry issue titles and the issue is visible to the account
- **THEN** the neutral log SHALL still carry the issue's display title

#### Scenario: Provider omits a field
- **WHEN** a log payload has no usable project
- **THEN** the project fields SHALL be absent and the log SHALL otherwise be returned unchanged

#### Scenario: No extra requests
- **WHEN** an adapter maps a page of time logs that all carry their issue title
- **THEN** it SHALL NOT perform any request beyond the page fetch; requests for missing titles are bounded by REQ-378

#### Scenario: Extension mode preserves the fields
- **WHEN** a range fetch runs through the approved extension
- **THEN** the fields present in the adapter result, including a `null` issue title, SHALL reach the page unchanged

### Requirement: REQ-476 An issue title is null only when the tracker hides the issue
A time log's remote issue title SHALL be `null` only when the tracker does not disclose the issue to the configured account (deleted, or not visible), never because of which provider produced the log. Generally, an optional or nullable field of a neutral DTO SHALL be empty only for a reason in the remote data, never because of the provider type.

#### Scenario: Issue not disclosed to the account
- **WHEN** a log references an issue that the tracker does not return to the configured account
- **THEN** the neutral log SHALL carry a `null` remote issue title and SHALL otherwise be returned unchanged

### Requirement: REQ-266 Search and lookup results include optional remote project title
Title search and exact lookup SHALL return the same neutral result: issue id, issue title and an optional remote project title, set to the tracker's project display name when the payload has a usable one and omitted otherwise. The result SHALL NOT include a remote project id, href or other project identifier; adapters SHALL map only the display name and SHALL NOT leak provider project objects.

#### Scenario: Result includes a remote project title
- **WHEN** title search or exact-ID lookup receives a provider payload that includes a usable project display name
- **THEN** the adapter-neutral result SHALL include that name as the remote project title and SHALL NOT include a remote project id

#### Scenario: Result omits a missing project title
- **WHEN** title search or exact-ID lookup receives an otherwise valid issue payload with no usable project display name
- **THEN** the adapter-neutral result SHALL still include remote issue ID and title and SHALL omit the remote project title

#### Scenario: Callers do not branch on provider project fields
- **WHEN** a caller renders or persists a search result
- **THEN** it SHALL read only the adapter-neutral remote project title and SHALL NOT inspect provider-specific project fields

### Requirement: REQ-201 Execution-mode equivalence is a contract invariant

The contract SHALL behave equivalently under authorized client and extension execution for every
operation, except for extension-specific setup failures. Client mode SHALL call the tracker directly;
extension mode SHALL delegate to the same provider implementation in the approved extension. Tracker
requests and credentials SHALL NOT pass through the OSI server.

#### Scenario: Same operation yields identical results across modes
- **WHEN** equivalent upstream responses occur in client and extension modes
- **THEN** results and upstream error classifications SHALL be equivalent

#### Scenario: Extension mode delegates all operations
- **WHEN** a time-entry deletion runs in extension mode
- **THEN** it SHALL invoke the same provider deletion behavior through the guarded extension transport

#### Scenario: Extension remains distinguishable
- **WHEN** extension availability, compatibility, or permission fails before tracker execution
- **THEN** the caller SHALL receive the corresponding extension-specific error

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

### Requirement: REQ-202 Transport neutrality and single-point auth construction

Transports SHALL be credential-scheme-agnostic: a transport SHALL attach only the headers supplied with the request and SHALL NOT construct any provider-specific credential itself. Each provider adapter SHALL construct its own authentication header in exactly one place. The credential scheme (e.g. an API-key header, a Basic-auth header) is a provider concern owned entirely by that provider's adapter, never by the contract or the transports.

#### Scenario: Transport attaches only supplied headers
- **WHEN** either transport executes a remote request
- **THEN** it SHALL attach only the headers provided by the adapter and SHALL NOT add provider-specific credentials of its own

#### Scenario: Auth header is built in one adapter location
- **WHEN** a provider adapter authenticates an upstream request
- **THEN** it SHALL construct its credential header in exactly one place and no other component SHALL replicate that scheme

### Requirement: REQ-203 Credential hygiene across the contract
For every operation the secret SHALL NOT be persisted, logged, serialized, returned, or included in an error. Under `client`, it SHALL travel only to the configured tracker origin. Under `extension`, it SHALL pass transiently through the approved extension solely for the approved destination and SHALL NOT enter OSI API traffic, extension storage, handshake messages, logs, or responses to the page.

#### Scenario: Client-mode secret stays browser-to-tracker only
- **WHEN** an operation runs under `client`
- **THEN** its secret SHALL go only to the configured tracker origin

#### Scenario: Extension secret is transient
- **WHEN** an extension operation succeeds or fails
- **THEN** its secret SHALL NOT be retained, returned, logged, or sent to OSI APIs

### Requirement: REQ-204 Not-found resolves to an empty result, not an error

An exact issue-ID lookup that the tracker answers with an upstream 404 SHALL resolve to an empty (not-found) result rather than an error, uniformly across all providers. Other upstream failures SHALL be surfaced as errors per the shared error contract and SHALL NOT be conflated with not-found.

#### Scenario: Upstream 404 becomes not-found
- **WHEN** an exact issue-ID lookup receives an upstream 404 from any provider
- **THEN** the contract SHALL return an empty not-found result rather than raising an error

#### Scenario: Non-404 failure is not treated as not-found
- **WHEN** an exact issue-ID lookup fails for a reason other than 404
- **THEN** the contract SHALL classify it as the appropriate error rather than as not-found

### Requirement: REQ-205 Provider-specific issue-URL derivation via abstraction

The contract SHALL derive an issue URL from a configuration's normalized base URL and remote issue ID using the URL pattern of the configuration's `systemType`, resolved through a per-provider abstraction rather than conditional branching. Each provider adapter SHALL own its own URL pattern.

#### Scenario: URL is derived from the provider's pattern
- **WHEN** a reference's originating configuration is active and available
- **THEN** the contract SHALL derive a direct issue URL from the current base URL and encoded remote issue ID using that `systemType`'s registered URL pattern

#### Scenario: URL derivation avoids conditional branching
- **WHEN** a new provider's URL pattern is added
- **THEN** it SHALL be provided through the per-provider abstraction without adding `systemType` conditionals in shared code

### Requirement: REQ-206 Shared translated error contract for all providers
The contract SHALL map rejected credentials, connection failures or timeouts, and not-found outcomes into equivalent translated `{ messageKey, params }` states across providers and the two supported modes. Raw upstream payloads SHALL NOT be exposed. Extension availability, compatibility, permission, and unknown-create-outcome failures SHALL remain distinct.

#### Scenario: Rejected credential maps to a distinct key
- **WHEN** the tracker rejects a credential
- **THEN** the contract SHALL expose a safe translated authentication key

#### Scenario: Connection failure maps to a distinct key
- **WHEN** the tracker cannot be reached or times out
- **THEN** the contract SHALL expose a safe translated connection key

#### Scenario: Error states are provider- and mode-independent
- **WHEN** the same upstream failure occurs through `client` or `extension`
- **THEN** the caller SHALL receive an equivalent safe translated state

#### Scenario: Extension failure is actionable
- **WHEN** extension setup fails before tracker execution
- **THEN** the caller SHALL receive a distinct extension-specific message

### Requirement: REQ-287 Upstream payloads are parsed with zod
Every upstream response SHALL be checked against the shape its operation expects, supplied by the provider adapter at each call. A response that does not match SHALL yield an empty payload (or the operation's documented empty result), never unchecked data treated as the expected type.

#### Scenario: Transport parse success yields typed payload
- **WHEN** an upstream response body matches the expected shape
- **THEN** the transport SHALL return that parsed value as `payload`

#### Scenario: Transport parse failure does not leak raw JSON as T
- **WHEN** an upstream response body does not match the expected shape
- **THEN** the transport SHALL return `payload: null` (or the operation's empty result) and SHALL NOT treat the raw JSON as the expected type

### Requirement: REQ-332 Activity options resolve to a provider-defined scope
A caller SHALL be able to derive, without a remote request, the activity scope of an issue for a provider, and fetch options once per scope. Each provider SHALL own its rule: tracker-wide activities map every issue to one scope; work-package-dependent activities give each issue its own. Callers SHALL NOT branch on provider type, and issues in one scope SHALL get identical options from a single fetch.

#### Scenario: Tracker-wide activities share one scope
- **WHEN** several issues on a tracker whose activities are a global enumeration (Redmine) are asked for their activity scope
- **THEN** every issue SHALL resolve to the same scope key and one activity fetch SHALL serve all of them

#### Scenario: Work-package-dependent activities keep per-issue scope
- **WHEN** several issues on a tracker whose activity options depend on the work package (OpenProject) are asked for their activity scope
- **THEN** each issue SHALL resolve to a distinct scope key and each SHALL be fetched separately

#### Scenario: Scope resolution never contacts the tracker
- **WHEN** a caller resolves activity scopes for a whole day of issues
- **THEN** no remote request SHALL be made until the caller fetches options for a scope

### Requirement: REQ-333 Time-log fetches default to the current account

Same-day and date-range time-log fetches SHALL return only the configured credential's own logs when the caller supplies no explicit account id, using the provider's current-user filter on the tracker side. Callers SHALL NOT be required to resolve the current account before fetching logs; the current-account operation SHALL remain available on the contract but SHALL NOT be a prerequisite for correct log scoping. When an explicit account id is supplied it SHALL take precedence.

#### Scenario: Same-day fetch without an account id
- **WHEN** a caller fetches same-day logs for a set of issues without an account id
- **THEN** the adapter SHALL return only the credential's own logs for those issues and that day, and SHALL NOT first call the current-account operation

#### Scenario: Range fetch without an account id
- **WHEN** a caller fetches a date range without an account id
- **THEN** the adapter SHALL return only the credential's own logs across that range

#### Scenario: Other accounts remain excluded
- **WHEN** other accounts have logs on the same issue and day
- **THEN** those logs SHALL NOT be returned

#### Scenario: Explicit account id is honored
- **WHEN** a caller supplies an account id
- **THEN** the adapter SHALL filter by that id rather than the current-user sentinel

### Requirement: REQ-378 Missing issue titles are resolved by a bounded batched lookup
When a provider's logs lack issue titles (Redmine, REQ-343), a fetch SHALL resolve its distinct issue ids before returning in lookups of at most 100 ids: none when nothing is missing, at most ⌈missing / 100⌉ otherwise. Issues of any status, closed included, SHALL resolve; an id absent from the answer gets a `null` title (REQ-476). A provider whose logs carry titles (OpenProject, REQ-342) SHALL make no lookup. Lookups SHALL use the log fetch's credential, path and origin.

#### Scenario: Title-carrying provider needs no lookup
- **WHEN** an OpenProject fetch returns logs, including one whose link carries no title
- **THEN** the fetch SHALL make no request beyond the log pages and that log's title SHALL be `null`

#### Scenario: Lookups are batched
- **WHEN** a Redmine month's logs reference 230 distinct issues
- **THEN** the fetch SHALL make exactly 3 lookup requests in addition to the log pages

#### Scenario: Closed issue keeps its title
- **WHEN** a Redmine log references an issue that has since been closed
- **THEN** the neutral log SHALL carry that issue's title

#### Scenario: Lookup stays on the tracker origin
- **WHEN** a lookup runs under client or extension execution
- **THEN** it SHALL target only the configured tracker origin and the secret SHALL NOT appear in OSI API traffic

### Requirement: REQ-477 A failed title lookup fails the fetch
A failed title lookup (rejected credentials, connection failure, timeout or an unparseable payload) SHALL fail the whole fetch with the same translated time-log fetch error as a failed log page, and SHALL NOT be reported as `null` titles.

#### Scenario: Lookup failure fails the fetch
- **WHEN** the Redmine log pages succeed but a title lookup request fails
- **THEN** the fetch SHALL fail with the translated time-log fetch error and SHALL NOT return logs with `null` titles
