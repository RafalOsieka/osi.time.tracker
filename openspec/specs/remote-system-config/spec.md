# remote-system-config Specification

## Purpose

Define how a Client is configured to reach a remote issue tracker: the
`RemoteSystemConfig` shape (system type, base URL, execution mode, rounding rule,
required-field defaults), browser-only credential handling, per-user isolation,
and the server-execution transport that forwards the known adapter operations to
the configured tracker.
## Requirements
### Requirement: REQ-122 Configure a remote system on a Client

A user SHALL be able to create a `RemoteSystemConfig` for one of their own Clients, specifying `systemType` (`redmine` or `openproject`), `baseUrl`, `executionMode`, and `roundingRule`. `executionMode` SHALL accept `client` or `server` and SHALL default to `client` when omitted. `client` executes remote requests directly from the browser to the tracker; `server` routes remote requests through the OSI server, which forwards them to the tracker. The `transportMode` field SHALL no longer exist. Each Client SHALL have at most one `RemoteSystemConfig`. The full configuration except the API secret SHALL be stored in the database.

#### Scenario: Create a configuration for an owned Client
- **WHEN** a user submits a valid remote configuration for a Client they own that has none yet
- **THEN** the system SHALL persist the configuration (systemType, baseUrl, executionMode, roundingRule, requiredFieldDefaults) linked to that Client and return the stored configuration including its id

#### Scenario: Only one configuration per Client
- **WHEN** a user submits a configuration for a Client that already has one
- **THEN** the system SHALL update (upsert) the existing configuration rather than creating a second one

#### Scenario: Execution mode defaults to client
- **WHEN** a user submits a configuration without an explicit `executionMode`
- **THEN** the system SHALL persist it with `executionMode` set to `client`

#### Scenario: Reject an invalid execution mode
- **WHEN** a user submits an `executionMode` that is not `client` or `server`
- **THEN** the system SHALL reject the request with a `{ messageKey, params }` validation error and persist nothing

#### Scenario: Reject an invalid base URL
- **WHEN** a user submits a configuration whose `baseUrl` is missing or not a valid URL
- **THEN** the system SHALL reject the request with a `{ messageKey, params }` validation error and persist nothing

#### Scenario: Reject an unsupported system type
- **WHEN** a user submits a `systemType` that is not `redmine` or `openproject`
- **THEN** the system SHALL reject the request with a `{ messageKey, params }` validation error

### Requirement: REQ-123 Client-side credentials are never persisted server-side

The API secret SHALL be entered and kept only in the user's browser and SHALL never be stored on the server; the persisted configuration and all API responses SHALL never contain the credential. In `client` execution mode the secret SHALL be sent only to the configured tracker origin. In `server` execution mode the secret MAY be transmitted to the OSI server per request solely for immediate upstream forwarding, but SHALL NOT be persisted, logged, or returned by the server.

#### Scenario: Secret is not accepted as a stored field
- **WHEN** a request body includes a credential/secret field intended for storage
- **THEN** the server SHALL ignore or reject that field and SHALL never persist it

#### Scenario: Response never exposes a credential
- **WHEN** a user reads a stored remote configuration
- **THEN** the response DTO SHALL contain the configuration id and all non-secret fields but no credential value

#### Scenario: Browser retains the secret across sessions
- **WHEN** a user enters an API secret for a configuration in the browser
- **THEN** the secret SHALL be stored only in the browser (localStorage keyed by the configuration id) and SHALL remain available after a page reload without being persisted on the server

#### Scenario: Server execution forwarding does not persist the secret
- **WHEN** the browser forwards the secret to the OSI server for a `server` execution-mode request
- **THEN** the server SHALL use it only for the immediate upstream request and SHALL NOT persist, log, or return it

### Requirement: REQ-124 Default values for the remote system's required fields

A user SHALL be able to store default values for the remote system's required fields as an adapter-agnostic key–value map (`requiredFieldDefaults`), so they can later pre-fill the Remote Sync page.

#### Scenario: Store required-field defaults
- **WHEN** a user saves a configuration including one or more required-field defaults (e.g. an activity id)
- **THEN** the system SHALL persist them as a string key–value map on the configuration

#### Scenario: Defaults are optional
- **WHEN** a user saves a configuration with no required-field defaults
- **THEN** the system SHALL persist the configuration with an empty defaults map and SHALL NOT treat the absence as an error

### Requirement: REQ-125 Edit and remove a Client's remote configuration

A user SHALL be able to edit and remove the remote configuration of a Client they own. Editing any configuration field, including `systemType` or normalized `baseUrl`, SHALL retain the configuration identity and existing Task remote issue references without remote validation, cleanup, or metadata migration. Removing a configuration SHALL soft-delete it, preserve existing Task references and their cached issue IDs and titles as historical data, and clear the browser-held secret. A preserved reference whose configuration is deleted SHALL be unavailable for remote queries and URL generation. Creating a later active configuration SHALL NOT automatically reassign preserved references to it.

#### Scenario: Edit an existing configuration
- **WHEN** a user submits changes to fields of an existing configuration on their Client
- **THEN** the system SHALL persist the updated values, return the same configuration identity, and leave its Task references linked without remote validation

#### Scenario: Change tracker identity
- **WHEN** a user changes the existing configuration's system type or normalized base URL
- **THEN** the system SHALL assume its referenced issue IDs remain valid and SHALL retain their cached titles without validation, cleanup, or migration prompts

#### Scenario: Remove a configuration
- **WHEN** a user removes the remote configuration of their Client
- **THEN** the system SHALL soft-delete the stored configuration, preserve its Task references, and the client SHALL clear the browser-held secret associated with that configuration id

#### Scenario: Use a reference after configuration removal
- **WHEN** a Task reference points to a deleted configuration
- **THEN** the system SHALL expose its cached issue ID and title but SHALL NOT query the remote system or generate an issue URL

#### Scenario: Configure the Client again after removal
- **WHEN** the user creates a new active configuration after the prior configuration was removed
- **THEN** the system SHALL NOT automatically rebind old Task references to the new configuration

### Requirement: REQ-126 Remote configuration is isolated per user

All remote-configuration reads and writes SHALL be scoped to the authenticated user; a user SHALL never read, edit, or delete a remote configuration belonging to another user, and mutating requests SHALL be guarded by authentication and CSRF.

#### Scenario: Cannot configure another user's Client
- **WHEN** a user submits a remote configuration referencing a Client they do not own
- **THEN** the system SHALL reject the request and persist nothing

#### Scenario: Cannot read another user's configuration
- **WHEN** a user requests the remote configuration for a Client they do not own
- **THEN** the system SHALL respond as if it does not exist and SHALL NOT disclose the configuration

#### Scenario: Unauthenticated request is rejected
- **WHEN** an unauthenticated request targets a remote-configuration endpoint
- **THEN** the system SHALL reject it via `requireAuth`

### Requirement: REQ-108 Proxy remote issue search through the OSI server

For a remote-system configuration whose `executionMode` is `server`, the system SHALL expose authenticated, user-scoped OSI server endpoints that forward title-phrase search and exact issue-ID lookup to the configured tracker and return the adapter-neutral issue shape. The client SHALL identify only the owned configuration and search input; the server SHALL derive the target tracker base URL from the authenticated user's owned stored configuration and SHALL NOT accept a target URL from the client. The endpoints SHALL forward exactly the known contract operations, SHALL NOT act as a generic HTTP pass-through, and SHALL delegate to the same provider adapter used in `client` execution mode so quirks and error classification stay identical (`remote-adapter-contract` REQ-201). Title search SHALL require at least three trimmed characters and return a fixed bounded result set; issue-ID search SHALL require a non-empty valid remote issue ID and perform an exact lookup; both SHALL include open and closed issues.

#### Scenario: Server execution-mode title search returns matching issues
- **WHEN** an authenticated user submits a title search of at least three trimmed characters for their eligible Task under a `server` configuration
- **THEN** the OSI server SHALL query the configuration's tracker server-side and return a bounded set of adapter-neutral issues regardless of status

#### Scenario: Server execution-mode exact issue-ID lookup returns an issue
- **WHEN** an authenticated user submits a valid remote issue ID under a `server` configuration
- **THEN** the OSI server SHALL request that exact issue server-side and return it as a single adapter-neutral result regardless of status

#### Scenario: Target tracker is derived server-side, not client-supplied
- **WHEN** a server execution-mode search request includes any client-supplied target URL or origin
- **THEN** the server SHALL ignore it and resolve the tracker base URL solely from the authenticated user's owned stored configuration

#### Scenario: Invalid search input does not call the tracker
- **WHEN** a server execution-mode request has a title shorter than three trimmed characters or an empty or invalid issue ID
- **THEN** the server SHALL respond with a translated `{ messageKey, params }` validation error and SHALL NOT contact the tracker

#### Scenario: Only known operations are forwarded
- **WHEN** a request targets any operation other than the defined contract operations
- **THEN** the server SHALL reject it and SHALL NOT forward an arbitrary request to the tracker

### Requirement: REQ-109 Forwarded proxy credential is never persisted

For `server` execution-mode requests the browser SHALL send the tracker API secret per request in a dedicated request header, and the OSI server SHALL use it only to authorize the single upstream call. The server SHALL NOT persist, log, serialize, or return the forwarded secret, and SHALL NOT place it in any error payload. Server-execution endpoints SHALL require a valid session and CSRF protection for mutations and SHALL scope configuration lookup to the authenticated user.

#### Scenario: Secret is used only for the upstream call
- **WHEN** the server forwards a server execution-mode request using the per-request secret header
- **THEN** the secret SHALL be attached only to the upstream tracker request and SHALL NOT be persisted, logged, or returned in any OSI response

#### Scenario: Missing forwarded secret is rejected
- **WHEN** a server execution-mode request omits the credential header
- **THEN** the server SHALL respond with a translated `{ messageKey, params }` error and SHALL NOT contact the tracker

#### Scenario: Unauthenticated or cross-user request is rejected
- **WHEN** a server execution-mode request lacks a valid session, lacks CSRF for a mutation, or references a configuration the user does not own
- **THEN** the server SHALL reject it without contacting the tracker and without disclosing the configuration

### Requirement: REQ-110 Proxy failures map to the translated error contract

The server-execution endpoints SHALL translate upstream outcomes into distinct `{ messageKey, params }` errors mirroring the client execution-mode error states: rejected credential, connection failure or timeout, and not-found. The server SHALL NOT return raw upstream status text or response bodies to the client, so the picker renders equivalent translated states regardless of execution mode.

#### Scenario: Upstream rejects the credential
- **WHEN** the tracker rejects the forwarded credential
- **THEN** the server SHALL respond with a distinct translated authentication `messageKey` and SHALL NOT expose the raw upstream body

#### Scenario: Tracker is unreachable from the server
- **WHEN** the upstream request fails to connect, times out, or its host cannot be resolved
- **THEN** the server SHALL respond with a distinct translated connection `messageKey`

#### Scenario: Requested issue does not exist
- **WHEN** an exact issue-ID lookup finds no matching work package
- **THEN** the server SHALL respond with a translated not-found result state without changing any Task reference

