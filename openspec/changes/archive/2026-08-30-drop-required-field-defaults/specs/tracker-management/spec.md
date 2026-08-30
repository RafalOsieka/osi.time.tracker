## MODIFIED Requirements

### Requirement: REQ-244 List own trackers
The system SHALL show the authenticated user only their own non-deleted trackers, ordered by name, via `GET /api/trackers`. The list SHALL exclude any tracker whose `deletedAt` is set and any tracker belonging to another user. Each tracker DTO SHALL include non-secret connection fields (`id`, `name`, `systemType`, `baseUrl`, `executionMode`, `roundingRule`, timestamps) and SHALL never include an API secret or required-field defaults.

#### Scenario: User sees only their own trackers
- **WHEN** an authenticated user requests their trackers
- **THEN** the response SHALL contain only trackers where `userId` equals the user's id and `deletedAt` is null, ordered by name

#### Scenario: Soft-deleted trackers are excluded
- **WHEN** an authenticated user has a soft-deleted tracker
- **THEN** that tracker SHALL NOT appear in the list

#### Scenario: Empty state
- **WHEN** an authenticated user has no trackers
- **THEN** the Trackers page SHALL render a dedicated empty state with a create call-to-action instead of an empty table

#### Scenario: Response never exposes a credential
- **WHEN** a user lists or reads a tracker
- **THEN** the response DTO SHALL contain no credential or secret field

#### Scenario: Response never includes required-field defaults
- **WHEN** a user lists or reads a tracker
- **THEN** the response DTO SHALL contain no `requiredFieldDefaults` field

### Requirement: REQ-245 Create a tracker
The system SHALL allow an authenticated user to create a tracker via `POST /api/trackers` with a required `name`, `systemType` (`redmine` or `openproject`), `baseUrl`, `executionMode`, and `roundingRule`. `executionMode` SHALL accept `client` or `server` and SHALL default to `client` when omitted. The `name` SHALL be trimmed, non-empty, length-bounded, and unique per user among non-deleted trackers. `baseUrl` SHALL be a valid URL. On success the created tracker SHALL be returned and a success Toast SHALL be shown. The API secret SHALL NOT be accepted as a stored field. Create and update bodies SHALL NOT accept `requiredFieldDefaults` as a stored field.

#### Scenario: Successful creation
- **WHEN** an authenticated user submits a valid unique name and valid connection fields
- **THEN** the system SHALL create the tracker scoped to the user, return it (without secret), and the new tracker SHALL appear in the list

#### Scenario: Empty name rejected
- **WHEN** the submitted name is empty or whitespace-only
- **THEN** the system SHALL reject the request with `{ messageKey, params }` and the field error SHALL render inline under the field

#### Scenario: Duplicate name rejected
- **WHEN** the submitted name matches an existing non-deleted tracker of the same user
- **THEN** the system SHALL reject the request with `messageKey: 'error.trackerNameDuplicate'` and the error SHALL render inline under the name field

#### Scenario: Archived name reuse
- **WHEN** the submitted name matches only a soft-deleted tracker of the same user
- **THEN** the system SHALL allow creation

#### Scenario: Execution mode defaults to client
- **WHEN** a user submits a tracker without an explicit `executionMode`
- **THEN** the system SHALL persist it with `executionMode` set to `client`

#### Scenario: Invalid base URL rejected
- **WHEN** a user submits a tracker whose `baseUrl` is missing or not a valid URL
- **THEN** the system SHALL reject the request with `{ messageKey, params }` and persist nothing

#### Scenario: Unsupported system type rejected
- **WHEN** a user submits a `systemType` that is not `redmine` or `openproject`
- **THEN** the system SHALL reject the request with `{ messageKey, params }` and persist nothing

#### Scenario: Secret is not accepted as a stored field
- **WHEN** a create or update body includes a credential/secret field intended for storage
- **THEN** the server SHALL ignore or reject that field and SHALL never persist it

#### Scenario: Required-field defaults are not accepted as a stored field
- **WHEN** a create or update body includes `requiredFieldDefaults`
- **THEN** the server SHALL ignore or reject that field and SHALL NOT persist required-field defaults

## REMOVED Requirements

### Requirement: REQ-250 Default values for the tracker's required fields
**Reason**: The Trackers UI never collected `requiredFieldDefaults`, so it was unused product surface. A PATCH that omitted the map already replaced stored values with `{}`, which made the field a footgun for any API-seeded data.
**Migration**: Drop the column and the boundary field. Remote Sync activity pre-fill uses only the task's most recently finalized activity (REQ-114). Callers that still send `requiredFieldDefaults` on create/update MUST have that field ignored or rejected; it is no longer stored.
