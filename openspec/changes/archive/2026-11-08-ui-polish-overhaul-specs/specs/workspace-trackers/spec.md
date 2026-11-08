## ADDED Requirements

### Requirement: REQ-525 Trackers page rows show how each tracker connects
Each row of the Trackers page SHALL show the tracker's name, system type, base URL and connection mode: a tracker with `directBrowserAccess: true` connects directly from the browser, one with `false` connects through the extension. The mode SHALL be stated in text, not by color or icon alone.

#### Scenario: Direct tracker
- **WHEN** the user views a tracker with `directBrowserAccess: true`
- **THEN** its row SHALL show its system type, base URL and a translated direct-connection label

#### Scenario: Extension tracker
- **WHEN** the user views a tracker with `directBrowserAccess: false`
- **THEN** its row SHALL show a translated label saying that it connects through the extension

### Requirement: REQ-526 The API secret field explains and reveals the secret
The tracker form's API secret field SHALL carry visible help text, not a placeholder, saying that the secret stays in this browser and never reaches the OSI server (REQ-495). A toggle button in the field SHALL show the secret as plain text and mask it again, with a translated accessible name and its state exposed through `aria-pressed`. The field SHALL be masked each time the form opens.

#### Scenario: The form states where the secret is kept
- **WHEN** the tracker form shows the API secret field, empty or filled
- **THEN** visible help text SHALL say that the secret stays in this browser and never reaches the OSI server

#### Scenario: The secret can be shown to check it
- **WHEN** the user activates the toggle button in the API secret field and later activates it again
- **THEN** the secret SHALL show as plain text after the first activation and be masked after the second, with `aria-pressed` following that state

#### Scenario: Masked on every open
- **WHEN** the user revealed the secret, closed the form and opens it again
- **THEN** the field SHALL be masked

## MODIFIED Requirements

### Requirement: REQ-247 Soft-delete a tracker
`DELETE /api/trackers/[id]` SHALL soft-delete the user's tracker (set `deletedAt`, never hard-delete) after a confirmation, even when projects still reference it. Those projects SHALL keep their `trackerId`, and linking and export SHALL treat the tracker as inactive. Task remote issue references SHALL stay as history with their cached ids and titles, and a later tracker SHALL NOT take them over. The client SHALL clear the browser-held secret for that tracker.

#### Scenario: Successful soft delete with projects attached
- **WHEN** an authenticated user confirms deletion of their own tracker that still has projects pointing at it
- **THEN** the system SHALL set `deletedAt`, retain the database row and project FKs, the tracker SHALL disappear from the active list, Task references SHALL remain, and a success Toast SHALL be shown

#### Scenario: Deletion requires confirmation
- **WHEN** the user activates the delete action
- **THEN** a confirm dialog SHALL be shown and no deletion SHALL occur until the user confirms

#### Scenario: Confirmation states the consequences
- **WHEN** the delete confirmation is shown
- **THEN** it SHALL name the tracker, say that its browser-held secret is removed and that its projects and time entries stay while linking and export to it stop, and offer a named delete action and a cancel action

#### Scenario: Browser secret cleared on delete
- **WHEN** a tracker is soft-deleted
- **THEN** the client SHALL clear the browser-held secret associated with that tracker id

#### Scenario: Use a reference after tracker removal
- **WHEN** a Task reference points to a deleted tracker
- **THEN** the system SHALL expose its cached issue ID and title but SHALL NOT query the remote system or generate an issue URL

#### Scenario: Configure again after removal
- **WHEN** the user creates a new active tracker after the prior tracker was removed
- **THEN** the system SHALL NOT automatically rebind old Task references to the new tracker

### Requirement: REQ-251 Accessible, tokenized Trackers UI
The Trackers page SHALL meet WCAG 2.1 AA: labelled fields, accessible and keyboard-operable create/edit and confirm dialogs, and invalid fields exposing `aria-invalid` with an associated error. Colors SHALL come from theme tokens, never inline colors, and all strings SHALL exist in `en` and `pl` in parity. One create/edit form SHALL hold the name, every connection field and the browser-only secret input.

#### Scenario: Inline field error is accessible
- **WHEN** a field validation error is shown
- **THEN** the field SHALL expose `aria-invalid` and reference the error via `aria-describedby`

#### Scenario: Strings localized in parity
- **WHEN** new user-facing tracker strings are added
- **THEN** they SHALL exist in both `en.json` and `pl.json` with matching keys

#### Scenario: Form fields in order
- **WHEN** the create or edit form opens
- **THEN** its fields SHALL follow the order name, system type, base URL, API secret, direct-browser checkbox, rounding rule, in reading and tab order

### Requirement: REQ-492 Create a tracker
`POST /api/trackers` SHALL create a tracker from a `name`, `systemType` (`redmine` or `openproject`), `baseUrl`, `roundingRule` and a boolean `directBrowserAccess` defaulting to `true`. The form SHALL show it as a **Direct browser connection allowed** checkbox with visible help (some installations block other websites; unchecking needs the OSI extension; the technical term is CORS). Saving `false` SHALL NOT require an installed extension. No secret SHALL ever be stored.

#### Scenario: Direct browser access defaults to true
- **WHEN** a user submits a tracker without `directBrowserAccess`
- **THEN** the system SHALL persist `directBrowserAccess` as `true`

#### Scenario: Successful creation
- **WHEN** an authenticated user submits valid unique connection fields
- **THEN** the tracker SHALL be created for that user and returned without a secret

#### Scenario: Empty name rejected
- **WHEN** the name is empty or whitespace-only
- **THEN** validation SHALL reject it and show an inline field error

#### Scenario: Duplicate name rejected
- **WHEN** the name duplicates another active tracker owned by the user
- **THEN** creation SHALL fail with `error.trackerNameDuplicate`

#### Scenario: Archived name reuse
- **WHEN** the name matches only a soft-deleted tracker
- **THEN** creation SHALL be allowed

#### Scenario: Invalid base URL rejected
- **WHEN** the base URL is invalid
- **THEN** validation SHALL reject it and persist nothing

#### Scenario: Unsupported system type rejected
- **WHEN** the system type is unsupported
- **THEN** validation SHALL reject it and persist nothing

#### Scenario: Secret is not accepted as a stored field
- **WHEN** a request includes a credential field for persistence
- **THEN** the server SHALL reject or ignore it and never persist it

#### Scenario: Required-field defaults are not accepted as a stored field
- **WHEN** a request includes `requiredFieldDefaults`
- **THEN** the server SHALL reject or ignore it and never persist it

#### Scenario: Extension selection round-trips without installation
- **WHEN** a user creates or edits a tracker with `directBrowserAccess: false` on a device without the extension
- **THEN** the setting SHALL persist while future remote operations require extension setup

#### Scenario: Non-boolean direct browser access rejected
- **WHEN** a request submits a non-boolean `directBrowserAccess` value
- **THEN** validation SHALL reject it and persist nothing

#### Scenario: Mobile user can allow direct browser access
- **WHEN** a mobile or PWA user configures a tracker reachable by the device and allowed by the tracker's CORS policy
- **THEN** the user SHALL be able to save and use `directBrowserAccess: true`

#### Scenario: Help is available without a pointer
- **WHEN** the tracker form shows the direct-browser checkbox
- **THEN** the localized explanation SHALL be visible as help text under it, not only in a tooltip, and the checkbox SHALL reference it through `aria-describedby`

### Requirement: REQ-256 Nearest-increment rounding rules on trackers
A tracker's `roundingRule` SHALL be one of `none`, `up_15m`, `up_30m`, `up_1h`, `nearest_15m`, `nearest_30m`, `nearest_1h`. `nearest_*` SHALL round a summed duration to the closest multiple of its increment, **up** at exactly half; `up_*` SHALL round up to the next multiple; `none` SHALL pass the total through. Rounding SHALL be a pure transformation applied once at export, never altering stored entries. The form SHALL offer every rule with an `en`/`pl` label.

#### Scenario: Nearest rule rounds down below the midpoint
- **WHEN** a selected total of 1 hour 3 minutes is rounded under `nearest_15m`
- **THEN** the result SHALL be 1 hour 0 minutes

#### Scenario: Exact midpoint rounds up
- **WHEN** a selected total of 1 hour 7 minutes 30 seconds is rounded under `nearest_15m`
- **THEN** the result SHALL be 1 hour 15 minutes

#### Scenario: Unsupported rounding rule is rejected
- **WHEN** a user saves a tracker with a `roundingRule` outside the accepted set
- **THEN** the system SHALL reject the request with a `{ messageKey, params }` validation error and persist nothing

#### Scenario: The form says rounding affects export only
- **WHEN** the tracker form shows the rounding rule select
- **THEN** visible help text SHALL say that the rule applies only to export and does not change local time entries
