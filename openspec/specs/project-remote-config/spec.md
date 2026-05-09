# project-remote-config Specification

## Purpose
TBD - created by archiving change time-tracking-mvp. Update Purpose after archive.
## Requirements
### Requirement: Project stores remote system configuration
A `Project` entity SHALL have optional `RemoteTarget` (enum: Redmine, OpenProject) and `RemoteBaseUrl` (URI) fields. If `RemoteTarget` is set, `RemoteBaseUrl` MUST be a valid URI.

#### Scenario: Project created with remote config
- **WHEN** a project is created with `RemoteTarget` and `RemoteBaseUrl`
- **THEN** the project is persisted with those fields and all items under it share the remote context

#### Scenario: Project created as local-only
- **WHEN** a project is created without `RemoteTarget`
- **THEN** the project is treated as local-only and `RemoteBaseUrl` is not required

### Requirement: Single default project invariant
Exactly one `Project` SHALL be marked `IsDefault = true` at all times. A seeded "Local" project is created on initialization as the default and MUST NOT be deleted.

#### Scenario: Default project exists on first run
- **WHEN** the application starts with no projects in the database
- **THEN** a project named "Local" is created with `IsDefault = true`

#### Scenario: Changing the default project
- **WHEN** a project is set as default
- **THEN** all other projects have `IsDefault` set to `false`

#### Scenario: Deleting the default project is rejected
- **WHEN** a request is made to delete the project with `IsDefault = true`
- **THEN** the operation fails with an error indicating the default project cannot be deleted

