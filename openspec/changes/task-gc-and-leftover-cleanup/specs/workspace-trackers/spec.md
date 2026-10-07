## REMOVED Requirements

### Requirement: REQ-245 Create a tracker
**Reason**: Its scenario rejecting an `executionMode` field only guarded against clients from before execution modes were removed.
**Migration**: Replaced by REQ-492 with the same create behavior. A request carrying `executionMode` is treated like any other unknown field.

### Requirement: REQ-314 Existing tracker execution modes migrate without relationship changes
**Reason**: Describes a one-time database migration, not behavior of the running application.
**Migration**: The migration and its historical test stay; the code is listed in the retired requirements.

### Requirement: REQ-364 Persisted server execution modes migrate to client
**Reason**: Describes a one-time database migration, not behavior of the running application.
**Migration**: The migration and its historical test stay; the code is listed in the retired requirements.

## ADDED Requirements

### Requirement: REQ-492 Create a tracker
`POST /api/trackers` SHALL create a tracker from a `name`, `systemType` (`redmine` or `openproject`), `baseUrl`, `roundingRule` and a boolean `directBrowserAccess` defaulting to `true`. The form SHALL show it as a **Direct browser connection allowed** checkbox with accessible help (some installations block other websites; unchecking needs the OSI extension; the technical term is CORS). Saving `false` SHALL NOT require an installed extension. No secret SHALL ever be stored.

#### Scenario: Direct browser access defaults to true
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

#### Scenario: Non-boolean direct browser access rejected
- **WHEN** a request submits a non-boolean `directBrowserAccess` value
- **THEN** validation SHALL reject it and persist nothing

#### Scenario: Mobile user can allow direct browser access
- **WHEN** a mobile or PWA user configures a tracker reachable by the device and allowed by the tracker's CORS policy
- **THEN** the user SHALL be able to save and use `directBrowserAccess: true`

#### Scenario: Help is available without a pointer
- **WHEN** a keyboard user focuses the help control beside the checkbox
- **THEN** the localized explanation SHALL become available without changing the field value

