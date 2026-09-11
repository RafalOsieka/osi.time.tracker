## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: REQ-318 Remote project catalog listing
The contract SHALL expose one operation that lists the remote projects visible to the configured credential as adapter-neutral entries: a remote project id (opaque text), a display title, and an optional parent remote project id. The operation SHALL follow the provider's pagination until the upstream total is reached or a fixed maximum page count, and SHALL NOT return provider-specific project objects, hrefs, or identifiers other than the neutral fields. Under `client` the secret SHALL travel only to the tracker origin; under `extension` it SHALL be used transiently for the approved tracker request only. Upstream failures SHALL map to a translated `{ messageKey, params }` error and SHALL NOT yield a silent empty list.

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
Issue title search and exact issue-ID lookup SHALL accept an optional scope consisting of one remote project id. When a scope is supplied, a title search SHALL return only issues belonging to that remote project or to any of its descendant projects, regardless of provider defaults or instance settings, so the scope has the same meaning on every provider. When no scope is supplied, both operations SHALL behave as today (tracker-wide). The neutral search result shape SHALL remain `{ remoteIssueId, title, remoteProjectTitle? }` and SHALL NOT gain a remote project id (REQ-266 unchanged).

#### Scenario: Scoped title search returns the subtree
- **WHEN** a title search carries a scope whose remote project has descendant projects
- **THEN** the results SHALL include matching issues from the root and every descendant and SHALL exclude issues from other projects

#### Scenario: Unscoped search is unchanged
- **WHEN** a title search carries no scope
- **THEN** the adapter SHALL search the whole tracker exactly as before

#### Scenario: Scoped search against a missing remote project
- **WHEN** the scoped remote project no longer exists or is not visible to the credential
- **THEN** the adapter SHALL raise the shared translated search error and SHALL NOT silently return tracker-wide results

### Requirement: REQ-320 Exact lookup reports scope membership
Exact issue-ID lookup SHALL return either not-found or a lookup object `{ result, inScope }` where `result` is the neutral search result and `inScope` is a boolean. When a scope is supplied and the issue exists, the adapter SHALL determine `inScope` by asking the tracker whether the issue belongs to the scoped subtree; an existing issue outside the subtree SHALL still be returned with `inScope: false`. When no scope is supplied, `inScope` SHALL be `true`. Upstream 404 SHALL resolve to not-found (REQ-204) in both the scoped and unscoped step; other failures SHALL be surfaced as errors.

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
