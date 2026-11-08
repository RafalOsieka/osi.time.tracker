# remote-extension-setup Specification

## Purpose

Defines the extension-owned setup experience: how a user goes from a fresh install to working approvals, how the popup and setup page guide them, and what the extension shows about its own state and recent tracker activity.

## Requirements

### Requirement: REQ-411 Setup guidance is an onboarding checklist

While setup is incomplete, the setup page and the popup SHALL show a checklist: approve the OSI website, then a tracker, each step reflecting saved approvals and the current one carrying its action. An instruction set apart from the steps SHALL tell the user to turn off the tracker's direct browser connection in OSI, which the extension cannot observe. Once a website and a tracker are approved, both pages SHALL hide the checklist and SHALL NOT show a permanent status sentence.

#### Scenario: Fresh install
- **WHEN** a user opens the setup page with no approvals saved
- **THEN** the checklist SHALL show the website step as current and the tracker step as pending

#### Scenario: First use in the popup
- **WHEN** the popup opens before setup is complete
- **THEN** it SHALL say in one sentence what the extension does, SHALL NOT show the approval lists, and the current step SHALL say that the approval continues on the setup page, which its action SHALL open with that step's form focused

#### Scenario: Current step on the setup page
- **WHEN** the setup page shows the checklist and the user activates the current step's action
- **THEN** focus SHALL move to that step's form field

#### Scenario: Website approved, no tracker
- **WHEN** a website is approved but no tracker destination is
- **THEN** the checklist SHALL mark the website step done, naming the approved website, and the tracker step current, in both the popup and the setup page

#### Scenario: Setup complete
- **WHEN** at least one website and one tracker destination are approved
- **THEN** neither page SHALL show the checklist or the text "Open Options to approve a website and tracker destination"

#### Scenario: Instructions follow the state
- **WHEN** setup is complete, or the approvals cannot be read
- **THEN** the setup page SHALL NOT keep onboarding instructions, only its one-sentence purpose

#### Scenario: Approvals cannot be read
- **WHEN** reading approvals fails
- **THEN** the page SHALL show a titled error alert with its retry action instead of the checklist

### Requirement: REQ-412 Action outcomes are announced transiently

The setup page SHALL announce the outcome of an approve, revoke, restore or dismiss action as a transient, accessible notification in the selected language, naming its website or tracker, never as a permanent status line. Failures needing the user SHALL stay in an alert with their recovery action until resolved.

#### Scenario: Approval saved
- **WHEN** the user approves a tracker destination successfully
- **THEN** a notification SHALL announce that a tracker was approved, naming its address, and SHALL disappear without user action

#### Scenario: Suggestion dismissed
- **WHEN** the user dismisses a suggested tracker
- **THEN** the notification SHALL name the dismissed tracker

#### Scenario: Website approved
- **WHEN** the user approves a website
- **THEN** the notification SHALL name it and SHALL remind the user to reload its open tabs, and the page SHALL NOT show that reminder permanently

#### Scenario: Change fails
- **WHEN** an approval change cannot be fully completed
- **THEN** the page SHALL show the persistent error alert with its retry action, not a transient notification

### Requirement: REQ-413 Revoking a website with trackers is confirmed

Revoking a website that still has approved tracker destinations SHALL first ask for confirmation, naming the website and the trackers whose approvals go with it. Cancelling SHALL leave every approval and browser permission unchanged. Revoking a website without trackers, or revoking a single tracker, SHALL NOT ask for confirmation.

#### Scenario: Website with trackers
- **WHEN** the user activates revoke on a website that has three approved trackers
- **THEN** a confirmation SHALL state that the approval of the website and of its three trackers will be removed, list those trackers, and say that nothing changes in the trackers themselves, and nothing SHALL change until the user confirms

#### Scenario: Cancel
- **WHEN** the user cancels the confirmation, by its button or the Escape key
- **THEN** the website, its trackers and their browser permissions SHALL remain, and focus SHALL return to the revoke control

#### Scenario: Website without trackers
- **WHEN** the user revokes a website that has no approved trackers
- **THEN** it SHALL be revoked without a confirmation step

### Requirement: REQ-414 Approved origins open from the extension

Each approved website and tracker row in the popup or setup page SHALL show its address as a link. Activating a website link SHALL focus an existing tab on that exact origin when one is open, and SHALL open a new tab otherwise. Activating a tracker link SHALL open its base URL in a new tab. Links SHALL be keyboard operable, with accessible names that identify the target.

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

#### Scenario: Addresses without their scheme
- **WHEN** a row shows an approved address
- **THEN** it SHALL show the address without its scheme, and a plain-HTTP tracker SHALL be marked as unencrypted

### Requirement: REQ-415 Popup offers to approve the current website

When the popup opens on a tab whose origin is a valid website origin (REQ-308) and is not approved yet, it SHALL offer to approve that origin. Accepting SHALL open the setup page with the origin pre-filled in the website form. The browser permission prompt SHALL run only after the user confirms on the setup page. The popup SHALL NOT request host permissions itself, and SHALL NOT read the tab's URL before the user opens the popup.

#### Scenario: Unapproved OSI tab
- **WHEN** the user opens the popup on `https://time.example.com/timer` and that origin is not approved
- **THEN** the popup SHALL offer to approve this website, saying that approval continues on the setup page, and accepting SHALL open the setup page with `https://time.example.com` pre-filled and the approve action focused

#### Scenario: Offer during onboarding
- **WHEN** the offer applies while the checklist's website step is current
- **THEN** the offer SHALL be that step's own action, not a second card repeating it

#### Scenario: Handed-over address explained
- **WHEN** the setup page opens with an address the popup handed over
- **THEN** the website form SHALL say that the address comes from the tab where the extension was opened and that the user should approve it if they use that OSI

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

The extension SHALL keep suggestions from approved websites (remote-browser-extension REQ-421) as pending items until the user handles them, in a titled section. Each item SHALL show its provider, tracker URL and requesting website, with Approve and Dismiss actions. Approving SHALL follow the regular destination approval, with its permission prompt and HTTP warning. Dismissing SHALL remove the item without approving it.

#### Scenario: Review a suggestion
- **WHEN** an approved website suggests a Redmine destination
- **THEN** the popup and the setup page SHALL list it as pending under a section that names trackers to approve, naming the provider, the tracker URL and the website (once for the section when every pending item comes from the same website); the setup page SHALL show the count beside the section title

#### Scenario: Approve from the setup page
- **WHEN** the user approves a pending suggestion on the setup page and grants the browser permission
- **THEN** the destination SHALL be approved for the suggesting website and the item SHALL leave the pending list

#### Scenario: Approve from the popup
- **WHEN** the user chooses to review a suggestion in the popup
- **THEN** the popup SHALL open the setup page with that suggestion marked for review and its approve action focused, or its dismiss action when the tracker uses plain HTTP, and SHALL NOT request permissions itself

#### Scenario: Permission denied
- **WHEN** the user denies the browser permission for a suggestion
- **THEN** no approval SHALL be saved and the suggestion SHALL stay pending

#### Scenario: HTTP destination
- **WHEN** a pending suggestion targets an `http://` tracker, loopback included
- **THEN** the popup item SHALL be marked as unencrypted, and the setup page item SHALL warn that the API key travels unencrypted whenever OSI connects to the tracker, with an approve action whose visible label and accessible name both say it approves despite HTTP

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

For each approved tracker destination, the extension SHALL record the most recent operation: its time, the operation name, and its outcome (success, or the safe error kind). The popup and the setup page SHALL show this record on the tracker's row as outcome, operation and relative time. The record SHALL be kept only for the browser session. It SHALL NOT contain request or response bodies, credentials, or URLs beyond the approved destination. It SHALL be removed when the destination is revoked.

#### Scenario: Successful export
- **WHEN** a time entry is created through the extension on a Redmine destination
- **THEN** that tracker's row SHALL show the time of the operation, the create operation and a success mark with accessible text

#### Scenario: Failed operation
- **WHEN** the latest operation on a destination failed
- **THEN** the row SHALL say in words that the operation failed, with its time, using one failure phrase on both pages, and a line below SHALL give the reason, kept apart from the row's current-state badge

#### Scenario: Timeout
- **WHEN** the latest operation on a destination timed out
- **THEN** the row SHALL show the timeout outcome, replacing any earlier record

#### Scenario: Rejected before execution
- **WHEN** an operation is rejected before any tracker request, because its destination is unapproved or its input is malformed
- **THEN** no activity SHALL be recorded for an approved destination it does not match

#### Scenario: No activity yet
- **WHEN** a destination has had no operation in the current browser session
- **THEN** the row SHALL show that there has been no activity in this session

#### Scenario: Browser restarted
- **WHEN** the browser is restarted
- **THEN** every activity record SHALL be gone

### Requirement: REQ-420 Destination form omits a single-choice website

When exactly one website is approved, the destination form SHALL NOT show the website select; it SHALL assign the destination to that website and say so. With two or more websites, the select SHALL be shown with the first website chosen, and tracker rows SHALL name their website.

#### Scenario: One website
- **WHEN** exactly one website is approved and the user approves a tracker
- **THEN** the form SHALL show no website select, the tracker SHALL be approved for that website, and tracker rows SHALL NOT repeat the website

#### Scenario: Several websites
- **WHEN** two websites are approved
- **THEN** the form SHALL show the website select with the first website chosen, and the user MAY choose the other before approving

#### Scenario: No website
- **WHEN** no website is approved
- **THEN** the tracker section SHALL show no approve form and SHALL explain that a website must be approved first

### Requirement: REQ-523 Setup page lists approvals before their forms
On the setup page, a section with at least one approved website or tracker SHALL show its list first and its approve form only after the user activates the section's add action. A section with nothing approved SHALL keep its form open. While the approvals cannot be read, the page SHALL show neither lists nor forms, so unread settings never look empty.

#### Scenario: Approvals listed first
- **WHEN** the setup page lists at least one approved website
- **THEN** the website list SHALL come first and the website form SHALL appear only after the user activates the list's add action

#### Scenario: Empty section keeps its form
- **WHEN** no tracker is approved yet and a website is
- **THEN** the tracker section SHALL show its approve form without an add action

#### Scenario: Unread approvals
- **WHEN** reading the approvals fails
- **THEN** the page SHALL show no approval list and no approve form
