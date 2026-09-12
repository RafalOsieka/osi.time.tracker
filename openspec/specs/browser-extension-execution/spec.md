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

The website-extension boundary SHALL expose only the nine neutral tracker operations and a credential-free compatibility/availability handshake. Requests and responses SHALL be schema-validated, correlated to a requesting document and request identifier, and bounded in size and lifetime. The extension SHALL independently verify the actual sending extension context, website origin, and top-level frame; it SHALL NOT trust a page-supplied origin. Unsupported versions, operations, malformed inputs, or unsolicited responses SHALL NOT result in remote execution or a false success.

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

### Requirement: REQ-330 Bridge carries the catalog operation and scoped search inputs
The operation bridge SHALL add the remote project catalog operation and SHALL widen the title-search and exact-lookup inputs to an object carrying the query (or issue id) and an optional scope `{ remoteProjectId }`. The exact-lookup result SHALL be the nullable lookup object `{ result, inScope }`. The handshake SHALL advertise the catalog operation in `supportedOperations` when the installed extension implements it. The website SHALL NOT offer the remote project select for an extension-only tracker unless the handshake advertises the catalog operation, and SHALL treat scoped search on an extension that rejects the widened input as the existing incompatibility state rather than falling back to an unscoped search. The scope SHALL NOT alter which destination the request is approved for: it is a query parameter on the already-approved tracker origin.

#### Scenario: Catalog through the extension
- **WHEN** an approved document requests the catalog operation from an extension that advertises it
- **THEN** the extension SHALL execute the provider's catalog fetch and return only the validated neutral project list

#### Scenario: Scoped search through the extension
- **WHEN** an approved document sends a title search with a scope
- **THEN** the extension SHALL forward the scope to the same provider implementation and return the scoped neutral results

#### Scenario: Older extension lacks the catalog
- **WHEN** the handshake's `supportedOperations` omits the catalog operation
- **THEN** the website SHALL disable the remote project select with the incompatibility hint and SHALL NOT send the operation

#### Scenario: Older extension rejects the widened input
- **WHEN** the installed extension fails validation of a scoped search input
- **THEN** the website SHALL surface the incompatibility/update state and SHALL NOT retry the search without the scope

#### Scenario: Scope does not widen approvals
- **WHEN** a scoped request targets a tracker origin
- **THEN** the extension SHALL enforce the same origin approval as for an unscoped request and SHALL NOT treat the scope as a new destination

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

The web app SHALL derive transport from the tracker's persisted capability: `directBrowserAccess: true` SHALL use direct client execution, and `directBrowserAccess: false` SHALL require extension execution. It SHALL NOT retry through another transport automatically, execute extension-required actions on the OSI server, or rewrite tracker configuration based on device-local extension availability. Missing extension support SHALL leave ordinary local time tracking usable. Contextual operation failures SHALL remain visible at the operation surface even though proactive setup checks are centralized.

#### Scenario: Direct browser access is allowed
- **WHEN** a remote operation uses a tracker with `directBrowserAccess: true`
- **THEN** the web app SHALL use direct browser execution regardless of extension availability

#### Scenario: Unsupported device or absent extension
- **WHEN** a remote operation uses a tracker with `directBrowserAccess: false` and the device cannot establish the extension bridge
- **THEN** the operation SHALL be unavailable with setup feedback while local time entry actions and tracker configuration remain usable

#### Scenario: Attempted server fallback
- **WHEN** the selected transport fails or is unavailable
- **THEN** the system SHALL report the failure without retrying the operation through direct browser, extension, or server execution

#### Scenario: Installation becomes available
- **WHEN** the user installs or enables the extension and refreshes or rechecks the website
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

### Requirement: REQ-315 Sidebar communicates extension readiness

The authenticated sidebar SHALL contain a compact extension-status row immediately below the user menu and outside navigation. Its indicator SHALL aggregate active trackers and device-local extension status using this precedence: neutral when no active tracker requires the extension; red when an extension is required but unavailable, incompatible, or the current OSI website is not approved; orange when the extension and website are valid but at least one extension-required tracker destination is not approved; green when every required part is valid. Direct-capable trackers SHALL NOT downgrade the aggregate state.

#### Scenario: Extension is not required
- **WHEN** no active tracker has `directBrowserAccess: false`
- **THEN** the indicator SHALL show a neutral **Not required** state even if no extension is installed

#### Scenario: Required extension or website approval is invalid
- **WHEN** at least one active tracker requires the extension and the bridge is unavailable or incompatible, or the current OSI website is not approved
- **THEN** the indicator SHALL show the red invalid state

#### Scenario: Required tracker approval is missing
- **WHEN** the extension and website approval are valid but at least one extension-required tracker destination is not approved
- **THEN** the indicator SHALL show the orange partially configured state

#### Scenario: Required setup is complete
- **WHEN** the extension and website are valid and every extension-required tracker destination is approved
- **THEN** the indicator SHALL show the green ready state

### Requirement: REQ-316 Extension status details are accessible and informative

The sidebar status row SHALL open a localized informational popover by hover, keyboard focus, click, or tap. The popover SHALL distinguish extension connection and compatibility, current website approval, and each configured tracker's destination approval. Extension-required trackers SHALL appear first; direct-capable trackers MAY appear as optional destinations but SHALL be identified as not required. Approval SHALL remain owned by contextual extension flows rather than being initiated from this popover. The collapsed sidebar SHALL retain an understandable icon and status indicator.

#### Scenario: Inspect status with keyboard
- **WHEN** a keyboard user focuses or activates the status row
- **THEN** the popover SHALL open, remain keyboard operable, and expose its status meaning without relying on color alone

#### Scenario: Inspect status on touch
- **WHEN** a touch user taps the status row
- **THEN** the same tracker approval details SHALL be available without hover

#### Scenario: Direct-capable tracker lacks optional approval
- **WHEN** a direct-capable tracker destination is not extension-approved
- **THEN** it SHALL NOT change the aggregate indicator from neutral or green to orange or red

### Requirement: REQ-317 Proactive extension checks have one home

The sidebar SHALL be the single proactive extension setup and destination-approval status surface. Tracker create/edit and remote-issue selection surfaces SHALL NOT duplicate persistent extension readiness panels. A remote search, sync, or export that cannot execute SHALL still show localized contextual failure and recovery guidance at the point of action.

#### Scenario: Configure an extension-required tracker
- **WHEN** a user creates or edits a tracker that requires the extension
- **THEN** the form SHALL allow saving without rendering a duplicate extension readiness panel

#### Scenario: Remote operation fails for missing setup
- **WHEN** a user invokes a remote operation whose required extension setup is incomplete
- **THEN** that operation SHALL show its contextual error and recovery action rather than referring only to the sidebar color

### Requirement: REQ-331 Page-side extension operations are queued to the in-flight bound

The web app SHALL bound its own concurrent extension operations per document to the protocol's in-flight limit and SHALL queue further operations until a slot frees, in request order, instead of dispatching them and receiving a limit error. The queue SHALL be shared by every extension call site in the document. A queued operation SHALL be released when the operation ahead of it settles (success, failure, or timeout). Queueing SHALL NOT change the operation's result, error classification, or the unknown-create handling of a creation whose reply is lost. The page SHALL NOT raise the extension's own limit; a limit error returned by the extension SHALL still be surfaced as today when it occurs.

#### Scenario: Burst larger than the limit completes without a limit error
- **WHEN** a page issues more concurrent extension operations than the in-flight limit (for example a Remote Sync day with six linked tasks on one extension tracker)
- **THEN** no operation SHALL fail with the limit error and every operation SHALL eventually execute and return its own result

#### Scenario: Failure ahead in the queue releases the slot
- **WHEN** an in-flight operation fails or times out while others are queued
- **THEN** the next queued operation SHALL be dispatched and the failed operation SHALL report only its own error

#### Scenario: Queued create keeps unknown-create semantics
- **WHEN** a time-entry creation waits in the queue and the document closes before it is dispatched
- **THEN** it SHALL fail as a definite (not unknown) failure, and a creation that was already dispatched SHALL keep the existing unknown-create handling

#### Scenario: Queue is per document
- **WHEN** two OSI documents each issue operations
- **THEN** each SHALL be bounded independently and neither SHALL wait on the other's queue
