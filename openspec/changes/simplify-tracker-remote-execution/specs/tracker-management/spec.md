## MODIFIED Requirements

### Requirement: REQ-244 List own trackers
The system SHALL show the authenticated user only their own non-deleted trackers, ordered by name, via `GET /api/trackers`. The list SHALL exclude any tracker whose `deletedAt` is set and any tracker belonging to another user. Each tracker DTO SHALL include non-secret connection fields (`id`, `name`, `systemType`, `baseUrl`, `directBrowserAccess`, `roundingRule`, timestamps) and SHALL never include an API secret or required-field defaults.

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
The system SHALL allow an authenticated user to create a tracker via `POST /api/trackers` with a required `name`, `systemType` (`redmine` or `openproject`), `baseUrl`, `directBrowserAccess`, and `roundingRule`. `directBrowserAccess` SHALL be boolean and SHALL default to `true` when omitted. The tracker form SHALL expose it as a localized **Direct browser connection allowed** checkbox with accessible help explaining that some tracker installations block connections from other websites, that disabling it requires the OSI browser extension, and that the technical setting is CORS. Saving `false` SHALL NOT require an installed or approved extension. All existing name, URL, ownership, and non-persistence validation rules remain unchanged.

#### Scenario: Execution mode defaults to client
- **WHEN** a user submits a tracker without `directBrowserAccess`
- **THEN** the system SHALL persist `directBrowserAccess` as `true`

#### Scenario: Successful creation
- **WHEN** an authenticated user submits valid unique connection fields
- **THEN** the tracker SHALL be created for that user and returned without a secret

#### Scenario: Empty name rejected
- **WHEN** the name is empty or whitespace-only
- **THEN** validation SHALL reject it and show an inline field error

#### Scenario: Duplicate name rejected
- **WHEN** the name duplicates another active tracker owned by the user
- **THEN** creation SHALL fail with `error.trackerNameDuplicate`

#### Scenario: Archived name reuse
- **WHEN** the name matches only a soft-deleted tracker
- **THEN** creation SHALL be allowed

#### Scenario: Invalid base URL rejected
- **WHEN** the base URL is invalid
- **THEN** validation SHALL reject it and persist nothing

#### Scenario: Unsupported system type rejected
- **WHEN** the system type is unsupported
- **THEN** validation SHALL reject it and persist nothing

#### Scenario: Secret is not accepted as a stored field
- **WHEN** a request includes a credential field for persistence
- **THEN** the server SHALL reject or ignore it and never persist it

#### Scenario: Required-field defaults are not accepted as a stored field
- **WHEN** a request includes `requiredFieldDefaults`
- **THEN** the server SHALL reject or ignore it and never persist it

#### Scenario: Extension selection round-trips without installation
- **WHEN** a user creates or edits a tracker with `directBrowserAccess: false` on a device without the extension
- **THEN** the setting SHALL persist while future remote operations require extension setup

#### Scenario: Removed server mode is rejected
- **WHEN** a stale create or update request submits an `executionMode` field with value `server`
- **THEN** the server SHALL reject the obsolete field with a translated validation error and persist nothing

#### Scenario: Unknown execution mode rejected
- **WHEN** a request submits a non-boolean `directBrowserAccess` value
- **THEN** validation SHALL reject it and persist nothing

#### Scenario: Mobile user can select client mode
- **WHEN** a mobile or PWA user configures a tracker reachable by the device and allowed by the tracker's CORS policy
- **THEN** the user SHALL be able to save and use `directBrowserAccess: true`

#### Scenario: Help is available without a pointer
- **WHEN** a keyboard user focuses the help control beside the checkbox
- **THEN** the localized explanation SHALL become available without changing the field value

### Requirement: REQ-246 Edit a tracker
The system SHALL allow an authenticated user to update their own tracker via `PATCH /api/trackers/[id]`, applying the same validation as creation for provided fields. Editing SHALL be scoped by `userId`. Editing any configuration field, including `systemType`, normalized `baseUrl`, or `directBrowserAccess`, SHALL retain the tracker identity and existing Task remote issue references without remote validation, cleanup, or metadata migration. A capability change SHALL affect only future remote requests. On success the updated tracker SHALL be returned and the row SHALL reflect the change.

#### Scenario: Successful edit
- **WHEN** an authenticated user submits valid changes for their own tracker
- **THEN** the system SHALL persist the updated values, return the same tracker id, and leave Task references linked without remote validation

#### Scenario: Rename to a duplicate rejected
- **WHEN** the new name matches another non-deleted tracker of the same user
- **THEN** the system SHALL reject the request with `messageKey: 'error.trackerNameDuplicate'` rendered inline

#### Scenario: Change tracker identity fields
- **WHEN** a user changes the existing tracker's system type or normalized base URL
- **THEN** the system SHALL assume referenced issue IDs remain valid and SHALL retain their cached titles without validation, cleanup, or migration prompts

#### Scenario: Change direct connection capability
- **WHEN** a user changes `directBrowserAccess`
- **THEN** projects, tasks, remote issue references, time entries, completed export records, and archived or deprecated records SHALL remain unchanged

### Requirement: REQ-249 Client-side credentials are never persisted server-side
The API secret SHALL be entered and kept only in the user's browser and SHALL never be stored on the OSI server. When direct browser access is allowed the secret SHALL be sent only to the configured tracker origin. When the extension is required the secret SHALL pass transiently through the approved extension to the approved tracker destination and SHALL NOT be persisted by the extension or transmitted to OSI APIs. The secret SHALL be stored in the browser keyed by tracker id and SHALL remain available after reload.

#### Scenario: Browser retains the secret across sessions
- **WHEN** a user enters an API secret for a tracker
- **THEN** it SHALL remain browser-held and SHALL NOT be persisted on the OSI server

#### Scenario: Switching execution mode retains browser ownership
- **WHEN** a user changes `directBrowserAccess`
- **THEN** the existing browser-held secret SHALL remain the credential source and SHALL NOT migrate to extension or server storage

#### Scenario: Server execution forwarding does not persist the secret
- **WHEN** a stale caller attempts server execution with a secret
- **THEN** validation SHALL reject the unsupported request and no OSI remote-operation endpoint SHALL receive the secret

## ADDED Requirements

### Requirement: REQ-314 Existing tracker execution modes migrate without relationship changes
The system SHALL replace persisted execution mode with direct-browser capability before application code reads the new contract. A `client` value SHALL become `directBrowserAccess: true`, and an `extension` value SHALL become `directBrowserAccess: false`. The obsolete execution-mode field SHALL be removed. Tracker identity, ownership, connection settings, timestamps, and all related domain records SHALL remain unchanged.

#### Scenario: Existing client tracker is upgraded
- **WHEN** the migration encounters a tracker with `executionMode: client`
- **THEN** it SHALL set `directBrowserAccess` to `true` and preserve all other data

#### Scenario: Existing extension tracker is upgraded
- **WHEN** the migration encounters a tracker with `executionMode: extension`
- **THEN** it SHALL set `directBrowserAccess` to `false` and preserve all other data
