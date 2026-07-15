## MODIFIED Requirements

### Requirement: REQ-TTR-101 Configure a remote system on a Client

A user SHALL be able to create a `RemoteSystemConfig` for one of their own Clients, specifying `systemType` (`redmine` or `openproject`), `baseUrl`, `executionMode`, `transportMode`, and `roundingRule`. `transportMode` SHALL accept `direct` or `proxied` and SHALL default to `direct` when omitted. `direct` retains the existing browser-to-tracker request behavior; `proxied` routes remote issue search through the OSI server. Each Client SHALL have at most one `RemoteSystemConfig`. The full configuration except the API secret SHALL be stored in the database.

#### Scenario: Create a configuration for an owned Client
- **WHEN** a user submits a valid remote configuration for a Client they own that has none yet
- **THEN** the system SHALL persist the configuration (systemType, baseUrl, executionMode, transportMode, roundingRule, requiredFieldDefaults) linked to that Client and return the stored configuration including its id

#### Scenario: Only one configuration per Client
- **WHEN** a user submits a configuration for a Client that already has one
- **THEN** the system SHALL update (upsert) the existing configuration rather than creating a second one

#### Scenario: Transport mode defaults to direct
- **WHEN** a user submits a configuration without an explicit `transportMode`
- **THEN** the system SHALL persist it with `transportMode` set to `direct`

#### Scenario: Reject an invalid transport mode
- **WHEN** a user submits a `transportMode` that is not `direct` or `proxied`
- **THEN** the system SHALL reject the request with a `{ messageKey, params }` validation error and persist nothing

#### Scenario: Reject an invalid base URL
- **WHEN** a user submits a configuration whose `baseUrl` is missing or not a valid URL
- **THEN** the system SHALL reject the request with a `{ messageKey, params }` validation error and persist nothing

#### Scenario: Reject an unsupported system type
- **WHEN** a user submits a `systemType` that is not `redmine` or `openproject`
- **THEN** the system SHALL reject the request with a `{ messageKey, params }` validation error

### Requirement: REQ-TTR-102 Client-side credentials are never persisted server-side

For the MVP **client-side** execution mode, the API secret SHALL be entered and kept only in the user's browser and SHALL never be stored on the server. `executionMode` SHALL accept only `client` in this MVP; the persisted configuration and all API responses SHALL never contain the credential. In `direct` transport the secret SHALL be sent only to the configured tracker origin. In `proxied` transport the secret MAY be transmitted to the OSI server per request solely for immediate upstream forwarding, but SHALL NOT be persisted, logged, or returned by the server.

#### Scenario: Secret is not accepted as a stored field
- **WHEN** a request body includes a credential/secret field intended for storage
- **THEN** the server SHALL ignore or reject that field and SHALL never persist it

#### Scenario: Response never exposes a credential
- **WHEN** a user reads a stored remote configuration
- **THEN** the response DTO SHALL contain the configuration id and all non-secret fields but no credential value

#### Scenario: Browser retains the secret across sessions
- **WHEN** a user enters an API secret for a configuration in the browser
- **THEN** the secret SHALL be stored only in the browser (localStorage keyed by the configuration id) and SHALL remain available after a page reload without being persisted on the server

#### Scenario: Proxied forwarding does not persist the secret
- **WHEN** the browser forwards the secret to the OSI server for a `proxied` search
- **THEN** the server SHALL use it only for the immediate upstream request and SHALL NOT persist, log, or return it
