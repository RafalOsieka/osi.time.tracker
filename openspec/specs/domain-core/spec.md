# domain-core Specification

## Purpose
TBD - created by archiving change domain-remodeling. Update Purpose after archive.
## Requirements
### Requirement: Token storage keyed by project
API tokens for remote systems SHALL be stored in browser `localStorage` using the key `osi_token_{projectId}` (previously keyed per item).

#### Scenario: Token stored for a project
- **WHEN** a user enters an API token for a project's remote system
- **THEN** it is saved in `localStorage` under `osi_token_{projectId}`

#### Scenario: Token retrieved for publish
- **WHEN** the publish flow runs for a project
- **THEN** the token is read from `localStorage` using `osi_token_{projectId}`

