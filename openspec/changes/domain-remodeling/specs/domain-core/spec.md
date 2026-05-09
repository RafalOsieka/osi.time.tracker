## ADDED Requirements

### Requirement: Project owns remote configuration
A `Project` entity SHALL have optional `RemoteTarget` (enum: Redmine, OpenProject) and `RemoteBaseUrl` (URI) fields. If `RemoteTarget` is set, `RemoteBaseUrl` MUST be a valid URI.

#### Scenario: Project created with remote config
- **WHEN** a project is created with `RemoteTarget` and `RemoteBaseUrl`
- **THEN** the project is persisted with those fields and items under it inherit the remote context

#### Scenario: Project created without remote config
- **WHEN** a project is created without `RemoteTarget`
- **THEN** `RemoteBaseUrl` is ignored and the project is treated as local-only

### Requirement: Project IsDefault flag with single-default invariant
Exactly one `Project` SHALL be marked `IsDefault = true` at all times. The seeded "Local" project is default on initialization and MUST NOT be deleted.

#### Scenario: Default project seeded on first run
- **WHEN** the application initializes with no projects
- **THEN** a project named "Local" is created with `IsDefault = true`

#### Scenario: Setting a new default project
- **WHEN** a project is marked as default
- **THEN** all other projects have `IsDefault` set to `false`

#### Scenario: Attempt to delete default project
- **WHEN** a request is made to delete the project with `IsDefault = true`
- **THEN** the operation is rejected with an error

### Requirement: Item has optional RemoteId
An `Item` entity SHALL have an optional `RemoteId` string field. When an item is matched to a remote issue, `Item.Title` SHALL be updated to cache the remote issue title.

#### Scenario: Item matched to remote issue
- **WHEN** `PATCH /api/items/{id}/match` is called with a valid `RemoteId`
- **THEN** `Item.RemoteId` is set and `Item.Title` is updated to the remote issue title

#### Scenario: Item used without remote match
- **WHEN** an item has no `RemoteId`
- **THEN** it functions as a local grouping container with its manually set title

### Requirement: TimeEntry has no Note field
`TimeEntry` SHALL NOT have a `Note` field. The `Title` field is the sole task description.

#### Scenario: TimeEntry created with title only
- **WHEN** a time entry is created with a `Title`
- **THEN** it is persisted without any note field

## MODIFIED Requirements

### Requirement: Token storage keyed by project
API tokens for remote systems SHALL be stored in browser `localStorage` using the key `osi_token_{projectId}` (previously keyed per item).

#### Scenario: Token stored for a project
- **WHEN** a user enters an API token for a project's remote system
- **THEN** it is saved in `localStorage` under `osi_token_{projectId}`

#### Scenario: Token retrieved for publish
- **WHEN** the publish flow runs for a project
- **THEN** the token is read from `localStorage` using `osi_token_{projectId}`
