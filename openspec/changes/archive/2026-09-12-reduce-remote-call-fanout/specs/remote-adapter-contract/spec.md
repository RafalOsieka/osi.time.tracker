## ADDED Requirements

### Requirement: REQ-332 Activity options resolve to a provider-defined scope

The contract SHALL let a caller derive, without a remote request, the activity scope that a given remote issue belongs to for a given provider, so that callers fetch activity options once per scope and reuse the result across issues sharing it. Each provider SHALL own its scope rule: a provider whose activities are tracker-wide SHALL resolve every issue to the same scope; a provider whose activities depend on the work package SHALL resolve each issue to its own scope. Callers SHALL NOT branch on provider type to compute the scope. Two issues resolving to the same scope SHALL receive identical activity options from one fetch.

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
