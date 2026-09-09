# browser-extension-execution Specification

## Purpose

Allow approved OSI websites to execute bounded tracker operations through the user's desktop browser network while preserving destination control, credentials, and safe export outcomes.

## Requirements

### Requirement: REQ-307 Desktop extension works without publication

The extension SHALL support unpacked installation in desktop Chrome and Edge and use with an explicitly approved local OSI origin without a public domain or store listing. It SHALL execute on-demand tracker requests from its privileged background context, including against trackers that supply no website CORS permission. It SHALL NOT require a native companion or OSI server relay.

#### Scenario: Local installation and tracker access
- **WHEN** a user loads the built extension unpacked, approves their local OSI website and tracker, and invokes a supported operation
- **THEN** the operation SHALL execute using the desktop's network and return its neutral result without requiring tracker CORS headers

#### Scenario: Network access remains required
- **WHEN** the tracker is unreachable through the user's current network
- **THEN** the operation SHALL report a translated connection failure rather than claiming to bypass network or certificate restrictions

### Requirement: REQ-308 Explicit website and destination approvals

The extension SHALL require user approval in extension-owned UI for an exact OSI website origin and each tracker destination assigned to that origin. Destinations SHALL include provider, origin, and normalized base path. Browser host permission alone SHALL NOT authorize an operation. Approvals SHALL be reviewable and revocable, and missing or denied permission SHALL prevent network execution. Non-loopback OSI websites SHALL require HTTPS; local development SHALL allow explicitly approved HTTP loopback origins.

#### Scenario: Approval is scoped to the requesting website
- **WHEN** a destination is approved for one OSI origin and a different website requests access
- **THEN** the extension SHALL reject the request without contacting the tracker

#### Scenario: Ports and paths do not inherit authorization
- **WHEN** a request uses a different website port or an unapproved tracker provider, origin, or base path
- **THEN** the extension SHALL require a matching approval and SHALL NOT infer authorization from broader browser permissions

#### Scenario: Permission denied or revoked
- **WHEN** the user denies a permission request or revokes an existing grant
- **THEN** subsequent operations and subsequent network steps of in-flight operations SHALL be blocked, and the UI SHALL explain how to restore access without changing saved tracker mode

### Requirement: REQ-309 Validated versioned operation bridge

The website-extension boundary SHALL expose only the seven neutral tracker operations and a credential-free compatibility/availability handshake. Requests and responses SHALL be schema-validated, correlated to a requesting document and request identifier, and bounded in size and lifetime. The extension SHALL independently verify the actual sending extension context, website origin, and top-level frame; it SHALL NOT trust a page-supplied origin. Unsupported versions, operations, malformed inputs, or unsolicited responses SHALL NOT result in remote execution or a false success.

#### Scenario: Compatible operation
- **WHEN** an approved document and extension agree on the protocol version and required capability
- **THEN** a validated operation SHALL return only the corresponding validated neutral result or safe error to that document

#### Scenario: Incompatible versions
- **WHEN** the installed extension cannot support the website's protocol version or requested operation
- **THEN** the website SHALL display an incompatibility/update state without transmitting the tracker secret or invoking the operation

#### Scenario: Forged or malformed request
- **WHEN** a request originates from an unapproved document/frame, supplies an unsupported operation, or fails input validation
- **THEN** the extension SHALL reject it before any tracker request

#### Scenario: Late or unrelated reply
- **WHEN** a reply belongs to another document, an expired request, or a different operation
- **THEN** the website SHALL discard it rather than settling an unrelated request

### Requirement: REQ-310 Tracker network confinement

Every outbound extension tracker request SHALL be derived by the bundled provider implementation and confined to the approved destination, including paths obtained from tracker responses. The extension SHALL reject arbitrary URL/method/header instructions, URL credentials, unsupported schemes, and traversal outside the approved base path. Redirects SHALL NOT be followed. It SHALL send only provider-supplied authentication, omit ambient cookies, and never attach OSI session credentials. Network duration, response size, and operation concurrency SHALL be bounded.

#### Scenario: Response-derived URL escapes the destination
- **WHEN** a tracker response supplies a pagination or metadata URL outside the approved origin or base path
- **THEN** the extension SHALL stop before contacting that URL or forwarding credentials

#### Scenario: Redirect response
- **WHEN** an approved tracker URL responds with a redirect, including a same-origin redirect
- **THEN** the extension SHALL fail the request without following the redirect or sending credentials to its target

#### Scenario: Resource limits exceeded
- **WHEN** an operation exceeds its declared resource limits
- **THEN** it SHALL terminate with a safe error without returning a partial response as a complete success

### Requirement: REQ-311 Availability is device-local and never a fallback

The web app SHALL distinguish extension unavailable, incompatible, permission required, and upstream failure states using localized actionable feedback. It SHALL NOT execute extension-selected tracker actions on the OSI server or through direct browser fetch as a fallback, including during SSR. Missing extension support SHALL NOT rewrite persisted tracker configuration or disable ordinary local time tracking. OSI server-execution endpoints SHALL reject trackers configured for extension execution without contacting their remotes.

#### Scenario: Unsupported device or absent extension
- **WHEN** a device cannot establish the extension bridge
- **THEN** extension-dependent actions SHALL be unavailable with setup feedback, while local time entry actions remain usable and tracker configuration remains unchanged

#### Scenario: Attempted server fallback
- **WHEN** a server-execution endpoint receives a request for an extension-mode tracker
- **THEN** it SHALL reject the request without contacting the tracker

#### Scenario: Installation becomes available
- **WHEN** the user installs or enables the extension and refreshes/rechecks the website
- **THEN** availability SHALL be reevaluated without requiring the saved tracker to be recreated

### Requirement: REQ-312 Ambiguous creates are never automatically replayed

If delivery of a time-entry creation result is lost after dispatch, the system SHALL treat the remote outcome as unknown, not as proof that nothing was created. It SHALL NOT automatically resend a creation because of timeout, disconnection, document closure, or worker restart. The user SHALL receive an uncertainty warning before an explicit retry that could duplicate a remote log. A known successful remote log ID SHALL continue through existing local finalization/replay behavior without recreating the remote log.

#### Scenario: Tracker creates but response is lost
- **WHEN** a tracker accepts a time entry but the extension connection closes before delivering the result
- **THEN** no automatic second create SHALL occur and the web app SHALL warn that the remote entry may exist

#### Scenario: Failure before dispatch
- **WHEN** validation or approval fails before any remote create is dispatched and the website receives that definitive failure
- **THEN** the system SHALL report a definite failure rather than a successful or uncertain export

#### Scenario: Known remote success and local finalization failure
- **WHEN** the web app receives a remote log ID but local finalization fails
- **THEN** the existing uncertain-finalization handling SHALL retain the known ID and SHALL NOT recreate the remote entry to retry local finalization

### Requirement: REQ-313 Extension setup is localized and accessible

Extension-owned setup/approval/revocation UI and web integration feedback SHALL support English and Polish with matching catalog keys, labeled controls, keyboard operation, and accessible error/status announcements. The extension SHALL persist only non-secret approvals/preferences and SHALL NOT persist operation credentials or tracker response bodies.

#### Scenario: Manage approvals using a keyboard
- **WHEN** a user configures or revokes a destination without a pointer
- **THEN** every action SHALL be keyboard reachable and its result SHALL be accessibly announced in the selected language

#### Scenario: Reload extension settings
- **WHEN** extension settings are reopened after an operation
- **THEN** approvals/preferences SHALL remain available and no operation secret or tracker response body SHALL be present in extension storage