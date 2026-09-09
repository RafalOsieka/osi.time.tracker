## MODIFIED Requirements

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

## ADDED Requirements

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
