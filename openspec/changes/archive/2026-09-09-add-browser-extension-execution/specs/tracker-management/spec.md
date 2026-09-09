## MODIFIED Requirements

### Requirement: REQ-245 Create a tracker

The system SHALL allow an authenticated user to create a tracker via `POST /api/trackers` with a required `name`, `systemType` (`redmine` or `openproject`), `baseUrl`, `executionMode`, and `roundingRule`. `executionMode` SHALL accept `client`, `server`, or `extension` and SHALL default to `client` when omitted. The `name` SHALL be trimmed, non-empty, length-bounded, and unique per user among non-deleted trackers. `baseUrl` SHALL be a valid URL. On success the created tracker SHALL be returned and a success Toast SHALL be shown. The API secret SHALL NOT be accepted as a stored field. Create and update bodies SHALL NOT accept `requiredFieldDefaults` as a stored field. The tracker form SHALL offer all three modes with localized labels; saving `extension` SHALL NOT require that the current device has an installed or approved extension.

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

#### Scenario: Extension selection round-trips without installation
- **WHEN** a user creates or edits a tracker with `executionMode: extension` on a device without the extension
- **THEN** the selected mode SHALL persist and appear on subsequent reads, while remote operations require extension setup

#### Scenario: Unknown execution mode rejected
- **WHEN** a user submits an execution mode outside the accepted set
- **THEN** the server SHALL reject it with a translated validation error and persist nothing

### Requirement: REQ-249 Client-side credentials are never persisted server-side

The API secret SHALL be entered and kept only in the user's browser and SHALL never be stored on the server. In `client` execution mode the secret SHALL be sent only to the configured tracker origin. In `server` execution mode the secret MAY be transmitted to the OSI server per request solely for immediate upstream forwarding, but SHALL NOT be persisted, logged, or returned by the server. In `extension` execution mode the secret SHALL be forwarded transiently through the approved extension to the approved tracker destination and SHALL NOT be persisted by the extension or transmitted to OSI APIs. The secret SHALL be stored in the browser keyed by the tracker id and SHALL remain available after a page reload without being persisted on the server.

#### Scenario: Browser retains the secret across sessions
- **WHEN** a user enters an API secret for a tracker in the browser
- **THEN** the secret SHALL be stored only in the browser (localStorage keyed by the tracker id) and SHALL remain available after a page reload without being persisted on the server

#### Scenario: Server execution forwarding does not persist the secret
- **WHEN** the browser forwards the secret to the OSI server for a `server` execution-mode request
- **THEN** the server SHALL use it only for the immediate upstream request and SHALL NOT persist, log, or return it

#### Scenario: Switching execution mode retains browser ownership
- **WHEN** a user selects extension execution for an existing tracker
- **THEN** its existing browser-held secret SHALL remain the credential source and SHALL NOT be migrated to extension or server storage