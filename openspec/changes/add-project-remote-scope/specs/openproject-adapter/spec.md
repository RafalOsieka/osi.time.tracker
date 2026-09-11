## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: REQ-323 OpenProject remote project catalog
The OpenProject adapter SHALL implement the catalog operation (REQ-318) by listing projects through the projects collection endpoint with page-size/offset pagination, following pages until the reported total is reached or the same fixed maximum page count used for time logs. Each project SHALL map to the neutral entry using its numeric id as opaque text, its name as the title, and the id extracted from its parent link when present. No hrefs SHALL cross the contract boundary.

#### Scenario: Projects are listed across pages
- **WHEN** OpenProject reports more projects than one page
- **THEN** the adapter SHALL follow pagination and return the combined neutral list

#### Scenario: Parent is mapped from the parent link
- **WHEN** a project payload carries a parent link
- **THEN** the neutral entry SHALL expose only the parent's id derived from that link

### Requirement: REQ-324 OpenProject scoped search includes all subprojects
When a scope is supplied, the OpenProject adapter SHALL query the project-scoped work-packages endpoint for the given project id with the subproject filter set to include all subprojects, combined with the existing subject filter and result bound. Exact-lookup scope membership (REQ-320) SHALL be decided by querying the same scoped endpoint filtered to the requested work-package id; an empty scoped answer followed by a successful direct work-package lookup SHALL yield `inScope: false`.

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
