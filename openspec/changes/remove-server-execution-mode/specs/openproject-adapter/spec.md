## MODIFIED Requirements

### Requirement: REQ-210 OpenProject adapter implements the neutral remote-tracker contract
For an active OpenProject tracker, the adapter SHALL implement all seven neutral operations under `client` and `extension`, expose only adapter-neutral DTOs, map project display titles when usable, map upstream failures to the shared translated contract, and resolve exact-lookup 404 responses as not found. Provider behavior SHALL remain equivalent across the two modes.

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