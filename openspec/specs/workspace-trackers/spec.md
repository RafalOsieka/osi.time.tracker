# workspace-trackers Specification

## Purpose

How users manage trackers — named connections to an OpenProject or Redmine instance — through list, create, edit and soft-delete: the API secret kept only in the browser, the direct-browser capability that decides whether the extension is needed, and the rounding rule used for export.

## Requirements

### Requirement: REQ-244 List own trackers
The system SHALL show the authenticated user only their own non-deleted trackers, ordered by name, via `GET /api/trackers`. The list SHALL exclude any tracker whose `deletedAt` is set and any tracker belonging to another user. Each tracker DTO SHALL include non-secret connection fields (`id`, `name`, `systemType`, `baseUrl`, `directBrowserAccess`, `roundingRule`, timestamps) and SHALL never include an API secret or required-field defaults.

#### Scenario: User sees only their own trackers
- **WHEN** an authenticated user requests their trackers
- **THEN** the response SHALL contain only trackers where `userId` equals the user's id and `deletedAt` is null, ordered by name

#### Scenario: Soft-deleted trackers are excluded
- **WHEN** an authenticated user has a soft-deleted tracker
- **THEN** that tracker SHALL NOT appear in the list

#### Scenario: Empty state
- **WHEN** an authenticated user has no trackers
- **THEN** the Trackers page SHALL render a dedicated empty state with a create call-to-action instead of an empty table

#### Scenario: Response never exposes a credential
- **WHEN** a user lists or reads a tracker
- **THEN** the response DTO SHALL contain no credential or secret field

#### Scenario: Response never includes required-field defaults
- **WHEN** a user lists or reads a tracker
- **THEN** the response DTO SHALL contain no `requiredFieldDefaults` field

### Requirement: REQ-245 Create a tracker
`POST /api/trackers` SHALL create a tracker from a `name`, `systemType` (`redmine` or `openproject`), `baseUrl`, `roundingRule` and a boolean `directBrowserAccess` defaulting to `true`. The form SHALL show it as a **Direct browser connection allowed** checkbox with accessible help (some installations block other websites; unchecking needs the OSI extension; the technical term is CORS). Saving `false` SHALL NOT require an installed extension. No secret SHALL ever be stored.

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

#### Scenario: Removed server mode is rejected
- **WHEN** a stale create or update request submits an `executionMode` field with value `server`
- **THEN** the server SHALL reject the obsolete field with a translated validation error and persist nothing

#### Scenario: Non-boolean direct browser access rejected
- **WHEN** a request submits a non-boolean `directBrowserAccess` value
- **THEN** validation SHALL reject it and persist nothing

#### Scenario: Mobile user can allow direct browser access
- **WHEN** a mobile or PWA user configures a tracker reachable by the device and allowed by the tracker's CORS policy
- **THEN** the user SHALL be able to save and use `directBrowserAccess: true`

#### Scenario: Help is available without a pointer
- **WHEN** a keyboard user focuses the help control beside the checkbox
- **THEN** the localized explanation SHALL become available without changing the field value

### Requirement: REQ-246 Edit a tracker
`PATCH /api/trackers/[id]` SHALL update the user's own tracker, validating provided fields as on creation. Changing any field, including `systemType`, `baseUrl` or `directBrowserAccess`, SHALL keep the tracker's identity and its tasks' remote issue references, with no remote validation, cleanup or migration; a capability change affects only future remote requests. The updated tracker SHALL be returned and its row SHALL reflect the change.

#### Scenario: Successful edit
- **WHEN** an authenticated user submits valid changes for their own tracker
- **THEN** the system SHALL persist the updated values, return the same tracker id, and leave Task references linked without remote validation

#### Scenario: Rename to a duplicate rejected
- **WHEN** the new name matches another non-deleted tracker of the same user
- **THEN** the system SHALL reject the request with `messageKey: 'error.trackerNameDuplicate'` rendered inline

#### Scenario: Change tracker identity fields
- **WHEN** a user changes the existing tracker's system type or normalized base URL
- **THEN** the system SHALL assume referenced issue IDs remain valid and SHALL retain their cached titles without validation, cleanup, or migration prompts

#### Scenario: Change direct connection capability
- **WHEN** a user changes `directBrowserAccess`
- **THEN** projects, tasks, remote issue references, time entries, completed export records, and archived or deprecated records SHALL remain unchanged

### Requirement: REQ-247 Soft-delete a tracker
`DELETE /api/trackers/[id]` SHALL soft-delete the user's tracker (set `deletedAt`, never hard-delete) after a confirmation, even when projects still reference it. Those projects SHALL keep their `trackerId`, and linking and export SHALL treat the tracker as inactive. Task remote issue references SHALL stay as history with their cached ids and titles, and a later tracker SHALL NOT take them over. The client SHALL clear the browser-held secret for that tracker.

#### Scenario: Successful soft delete with projects attached
- **WHEN** an authenticated user confirms deletion of their own tracker that still has projects pointing at it
- **THEN** the system SHALL set `deletedAt`, retain the database row and project FKs, the tracker SHALL disappear from the active list, Task references SHALL remain, and a success Toast SHALL be shown

#### Scenario: Deletion requires confirmation
- **WHEN** the user activates the delete action
- **THEN** a confirm dialog SHALL be shown and no deletion SHALL occur until the user confirms

#### Scenario: Browser secret cleared on delete
- **WHEN** a tracker is soft-deleted
- **THEN** the client SHALL clear the browser-held secret associated with that tracker id

#### Scenario: Use a reference after tracker removal
- **WHEN** a Task reference points to a deleted tracker
- **THEN** the system SHALL expose its cached issue ID and title but SHALL NOT query the remote system or generate an issue URL

#### Scenario: Configure again after removal
- **WHEN** the user creates a new active tracker after the prior tracker was removed
- **THEN** the system SHALL NOT automatically rebind old Task references to the new tracker

### Requirement: REQ-249 Client-side credentials are never persisted server-side
The API secret SHALL be entered and kept only in the user's browser, keyed by tracker id and available after reload, and SHALL never be stored on or sent to the OSI server. With direct browser access it SHALL go only to the tracker's origin; when the extension is required it SHALL pass transiently through the approved extension to the approved destination, which SHALL NOT persist it.

#### Scenario: Browser retains the secret across sessions
- **WHEN** a user enters an API secret for a tracker
- **THEN** it SHALL remain browser-held and SHALL NOT be persisted on the OSI server

#### Scenario: Changing direct browser access keeps the secret in the browser
- **WHEN** a user changes `directBrowserAccess`
- **THEN** the existing browser-held secret SHALL remain the credential source and SHALL NOT migrate to extension or server storage

#### Scenario: No OSI endpoint receives the secret
- **WHEN** a caller still sends a request for the removed server execution with a secret
- **THEN** validation SHALL reject the request and no OSI endpoint SHALL receive or forward the secret

### Requirement: REQ-314 Existing tracker execution modes migrate without relationship changes
A database upgraded from a version that stored an execution mode SHALL hold `directBrowserAccess` instead: `true` where it was `client`, `false` where it was `extension`, with the old field gone. Tracker identity, ownership, connection settings, timestamps and all related records SHALL be unchanged.

#### Scenario: Existing client tracker is upgraded
- **WHEN** the migration encounters a tracker with `executionMode: client`
- **THEN** it SHALL set `directBrowserAccess` to `true` and preserve all other data

#### Scenario: Existing extension tracker is upgraded
- **WHEN** the migration encounters a tracker with `executionMode: extension`
- **THEN** it SHALL set `directBrowserAccess` to `false` and preserve all other data

### Requirement: REQ-251 Accessible, tokenized Trackers UI
The Trackers page SHALL meet WCAG 2.1 AA: labelled fields, accessible and keyboard-operable create/edit and confirm dialogs, and invalid fields exposing `aria-invalid` with an associated error. Colors SHALL come from theme tokens, never inline colors, and all strings SHALL exist in `en` and `pl` in parity. One create/edit form SHALL hold the name, every connection field and the browser-only secret input.

#### Scenario: Inline field error is accessible
- **WHEN** a field validation error is shown
- **THEN** the field SHALL expose `aria-invalid` and reference the error via `aria-describedby`

#### Scenario: Strings localized in parity
- **WHEN** new user-facing tracker strings are added
- **THEN** they SHALL exist in both `en.json` and `pl.json` with matching keys

### Requirement: REQ-252 Client-side validation of the tracker form
The tracker create/edit form SHALL validate input client-side with the same schema the server uses before any request is sent. A validation failure SHALL show the translated `messageKey` inline under the field and SHALL prevent the request. The server SHALL stay authoritative; its field errors (e.g. `error.trackerNameDuplicate`) SHALL still render inline under the field.

#### Scenario: Empty name blocked client-side
- **WHEN** the user submits the tracker form with an empty or whitespace-only name
- **THEN** the form SHALL show the required-name messageKey inline and SHALL NOT send a request

#### Scenario: Server-only duplicate error still shown inline
- **WHEN** the submitted name passes client-side validation but the server rejects it as a duplicate
- **THEN** the `error.trackerNameDuplicate` message SHALL render inline under the name field

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

### Requirement: REQ-257 Rounding never reduces a non-zero duration to zero
For any increment-based rounding rule, a total greater than `0` SHALL never round to `0`; when the rounded result would be `0`, the system SHALL return exactly one increment instead. A total of exactly `0` SHALL still round to `0` so that a task with no selected entries remains excluded from export.

#### Scenario: Short duration is lifted to one increment
- **WHEN** a selected total of 4 minutes is rounded under `nearest_15m`
- **THEN** the result SHALL be 15 minutes rather than 0, so the task remains exportable

#### Scenario: Empty selection stays zero
- **WHEN** the selected total is `0` under any rounding rule
- **THEN** the result SHALL be `0` and the task SHALL remain excluded from export

#### Scenario: Passthrough rule is unaffected
- **WHEN** a total of 4 minutes is rounded under `none`
- **THEN** the result SHALL be 4 minutes

### Requirement: REQ-364 Persisted server execution modes migrate to client

A database upgraded from a version that allowed a `server` execution mode SHALL have every such tracker set to `client` (later direct browser access, REQ-314), with identity, ownership, system type, base URL, rounding rule, timestamps, project associations and remote issue references unchanged.

#### Scenario: Existing server tracker is upgraded
- **WHEN** the migration encounters a tracker with `executionMode: server`
- **THEN** it SHALL change only the execution mode to `client`

#### Scenario: Existing supported modes are unchanged
- **WHEN** the migration encounters a tracker with `executionMode: client` or `executionMode: extension`
- **THEN** it SHALL leave that tracker unchanged

### Requirement: REQ-345 Trackers page exposes the import-history action
Each tracker row SHALL offer an "Import history" action beside edit and delete — a labelled, keyboard-operable control with a tooltip — opening the import dialog (REQ-340) for that tracker, for every supported `systemType`, with or without direct browser access. Without a stored browser secret it SHALL be disabled, its accessible name and tooltip a translated hint to enter the secret in the tracker form first. Strings SHALL have `en`/`pl` parity.

#### Scenario: Action opens the dialog
- **WHEN** the user activates Import history on a tracker whose secret is stored in the browser
- **THEN** the import dialog SHALL open for that tracker

#### Scenario: No secret disables the action
- **WHEN** a tracker has no stored secret
- **THEN** the action SHALL be disabled with the translated hint as its tooltip and accessible name

#### Scenario: Row actions remain siblings
- **WHEN** a tracker row renders edit, import, and delete
- **THEN** the three controls SHALL be sibling buttons, none nested inside another interactive element
