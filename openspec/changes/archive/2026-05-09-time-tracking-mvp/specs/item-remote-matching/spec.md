## ADDED Requirements

### Requirement: Item has optional RemoteId
An `Item` entity SHALL have an optional `RemoteId` string field identifying the corresponding issue in the remote system.

#### Scenario: Item created without RemoteId
- **WHEN** an item is created without a `RemoteId`
- **THEN** it functions as a local grouping container with its manually set title

#### Scenario: Item matched to remote issue
- **WHEN** `PATCH /api/items/{id}/match` is called with a valid `RemoteId`
- **THEN** `Item.RemoteId` is set and `Item.Title` is updated to cache the remote issue title

### Requirement: Item title caches remote issue title on match
When an item is matched to a remote issue via `PATCH /api/items/{id}/match`, the system SHALL update `Item.Title` with the title fetched from the remote system.

#### Scenario: Title updated on successful match
- **WHEN** the match endpoint resolves the remote issue title
- **THEN** `Item.Title` is overwritten with the remote title and persisted

#### Scenario: Match fails due to invalid RemoteId
- **WHEN** the remote system returns an error for the given `RemoteId`
- **THEN** `Item.RemoteId` and `Item.Title` remain unchanged and an error is returned to the caller
