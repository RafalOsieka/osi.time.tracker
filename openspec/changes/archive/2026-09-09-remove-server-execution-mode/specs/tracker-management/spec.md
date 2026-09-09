## ADDED Requirements

### Requirement: REQ-305 Persisted server execution modes migrate to client

The system SHALL migrate every persisted tracker whose execution mode is `server` to `client` before application code that accepts only the two-mode contract reads it. Tracker identity, ownership, system type, base URL, rounding rule, timestamps, project associations, and remote issue references SHALL remain unchanged.

#### Scenario: Existing server tracker is upgraded
- **WHEN** the migration encounters a tracker with `executionMode: server`
- **THEN** it SHALL change only the execution mode to `client`

#### Scenario: Existing supported modes are unchanged
- **WHEN** the migration encounters a tracker with `executionMode: client` or `executionMode: extension`
- **THEN** it SHALL leave that tracker unchanged

## MODIFIED Requirements

### Requirement: REQ-245 Create a tracker
The system SHALL allow an authenticated user to create a tracker via `POST /api/trackers` with a required `name`, `systemType` (`redmine` or `openproject`), `baseUrl`, `executionMode`, and `roundingRule`. `executionMode` SHALL accept `client` or `extension` and SHALL default to `client` when omitted. The tracker form SHALL offer both modes with localized labels and SHALL explain that `client` requires tracker-approved cross-origin browser requests while `extension` is desktop-browser only. Saving `extension` SHALL NOT require an installed or approved extension. All existing name, URL, ownership, and non-persistence validation rules remain unchanged.

#### Scenario: Execution mode defaults to client
- **WHEN** a user submits a tracker without an explicit `executionMode`
- **THEN** the system SHALL persist it with `executionMode` set to `client`

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
- **WHEN** a user creates or edits a tracker with `executionMode: extension` on a device without the extension
- **THEN** the selected mode SHALL persist while remote operations require extension setup

#### Scenario: Removed server mode is rejected
- **WHEN** a create or update request submits `executionMode: server`
- **THEN** the server SHALL reject it with a translated validation error and persist nothing

#### Scenario: Unknown execution mode rejected
- **WHEN** a request submits any value outside `client` and `extension`
- **THEN** validation SHALL reject it and persist nothing

#### Scenario: Mobile user can select client mode
- **WHEN** a mobile or PWA user configures a tracker reachable by the device and allowed by the tracker's CORS policy
- **THEN** the user SHALL be able to save and use `client` mode

### Requirement: REQ-249 Client-side credentials are never persisted server-side
The API secret SHALL be entered and kept only in the user's browser and SHALL never be stored on the OSI server. In `client` execution mode the secret SHALL be sent only to the configured tracker origin. In `extension` execution mode the secret SHALL pass transiently through the approved extension to the approved tracker destination and SHALL NOT be persisted by the extension or transmitted to OSI APIs. The secret SHALL be stored in the browser keyed by tracker id and SHALL remain available after reload.

#### Scenario: Browser retains the secret across sessions
- **WHEN** a user enters an API secret for a tracker
- **THEN** it SHALL remain browser-held and SHALL NOT be persisted on the OSI server

#### Scenario: Switching execution mode retains browser ownership
- **WHEN** a user switches between `client` and `extension`
- **THEN** the existing browser-held secret SHALL remain the credential source and SHALL NOT migrate to extension or server storage

#### Scenario: Server execution forwarding does not persist the secret
- **WHEN** a stale caller attempts server execution with a secret
- **THEN** validation SHALL reject the unsupported mode and no OSI remote-operation endpoint SHALL receive the secret

## REMOVED Requirements

### Requirement: REQ-253 Proxy remote issue search through the OSI server
**Reason**: The `server` execution mode and its generic operation proxy are removed.
**Migration**: Use `client` where the tracker permits cross-origin requests, or `extension` on desktop where CORS prevents direct access.

### Requirement: REQ-254 Forwarded proxy credential is never persisted
**Reason**: Credentials are no longer forwarded through OSI remote-operation endpoints.
**Migration**: Keep credentials browser-held for direct or extension-mediated execution.

### Requirement: REQ-255 Proxy failures map to the translated error contract
**Reason**: The proxy endpoints no longer exist; provider errors remain normalized by direct and extension transports.
**Migration**: Callers continue using the shared translated error contract through a supported execution mode.