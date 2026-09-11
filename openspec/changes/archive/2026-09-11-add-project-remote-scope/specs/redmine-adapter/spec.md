## MODIFIED Requirements

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

## ADDED Requirements

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
