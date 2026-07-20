## MODIFIED Requirements

### Requirement: REQ-TTR-111 Proxy remote issue search through the OSI server

For a remote-system configuration whose `executionMode` is `server`, the system SHALL expose authenticated, user-scoped OSI server endpoints that forward title-phrase search and exact issue-ID lookup to the configured tracker and return the adapter-neutral issue shape. The client SHALL identify only the owned configuration and search input; the server SHALL derive the target tracker base URL from the authenticated user's owned stored configuration and SHALL NOT accept a target URL from the client. The endpoints SHALL forward exactly the known adapter operations, SHALL NOT act as a generic HTTP pass-through, and SHALL delegate to the same provider adapter used in `client` execution mode so quirks and error classification stay identical. Title search SHALL require at least three trimmed characters and return a fixed bounded result set; issue-ID search SHALL require a non-empty valid work-package ID and perform an exact lookup; both SHALL include open and closed issues.

#### Scenario: Server execution-mode title search returns matching issues
- **WHEN** an authenticated user submits a title search of at least three trimmed characters for their eligible Task under a `server` configuration
- **THEN** the OSI server SHALL query the configuration's tracker server-side and return a bounded set of adapter-neutral issues regardless of status

#### Scenario: Server execution-mode exact issue-ID lookup returns an issue
- **WHEN** an authenticated user submits a valid work-package ID under a `server` configuration
- **THEN** the OSI server SHALL request that exact work package server-side and return it as a single adapter-neutral result regardless of status

#### Scenario: Target tracker is derived server-side, not client-supplied
- **WHEN** a server execution-mode search request includes any client-supplied target URL or origin
- **THEN** the server SHALL ignore it and resolve the tracker base URL solely from the authenticated user's owned stored configuration

#### Scenario: Invalid search input does not call the tracker
- **WHEN** a server execution-mode request has a title shorter than three trimmed characters or an empty or invalid issue ID
- **THEN** the server SHALL respond with a translated `{ messageKey, params }` validation error and SHALL NOT contact the tracker

#### Scenario: Only known operations are forwarded
- **WHEN** a request targets any operation other than the defined adapter operations
- **THEN** the server SHALL reject it and SHALL NOT forward an arbitrary request to the tracker

### Requirement: REQ-TTR-112 Forwarded proxy credential is never persisted

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

### Requirement: REQ-TTR-113 Proxy failures map to the translated error contract

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
