## ADDED Requirements

### Requirement: REQ-522 Popup content scrolls within the browser's popup
The extension popup SHALL fit the height a browser allows for a popup (600 pixels). When its content is taller, the popup SHALL keep its header and footer in place and scroll only the content between them, so the status badge and the footer actions stay reachable.

#### Scenario: Tall popup content
- **WHEN** the popup's content is taller than the browser allows for a popup
- **THEN** the header and footer SHALL stay visible and the content between them SHALL scroll

#### Scenario: Short popup content
- **WHEN** the popup's content fits
- **THEN** the popup SHALL be only as tall as its content and SHALL NOT show a scroll bar

## MODIFIED Requirements

### Requirement: REQ-315 Sidebar communicates extension readiness

The sidebar SHALL show a compact extension-status row right below the user menu, outside navigation, aggregating active trackers and this device's extension: neutral when no active tracker needs the extension; red when it is needed but unavailable or incompatible, or this website is not approved; orange when those are fine but an extension-required destination is not approved; green when all is valid. Direct-capable trackers SHALL NOT lower the state.

#### Scenario: Extension is not required
- **WHEN** no active tracker has `directBrowserAccess: false`
- **THEN** the indicator SHALL show a neutral state saying that the extension is not required, even if no extension is installed

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

The status row SHALL open a localized popover on hover, focus, click or tap, separating the extension connection and compatibility, this website's approval, and each tracker's destination approval, extension-required trackers first and direct-capable ones marked not required. Approving stays in the extension's UI; with a ready connection an unapproved required tracker SHALL offer to send a suggestion (REQ-421) and report the result. The collapsed sidebar SHALL keep a clear icon and status.

#### Scenario: Inspect status with keyboard
- **WHEN** a keyboard user focuses or activates the status row
- **THEN** the popover SHALL open, remain keyboard operable, and expose its status meaning without relying on color alone

#### Scenario: Extension not needed is said once
- **WHEN** no active tracker requires the extension and the popover opens
- **THEN** it SHALL state once, as plain text, that the extension is not needed, and each tracker row SHALL show the tracker without repeating that it connects directly

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

### Requirement: REQ-408 Extension pages share the application's visual language

The extension popup and options page SHALL use the same component library, brand `primary` (cyan) and `neutral` (slate) palette, and typefaces as the web application. Each page header SHALL show the brand mark tinted with the `primary` color, next to the product name. Every icon and font on these pages SHALL ship inside the extension build. The pages SHALL NOT fetch icons, fonts, or styles over the network, and the extension's content security policy SHALL NOT be relaxed to allow it.

#### Scenario: Header shows the brand mark
- **WHEN** the popup or the options page opens in light or dark theme
- **THEN** its header SHALL show the open-dial brand mark in the theme's `primary` shade, next to "OSI Time Tracker"

#### Scenario: Pages render offline
- **WHEN** an extension page opens while the browser has no network access
- **THEN** every icon, font and style SHALL render, and the page SHALL make no network request to load them

#### Scenario: Popup status is a labelled badge
- **WHEN** reading the approvals or another popup operation failed
- **THEN** the header SHALL show a "Needs attention" badge
- **WHEN** nothing failed and some approved origin lacks browser site access
- **THEN** the header SHALL show a "No access" badge, an alert SHALL name the affected website or tracker with a restore action that opens the setup page with focus on the control that restores it, and the affected row, where the approval lists are shown, SHALL carry a "No access" badge
- **WHEN** nothing failed, every approval has access and tracker suggestions are pending
- **THEN** the badge SHALL show the count to approve, for example "2 to approve"
- **WHEN** nothing failed or is pending and no website or no tracker is approved yet
- **THEN** the badge SHALL read "Setup needed"
- **WHEN** a website and a tracker are approved, nothing failed or is pending and every approval has access
- **THEN** the badge SHALL read "Ready"

#### Scenario: Status never depends on color alone
- **WHEN** the popup shows any status badge
- **THEN** the badge SHALL carry its label and an icon of its own

#### Scenario: Approval lists show access state per row
- **WHEN** the options page lists an approved website or tracker whose origin lacks browser site access
- **THEN** an alert above the lists SHALL name it, and that row SHALL show a "No access" badge; when it is the only affected approval, the alert's action SHALL restore it and the row SHALL offer no second restore action, otherwise each affected row SHALL show its own restore action next to the revoke action
- **WHEN** a row's origin has site access
- **THEN** the row SHALL show only the revoke action

#### Scenario: Icon-only actions keep an accessible name
- **WHEN** a revoke action is rendered as an icon-only button
- **THEN** it SHALL expose an accessible name that includes the affected origin, and SHALL show a tooltip with the action name on hover and focus

#### Scenario: Loading failure keeps the retry path
- **WHEN** reading approvals or permissions fails on either page
- **THEN** the page SHALL show the translated error in a titled alert, saying that nothing was deleted, together with a retry action that reads them again
