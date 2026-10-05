# Spec Delta

## Purpose

Defines the extension-owned setup experience: how a user goes from a fresh install to working approvals, how the popup and setup page guide them, and what the extension shows about its own state and recent tracker activity.

## ADDED Requirements

### Requirement: REQ-411 Setup guidance is an onboarding checklist

While setup is incomplete, the setup page and the popup SHALL show a checklist: approve the OSI website, approve a tracker, and turn off "Direct browser connection allowed" in OSI for the trackers that use the extension. The first two steps SHALL reflect saved approvals. The third step SHALL be informational, because the extension cannot observe it. Once a website and a tracker are approved, both pages SHALL hide the checklist and SHALL NOT show a permanent status sentence instead.

#### Scenario: Fresh install
- **WHEN** a user opens the setup page with no approvals saved
- **THEN** the checklist SHALL show the website step as current and the tracker step as pending

#### Scenario: Website approved, no tracker
- **WHEN** a website is approved but no tracker destination is
- **THEN** the checklist SHALL mark the website step done and the tracker step current, in both the popup and the setup page

#### Scenario: Setup complete
- **WHEN** at least one website and one tracker destination are approved
- **THEN** neither page SHALL show the checklist or the text "Open Options to approve a website and tracker destination"

#### Scenario: Approvals cannot be read
- **WHEN** reading approvals fails
- **THEN** the page SHALL show the existing error alert with its retry action instead of the checklist

### Requirement: REQ-412 Action outcomes are announced transiently

The setup page SHALL announce the outcome of an approve, revoke, restore or dismiss action as a transient, accessible notification in the selected language. It SHALL NOT keep the outcome as a permanent status line. Failures that need the user to act SHALL remain in an alert with their recovery action until resolved.

#### Scenario: Approval saved
- **WHEN** the user approves a tracker destination successfully
- **THEN** a notification SHALL announce that the approval was saved and SHALL disappear without user action

#### Scenario: Change fails
- **WHEN** an approval change cannot be fully completed
- **THEN** the page SHALL show the persistent error alert with its retry action, not a transient notification

### Requirement: REQ-413 Revoking a website with trackers is confirmed

Revoking a website that still has approved tracker destinations SHALL first ask for confirmation. The confirmation SHALL name the website and the number of tracker approvals that will be revoked with it. Cancelling SHALL leave every approval and browser permission unchanged. Revoking a website without trackers, or revoking a single tracker, SHALL NOT ask for confirmation.

#### Scenario: Website with trackers
- **WHEN** the user activates revoke on a website that has three approved trackers
- **THEN** a confirmation SHALL state that the website and its three tracker approvals will be revoked, and nothing SHALL change until the user confirms

#### Scenario: Cancel
- **WHEN** the user cancels the confirmation, by its button or the Escape key
- **THEN** the website, its trackers and their browser permissions SHALL remain, and focus SHALL return to the revoke control

#### Scenario: Website without trackers
- **WHEN** the user revokes a website that has no approved trackers
- **THEN** it SHALL be revoked without a confirmation step

### Requirement: REQ-414 Approved origins open from the extension

Every approved website and tracker shown in the popup or the setup page SHALL be a link. Activating a website link SHALL focus an existing tab on that exact origin when one is open, and SHALL open a new tab otherwise. Activating a tracker link SHALL open the tracker's base URL in a new tab. Links SHALL be keyboard operable and SHALL have accessible names that identify the target.

#### Scenario: OSI tab already open
- **WHEN** the user activates the website link for an origin with an open tab
- **THEN** the browser SHALL focus that tab and its window and SHALL NOT open another tab

#### Scenario: No OSI tab open
- **WHEN** no tab is open on the website's origin
- **THEN** the link SHALL open the origin in a new tab

#### Scenario: Different port is a different origin
- **WHEN** a tab is open on the same host but a different port
- **THEN** the website link SHALL open a new tab instead of focusing that one

#### Scenario: Tracker link
- **WHEN** the user activates a tracker link
- **THEN** the tracker base URL, including its installation path, SHALL open in a new tab

### Requirement: REQ-415 Popup offers to approve the current website

When the popup opens on a tab whose origin is a valid website origin (REQ-308) and is not approved yet, it SHALL offer to approve that origin. Accepting SHALL open the setup page with the origin pre-filled in the website form. The browser permission prompt SHALL run only after the user confirms on the setup page. The popup SHALL NOT request host permissions itself, and SHALL NOT read the tab's URL before the user opens the popup.

#### Scenario: Unapproved OSI tab
- **WHEN** the user opens the popup on `https://time.example.com/timer` and that origin is not approved
- **THEN** the popup SHALL offer to approve `https://time.example.com`, and accepting SHALL open the setup page with that origin pre-filled and the approve action focused

#### Scenario: Already approved
- **WHEN** the active tab's origin is already approved
- **THEN** the popup SHALL NOT show the offer

#### Scenario: Ineligible page
- **WHEN** the active tab is a browser page, a file, or a non-loopback `http://` origin
- **THEN** the popup SHALL NOT show the offer

#### Scenario: User dismisses the permission prompt
- **WHEN** the user denies the browser permission on the setup page
- **THEN** no approval SHALL be saved, and the existing denied message SHALL be shown

### Requirement: REQ-416 Tracker suggestions are queued for review

The extension SHALL keep suggestions received from approved websites (REQ-421 in remote-browser-extension) as pending items until the user handles them. A suggestion is a website, provider and destination, without any secret. Each pending item SHALL show the requesting website, provider and tracker URL, with Approve and Dismiss actions. Approving SHALL follow the regular destination approval, including the browser permission prompt and the HTTP warning. Dismissing SHALL remove the item without approving it.

#### Scenario: Review a suggestion
- **WHEN** an approved website suggests a Redmine destination
- **THEN** the popup and the setup page SHALL list it as pending, naming the website, the provider and the tracker URL

#### Scenario: Approve from the setup page
- **WHEN** the user approves a pending suggestion on the setup page and grants the browser permission
- **THEN** the destination SHALL be approved for the suggesting website and the item SHALL leave the pending list

#### Scenario: Approve from the popup
- **WHEN** the user chooses to approve a suggestion in the popup
- **THEN** the popup SHALL open the setup page with that suggestion highlighted, and SHALL NOT request permissions itself

#### Scenario: Permission denied
- **WHEN** the user denies the browser permission for a suggestion
- **THEN** no approval SHALL be saved and the suggestion SHALL stay pending

#### Scenario: HTTP destination
- **WHEN** a pending suggestion targets an `http://` tracker that is not loopback
- **THEN** the item SHALL show the credential-risk warning before the user approves it

#### Scenario: Website revoked
- **WHEN** the suggesting website's approval is revoked
- **THEN** its pending suggestions SHALL be removed

### Requirement: REQ-417 Pending suggestions are bounded and deduplicated

Repeating a suggestion that is already pending SHALL NOT add a second item. A suggestion for a destination that is already approved for that website SHALL NOT be queued. The number of pending suggestions SHALL be bounded. When the bound is reached, the extension SHALL reject further suggestions until the user handles some, and SHALL NOT evict existing items.

#### Scenario: Same suggestion twice
- **WHEN** a website sends the same destination suggestion twice
- **THEN** exactly one pending item SHALL exist

#### Scenario: Already approved
- **WHEN** a website suggests a destination it already has approved
- **THEN** no item SHALL be queued and the website SHALL be told that the destination is already approved

#### Scenario: Bound reached
- **WHEN** the pending list is full and another suggestion arrives
- **THEN** the suggestion SHALL be rejected with the limit error and the existing items SHALL be unchanged

### Requirement: REQ-418 Toolbar icon signals required attention

The toolbar icon SHALL show a badge when setup needs the user. When suggestions are pending, the badge SHALL show their count. Otherwise, when a saved approval lacks browser site access, it SHALL show an attention mark. Otherwise it SHALL show no badge. The icon's tooltip title SHALL describe the same state in the selected language, so the state does not depend on color alone.

#### Scenario: Suggestions pending
- **WHEN** two suggestions are pending
- **THEN** the badge SHALL show "2" and the title SHALL say two trackers are waiting for approval

#### Scenario: Missing site access
- **WHEN** no suggestion is pending and an approved origin lacks browser site access
- **THEN** the badge SHALL show an attention mark and the title SHALL say setup needs attention

#### Scenario: Everything in order
- **WHEN** nothing is pending and every approval has site access
- **THEN** no badge SHALL be shown and the title SHALL be the product name

#### Scenario: State changes elsewhere
- **WHEN** a suggestion is approved or dismissed, or access is restored, on any extension page
- **THEN** the badge SHALL update without the user reopening the popup

### Requirement: REQ-419 Last tracker activity is shown per destination

For each approved tracker destination, the extension SHALL record the most recent operation: its time, the operation name, and its outcome (success, or the safe error kind). The popup and the setup page SHALL show this record on the tracker's row as relative time, operation and outcome. The record SHALL be kept only for the browser session. It SHALL NOT contain request or response bodies, credentials, or URLs beyond the approved destination. It SHALL be removed when the destination is revoked.

#### Scenario: Successful export
- **WHEN** a time entry is created through the extension on a Redmine destination
- **THEN** that tracker's row SHALL show the time of the operation, the create operation and a success outcome

#### Scenario: Timeout
- **WHEN** the latest operation on a destination timed out
- **THEN** the row SHALL show the timeout outcome, replacing any earlier record

#### Scenario: Rejected before execution
- **WHEN** an operation is rejected before any tracker request, because its destination is unapproved or its input is malformed
- **THEN** no activity SHALL be recorded for an approved destination it does not match

#### Scenario: No activity yet
- **WHEN** a destination has had no operation in the current browser session
- **THEN** the row SHALL show that there has been no activity

#### Scenario: Browser restarted
- **WHEN** the browser is restarted
- **THEN** every activity record SHALL be gone

### Requirement: REQ-420 Destination form omits a single-choice website

When exactly one website is approved, the destination form SHALL NOT show the website select. It SHALL assign the destination to that website and state which website it is for. With two or more websites, the select SHALL be shown, and the form SHALL require a choice before approving.

#### Scenario: One website
- **WHEN** exactly one website is approved and the user approves a tracker
- **THEN** the form SHALL show no website select and the tracker SHALL be approved for that website

#### Scenario: Several websites
- **WHEN** two websites are approved
- **THEN** the form SHALL show the website select

#### Scenario: No website
- **WHEN** no website is approved
- **THEN** the approve action SHALL stay disabled and the form SHALL explain that a website must be approved first
