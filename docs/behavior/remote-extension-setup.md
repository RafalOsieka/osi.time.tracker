# remote-extension-setup

## Purpose

Defines the extension-owned setup experience: how a user goes from a fresh install to working approvals, how the popup and setup page guide them, and what the extension shows about its own state and recent tracker activity.

## Requirements

### Requirement: Setup guidance is an onboarding checklist

While setup is incomplete, the setup page and the popup SHALL show a checklist: approve the Time Tracker App, then a tracker, each step reflecting saved approvals and the current one carrying its action. An instruction set apart from the steps SHALL tell the user to turn off the tracker's direct browser connection in OSI, which the extension cannot observe. Once a Time Tracker App and a tracker are approved, both pages SHALL hide the checklist and SHALL NOT show a permanent status sentence.

#### Scenario: Fresh install

- **WHEN** a user opens the setup page with no approvals saved
- **THEN** the checklist SHALL show the Time Tracker App step as current and the tracker step as pending

#### Scenario: First use in the popup

- **WHEN** the popup opens before setup is complete
- **THEN** it SHALL say in one sentence what the extension does, SHALL NOT show the approval lists, and the current step SHALL say that the approval continues on the setup page, which its action SHALL open with that step's form focused

#### Scenario: Current step on the setup page

- **WHEN** the setup page shows the checklist and the user activates the current step's action
- **THEN** focus SHALL move to that step's form field

#### Scenario: Time Tracker App approved, no tracker

- **WHEN** a Time Tracker App is approved but no Tracker URL is
- **THEN** the checklist SHALL mark the Time Tracker App step done, naming the approved Time Tracker App, and the tracker step current, in both the popup and the setup page

#### Scenario: Setup complete

- **WHEN** at least one Time Tracker App and one Tracker URL are approved
- **THEN** neither page SHALL show the checklist or the text "Open Options to approve a Time Tracker App and Tracker URL"

#### Scenario: Instructions follow the state

- **WHEN** setup is complete, or the approvals cannot be read
- **THEN** the setup page SHALL NOT keep onboarding instructions, only its one-sentence purpose

#### Scenario: Approvals cannot be read

- **WHEN** reading approvals fails
- **THEN** the page SHALL show a titled error alert with its retry action instead of the checklist

### Requirement: Action outcomes are announced transiently

The setup page SHALL announce the outcome of an approve, revoke, restore or dismiss action as a transient, accessible notification in the selected language, naming its Time Tracker App or tracker, never as a permanent status line. Failures needing the user SHALL stay in an alert with their recovery action until resolved.

#### Scenario: Approval saved

- **WHEN** the user approves a Tracker URL successfully
- **THEN** a notification SHALL announce that a tracker was approved, naming its address, and SHALL disappear without user action

#### Scenario: Suggestion dismissed

- **WHEN** the user dismisses a suggested tracker
- **THEN** the notification SHALL name the dismissed tracker

#### Scenario: Time Tracker App approved

- **WHEN** the user approves a Time Tracker App
- **THEN** the notification SHALL name it and SHALL remind the user to reload its open tabs, and the page SHALL NOT show that reminder permanently

#### Scenario: Change fails

- **WHEN** an approval change cannot be fully completed
- **THEN** the page SHALL show the persistent error alert with its retry action, not a transient notification

### Requirement: Revoking a Time Tracker App with trackers is confirmed

Revoking a Time Tracker App that still has approved Tracker URLs SHALL first ask for confirmation, naming the Time Tracker App and the trackers whose approvals go with it. Cancelling SHALL leave every approval and browser permission unchanged. Revoking a Time Tracker App without trackers, or revoking a single tracker, SHALL NOT ask for confirmation.

#### Scenario: Time Tracker App with trackers

- **WHEN** the user activates revoke on a Time Tracker App that has three approved trackers
- **THEN** a confirmation SHALL state that the approval of the Time Tracker App and of its three trackers will be removed, list those trackers, and say that nothing changes in the trackers themselves, and nothing SHALL change until the user confirms

#### Scenario: Cancel

- **WHEN** the user cancels the confirmation, by its button or the Escape key
- **THEN** the Time Tracker App, its trackers and their browser permissions SHALL remain, and focus SHALL return to the revoke control

#### Scenario: Time Tracker App without trackers

- **WHEN** the user revokes a Time Tracker App that has no approved trackers
- **THEN** it SHALL be revoked without a confirmation step

### Requirement: Approved origins open from the extension

Each approved Time Tracker App and tracker row in the popup or setup page SHALL show its address as a link. Activating a Time Tracker App link SHALL focus an existing tab on that exact origin when one is open, and SHALL open a new tab otherwise. Activating a tracker link SHALL open its base URL in a new tab. Links SHALL be keyboard operable, with accessible names that identify the target.

#### Scenario: OSI tab already open

- **WHEN** the user activates the Time Tracker App link for an origin with an open tab
- **THEN** the browser SHALL focus that tab and its window and SHALL NOT open another tab

#### Scenario: No OSI tab open

- **WHEN** no tab is open on the Time Tracker App's origin
- **THEN** the link SHALL open the origin in a new tab

#### Scenario: Different port is a different origin

- **WHEN** a tab is open on the same host but a different port
- **THEN** the Time Tracker App link SHALL open a new tab instead of focusing that one

#### Scenario: Tracker link

- **WHEN** the user activates a tracker link
- **THEN** the tracker base URL, including its installation path, SHALL open in a new tab

#### Scenario: Addresses without their scheme

- **WHEN** a row shows an approved address
- **THEN** it SHALL show the address without its scheme, and a plain-HTTP tracker SHALL be marked as unencrypted

### Requirement: Popup offers to approve the current Time Tracker App

When the popup opens on a tab whose origin is a valid Time Tracker App origin (`remote-browser-extension`) and is not approved yet, it SHALL offer to approve that origin. Accepting SHALL open the setup page with the origin pre-filled in the Time Tracker App form. The browser permission prompt SHALL run only after the user confirms on the setup page. The popup SHALL NOT request host permissions itself, and SHALL NOT read the tab's URL before the user opens the popup.

#### Scenario: Unapproved OSI tab

- **WHEN** the user opens the popup on `https://time.example.com/timer` and that origin is not approved
- **THEN** the popup SHALL offer to approve this Time Tracker App, saying that approval continues on the setup page, and accepting SHALL open the setup page with `https://time.example.com` pre-filled and the approve action focused

#### Scenario: Offer during onboarding

- **WHEN** the offer applies while the checklist's Time Tracker App step is current
- **THEN** the offer SHALL be that step's own action, not a second card repeating it

#### Scenario: Handed-over address explained

- **WHEN** the setup page opens with an address the popup handed over
- **THEN** the Time Tracker App form SHALL say that the address comes from the tab where the extension was opened and that the user should approve it if they use that OSI

#### Scenario: Already approved

- **WHEN** the active tab's origin is already approved
- **THEN** the popup SHALL NOT show the offer

#### Scenario: Ineligible page

- **WHEN** the active tab is a browser page, a file, or a non-loopback `http://` origin
- **THEN** the popup SHALL NOT show the offer

#### Scenario: User dismisses the permission prompt

- **WHEN** the user denies the browser permission on the setup page
- **THEN** no approval SHALL be saved, and the existing denied message SHALL be shown

### Requirement: Tracker suggestions are queued for review

The extension SHALL keep suggestions from approved Time Tracker Apps (`remote-browser-extension`) as pending items until the user handles them, in a titled section. Each item SHALL show its provider, tracker URL and requesting Time Tracker App, with Approve and Dismiss actions. Approving SHALL follow the regular Tracker URL approval, with its permission prompt and HTTP warning. Dismissing SHALL remove the item without approving it.

#### Scenario: Review a suggestion

- **WHEN** an approved Time Tracker App suggests a Redmine Tracker URL
- **THEN** the popup and the setup page SHALL list it as pending under a section that names trackers to approve, naming the provider, the tracker URL and the Time Tracker App (once for the section when every pending item comes from the same Time Tracker App); the setup page SHALL show the count beside the section title

#### Scenario: Approve from the setup page

- **WHEN** the user approves a pending suggestion on the setup page and grants the browser permission
- **THEN** the Tracker URL SHALL be approved for the suggesting Time Tracker App and the item SHALL leave the pending list

#### Scenario: Approve from the popup

- **WHEN** the user chooses to review a suggestion in the popup
- **THEN** the popup SHALL open the setup page with that suggestion marked for review and its approve action focused, or its dismiss action when the tracker uses plain HTTP, and SHALL NOT request permissions itself

#### Scenario: Permission denied

- **WHEN** the user denies the browser permission for a suggestion
- **THEN** no approval SHALL be saved and the suggestion SHALL stay pending

#### Scenario: HTTP Tracker URL

- **WHEN** a pending suggestion targets an `http://` tracker, loopback included
- **THEN** the popup item SHALL be marked as unencrypted, and the setup page item SHALL warn that the API key travels unencrypted whenever OSI connects to the tracker, with an approve action whose visible label and accessible name both say it approves despite HTTP

#### Scenario: Time Tracker App revoked

- **WHEN** the suggesting Time Tracker App's approval is revoked
- **THEN** its pending suggestions SHALL be removed

### Requirement: Pending suggestions are bounded and deduplicated

Repeating a suggestion that is already pending SHALL NOT add a second item. A suggestion for a Tracker URL that is already approved for that Time Tracker App SHALL NOT be queued. The number of pending suggestions SHALL be bounded. When the bound is reached, the extension SHALL reject further suggestions until the user handles some, and SHALL NOT evict existing items.

#### Scenario: Same suggestion twice

- **WHEN** a Time Tracker App sends the same Tracker URL suggestion twice
- **THEN** exactly one pending item SHALL exist

#### Scenario: Already approved

- **WHEN** a Time Tracker App suggests a Tracker URL it already has approved
- **THEN** no item SHALL be queued and the Time Tracker App SHALL be told that the Tracker URL is already approved

#### Scenario: Bound reached

- **WHEN** the pending list is full and another suggestion arrives
- **THEN** the suggestion SHALL be rejected with the limit error and the existing items SHALL be unchanged

### Requirement: Toolbar icon signals required attention

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

### Requirement: Last tracker activity is shown per Tracker URL

For each approved Tracker URL, the extension SHALL record the most recent operation: its time, the operation name, and its outcome (success, or the safe error kind). The popup and the setup page SHALL show this record on the tracker's row as outcome, operation and relative time. The record SHALL be kept only for the browser session. It SHALL NOT contain request or response bodies, credentials, or URLs beyond the approved Tracker URL. It SHALL be removed when the Tracker URL is revoked.

#### Scenario: Successful export

- **WHEN** a time entry is created through the extension on a Redmine Tracker URL
- **THEN** that tracker's row SHALL show the time of the operation, the create operation and a success mark with accessible text

#### Scenario: Failed operation

- **WHEN** the latest operation on a Tracker URL failed
- **THEN** the row SHALL say in words that the operation failed, with its time, using one failure phrase on both pages, and a line below SHALL give the reason, kept apart from the row's current-state badge

#### Scenario: Timeout

- **WHEN** the latest operation on a Tracker URL timed out
- **THEN** the row SHALL show the timeout outcome, replacing any earlier record

#### Scenario: Rejected before execution

- **WHEN** an operation is rejected before any tracker request, because its Tracker URL is unapproved or its input is malformed
- **THEN** no activity SHALL be recorded for an approved Tracker URL it does not match

#### Scenario: No activity yet

- **WHEN** a Tracker URL has had no operation in the current browser session
- **THEN** the row SHALL show that there has been no activity in this session

#### Scenario: Browser restarted

- **WHEN** the browser is restarted
- **THEN** every activity record SHALL be gone

### Requirement: Tracker URL form omits a single-choice Time Tracker App

When exactly one Time Tracker App is approved, the Tracker URL form SHALL NOT show the Time Tracker App select; it SHALL assign the Tracker URL to that Time Tracker App and say so. With two or more Time Tracker Apps, the select SHALL be shown with the first Time Tracker App chosen, and tracker rows SHALL name their Time Tracker App.

#### Scenario: One Time Tracker App

- **WHEN** exactly one Time Tracker App is approved and the user approves a tracker
- **THEN** the form SHALL show no Time Tracker App select, the tracker SHALL be approved for that Time Tracker App, and tracker rows SHALL NOT repeat the Time Tracker App

#### Scenario: Several Time Tracker Apps

- **WHEN** two Time Tracker Apps are approved
- **THEN** the form SHALL show the Time Tracker App select with the first Time Tracker App chosen, and the user MAY choose the other before approving

#### Scenario: No Time Tracker App

- **WHEN** no Time Tracker App is approved
- **THEN** the tracker section SHALL show no approve form and SHALL explain that a Time Tracker App must be approved first

### Requirement: Setup page lists approvals before their forms

On the setup page, a section with at least one approved Time Tracker App or tracker SHALL show its list first and its approve form only after the user activates the section's add action. A section with nothing approved SHALL keep its form open. While the approvals cannot be read, the page SHALL show neither lists nor forms, so unread settings never look empty.

#### Scenario: Approvals listed first

- **WHEN** the setup page lists at least one approved Time Tracker App
- **THEN** the Time Tracker App list SHALL come first and the Time Tracker App form SHALL appear only after the user activates the list's add action

#### Scenario: Empty section keeps its form

- **WHEN** no tracker is approved yet and a Time Tracker App is
- **THEN** the tracker section SHALL show its approve form without an add action

#### Scenario: Unread approvals

- **WHEN** reading the approvals fails
- **THEN** the page SHALL show no approval list and no approve form
