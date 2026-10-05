# Spec Delta

## ADDED Requirements

### Requirement: REQ-421 Approved websites can suggest a tracker destination

The bridge SHALL accept a credential-free suggestion message from an approved website. The message carries a provider and a tracker base URL. The extension SHALL take the website from the verified sender (REQ-309), never from the message, and SHALL canonicalize the destination like a manually entered one. A suggestion SHALL NOT approve anything or contact the tracker. Its result SHALL tell the website whether the destination was queued, was already approved, or was rejected.

#### Scenario: Suggestion queued
- **WHEN** an approved website suggests an unapproved Redmine base URL
- **THEN** the extension SHALL queue it for review (remote-extension-setup REQ-416) and answer that it was queued, without any tracker request

#### Scenario: Already approved
- **WHEN** the suggested destination is already approved for the sending website
- **THEN** the extension SHALL answer that it is already approved and SHALL NOT queue it

#### Scenario: Website not approved
- **WHEN** a document whose origin is not approved sends a suggestion
- **THEN** the extension SHALL reject it with the permission error and SHALL NOT queue it

#### Scenario: Invalid destination
- **WHEN** the suggested base URL carries credentials, a query, a fragment, a traversal path or an unsupported scheme
- **THEN** the extension SHALL reject it as malformed and SHALL NOT queue it

#### Scenario: Forged website field
- **WHEN** the message includes a website origin different from the sender's
- **THEN** the extension SHALL reject the message as malformed

### Requirement: REQ-422 Bridge protocol version for destination suggestions

The suggestion message SHALL ship under protocol version 3. The website and the extension SHALL both require that version. Pairing a website with an extension built for version 2, or the reverse, SHALL fail the handshake and SHALL show the existing incompatibility/update state (REQ-309), instead of failing on the first suggestion.

#### Scenario: Matching versions
- **WHEN** the website and the extension both implement version 3
- **THEN** the handshake SHALL succeed and both operations and suggestions SHALL be available

#### Scenario: Outdated extension
- **WHEN** the installed extension implements version 2
- **THEN** the website SHALL show the incompatibility/update state and SHALL NOT send operations, suggestions or the tracker secret

## MODIFIED Requirements

### Requirement: REQ-309 Validated versioned operation bridge

The website-extension boundary SHALL expose only the nine neutral tracker operations, a credential-free compatibility/availability handshake, and the credential-free destination suggestion (REQ-421). Requests and responses SHALL be schema-validated, correlated to a requesting document and request identifier, and bounded in size and lifetime. The extension SHALL independently verify the actual sending extension context, website origin, and top-level frame; it SHALL NOT trust a page-supplied origin. Unsupported versions, operations, malformed inputs, or unsolicited responses SHALL NOT result in remote execution or a false success.

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

#### Scenario: Suggestion never carries a secret
- **WHEN** the website sends a destination suggestion
- **THEN** the message SHALL contain no tracker secret, and the extension SHALL reject a message that carries any field beyond its schema

### Requirement: REQ-313 Extension setup is localized and accessible

Extension-owned setup/approval/revocation UI and web integration feedback SHALL support English and Polish with matching catalog keys, labeled controls, keyboard operation, and accessible error/status announcements. The extension SHALL persist only non-secret approvals, pending destination suggestions and preferences. It SHALL keep per-destination activity records only for the browser session, and SHALL NOT persist operation credentials or tracker response bodies.

#### Scenario: Manage approvals using a keyboard
- **WHEN** a user configures or revokes a destination without a pointer
- **THEN** every action SHALL be keyboard reachable and its result SHALL be accessibly announced in the selected language

#### Scenario: Reload extension settings
- **WHEN** extension settings are reopened after an operation
- **THEN** approvals/preferences SHALL remain available and no operation secret or tracker response body SHALL be present in extension storage

#### Scenario: Activity does not outlive the session
- **WHEN** the browser restarts after tracker operations ran through the extension
- **THEN** persistent extension storage SHALL contain no activity record, and pending suggestions SHALL remain

### Requirement: REQ-316 Extension status details are accessible and informative

The sidebar status row SHALL open a localized informational popover by hover, keyboard focus, click, or tap. The popover SHALL distinguish extension connection and compatibility, current website approval, and each configured tracker's destination approval. Extension-required trackers SHALL appear first; direct-capable trackers MAY appear as optional destinations but SHALL be identified as not required. Approval SHALL remain owned by extension UI. When the connection is ready, an extension-required tracker that is not approved SHALL offer an action that sends a destination suggestion (REQ-421), and the popover SHALL report its result. The collapsed sidebar SHALL retain an understandable icon and status indicator.

#### Scenario: Inspect status with keyboard
- **WHEN** a keyboard user focuses or activates the status row
- **THEN** the popover SHALL open, remain keyboard operable, and expose its status meaning without relying on color alone

#### Scenario: Inspect status on touch
- **WHEN** a touch user taps the status row
- **THEN** the same tracker approval details SHALL be available without hover

#### Scenario: Direct-capable tracker lacks optional approval
- **WHEN** a direct-capable tracker destination is not extension-approved
- **THEN** it SHALL NOT change the aggregate indicator from neutral or green to orange or red

#### Scenario: Request approval from the popover
- **WHEN** the user activates the request action on an unapproved, extension-required tracker
- **THEN** the website SHALL send a suggestion for that tracker's provider and base URL, and SHALL tell the user to finish the approval in the extension

#### Scenario: Suggestion finds it already approved
- **WHEN** the extension answers that the destination is already approved
- **THEN** the website SHALL recheck readiness instead of telling the user to open the extension

#### Scenario: Suggestion rejected
- **WHEN** the extension rejects the suggestion
- **THEN** the popover SHALL show the translated error and SHALL NOT change the tracker's approval status

#### Scenario: No request without a ready connection
- **WHEN** the extension is unavailable, incompatible, or the current website is not approved
- **THEN** the popover SHALL NOT offer the request action

### Requirement: REQ-317 Proactive extension checks have one home

The sidebar SHALL be the single proactive extension setup and destination-approval status surface. Tracker create/edit and remote-issue selection surfaces SHALL NOT duplicate persistent extension readiness panels. A remote search, sync, or export that cannot execute SHALL still show localized contextual failure and recovery guidance at the point of action. When it fails because the destination is not approved, the recovery SHALL include the request-approval action (REQ-316).

#### Scenario: Configure an extension-required tracker
- **WHEN** a user creates or edits a tracker that requires the extension
- **THEN** the form SHALL allow saving without rendering a duplicate extension readiness panel

#### Scenario: Remote operation fails for missing setup
- **WHEN** a user invokes a remote operation whose required extension setup is incomplete
- **THEN** that operation SHALL show its contextual error and recovery action rather than referring only to the sidebar color

#### Scenario: Remote operation fails for an unapproved destination
- **WHEN** a remote sync operation fails because the tracker destination is not approved in the extension
- **THEN** the contextual error SHALL offer the request-approval action next to the recheck action
