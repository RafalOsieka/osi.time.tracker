# tracker-management Specification

## Purpose

Define how authenticated users manage first-class Trackers: named remote issue-tracker connections (system type, base URL, execution mode, rounding) with browser-only API secrets, list/create/edit/soft-delete APIs and an accessible Trackers UI, plus server-execution proxy behavior for tracker operations.

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
The system SHALL allow an authenticated user to create a tracker via `POST /api/trackers` with a required `name`, `systemType` (`redmine` or `openproject`), `baseUrl`, `directBrowserAccess`, and `roundingRule`. `directBrowserAccess` SHALL be boolean and SHALL default to `true` when omitted. The tracker form SHALL expose it as a localized **Direct browser connection allowed** checkbox with accessible help explaining that some tracker installations block connections from other websites, that disabling it requires the OSI browser extension, and that the technical setting is CORS. Saving `false` SHALL NOT require an installed or approved extension. All existing name, URL, ownership, and non-persistence validation rules remain unchanged.

#### Scenario: Execution mode defaults to client
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

#### Scenario: Unknown execution mode rejected
- **WHEN** a request submits a non-boolean `directBrowserAccess` value
- **THEN** validation SHALL reject it and persist nothing

#### Scenario: Mobile user can select client mode
- **WHEN** a mobile or PWA user configures a tracker reachable by the device and allowed by the tracker's CORS policy
- **THEN** the user SHALL be able to save and use `directBrowserAccess: true`

#### Scenario: Help is available without a pointer
- **WHEN** a keyboard user focuses the help control beside the checkbox
- **THEN** the localized explanation SHALL become available without changing the field value

### Requirement: REQ-246 Edit a tracker
The system SHALL allow an authenticated user to update their own tracker via `PATCH /api/trackers/[id]`, applying the same validation as creation for provided fields. Editing SHALL be scoped by `userId`. Editing any configuration field, including `systemType`, normalized `baseUrl`, or `directBrowserAccess`, SHALL retain the tracker identity and existing Task remote issue references without remote validation, cleanup, or metadata migration. A capability change SHALL affect only future remote requests. On success the updated tracker SHALL be returned and the row SHALL reflect the change.

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
The system SHALL soft-delete a tracker via `DELETE /api/trackers/[id]` by setting `deletedAt`, scoped by `userId`, and SHALL never hard-delete the row. Deletion SHALL be confirmed via a confirm dialog before it is performed, including when projects still reference the tracker. Soft-delete SHALL preserve existing Task remote issue references and their cached issue IDs and titles as historical data, and the client SHALL clear the browser-held secret for that tracker id. Projects that still reference the tracker SHALL keep their `trackerId` FK; linking and push SHALL treat the tracker as inactive. Creating a later active tracker SHALL NOT automatically reassign preserved Task references to it.

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

### Requirement: REQ-248 Tracker isolation and auth
Every tracker read and write SHALL be scoped by the authenticated user's id. A tracker id belonging to another user, or an unknown id, SHALL resolve to HTTP 404 without confirming the resource's existence. Mutating requests SHALL be guarded by authentication and CSRF.

#### Scenario: Foreign tracker id on read or write
- **WHEN** an authenticated user references a tracker id owned by another user
- **THEN** the system SHALL respond with HTTP 404 and SHALL NOT reveal that the resource exists

#### Scenario: Unknown tracker id
- **WHEN** an authenticated user references a tracker id that does not exist
- **THEN** the system SHALL respond with HTTP 404

#### Scenario: Unauthenticated request is rejected
- **WHEN** an unauthenticated request targets a tracker endpoint
- **THEN** the system SHALL reject it via `requireAuth`

### Requirement: REQ-249 Client-side credentials are never persisted server-side
The API secret SHALL be entered and kept only in the user's browser and SHALL never be stored on the OSI server. When direct browser access is allowed the secret SHALL be sent only to the configured tracker origin. When the extension is required the secret SHALL pass transiently through the approved extension to the approved tracker destination and SHALL NOT be persisted by the extension or transmitted to OSI APIs. The secret SHALL be stored in the browser keyed by tracker id and SHALL remain available after reload.

#### Scenario: Browser retains the secret across sessions
- **WHEN** a user enters an API secret for a tracker
- **THEN** it SHALL remain browser-held and SHALL NOT be persisted on the OSI server

#### Scenario: Switching execution mode retains browser ownership
- **WHEN** a user changes `directBrowserAccess`
- **THEN** the existing browser-held secret SHALL remain the credential source and SHALL NOT migrate to extension or server storage

#### Scenario: Server execution forwarding does not persist the secret
- **WHEN** a stale caller attempts server execution with a secret
- **THEN** validation SHALL reject the unsupported request and no OSI remote-operation endpoint SHALL receive the secret

### Requirement: REQ-314 Existing tracker execution modes migrate without relationship changes
The system SHALL replace persisted execution mode with direct-browser capability before application code reads the new contract. A `client` value SHALL become `directBrowserAccess: true`, and an `extension` value SHALL become `directBrowserAccess: false`. The obsolete execution-mode field SHALL be removed. Tracker identity, ownership, connection settings, timestamps, and all related domain records SHALL remain unchanged.

#### Scenario: Existing client tracker is upgraded
- **WHEN** the migration encounters a tracker with `executionMode: client`
- **THEN** it SHALL set `directBrowserAccess` to `true` and preserve all other data

#### Scenario: Existing extension tracker is upgraded
- **WHEN** the migration encounters a tracker with `executionMode: extension`
- **THEN** it SHALL set `directBrowserAccess` to `false` and preserve all other data

### Requirement: REQ-251 Accessible, tokenized Trackers UI
The Trackers page SHALL meet WCAG 2.1 AA: form fields SHALL be labelled, the create/edit modal and confirm modal SHALL be accessible and keyboard operable, and invalid fields SHALL expose `aria-invalid` with an associated described error. Styling SHALL derive from Tailwind utilities and Nuxt UI `--ui-*` design tokens with no ad-hoc inline colors, and all user-facing strings SHALL exist in `en` and `pl` in parity. The create/edit form SHALL be a single surface covering name and all connection fields plus the browser-only secret input.

#### Scenario: Inline field error is accessible
- **WHEN** a field validation error is shown
- **THEN** the field SHALL expose `aria-invalid` and reference the error via `aria-describedby`

#### Scenario: Strings localized in parity
- **WHEN** new user-facing tracker strings are added
- **THEN** they SHALL exist in both `en.json` and `pl.json` with matching keys

### Requirement: REQ-252 Client-side validation of the tracker form
The tracker create/edit form SHALL validate input client-side using the shared create/update tracker schema from `shared/types` (bound directly to Nuxt UI's `UForm` `:schema`) before any request is sent. Validation failures SHALL render the schema's messageKey translated via `t()` as an inline field error and SHALL prevent the request. Server-side validation SHALL remain authoritative; server-only field errors (e.g. `error.trackerNameDuplicate`) SHALL still render inline under the field after submission.

#### Scenario: Empty name blocked client-side
- **WHEN** the user submits the tracker form with an empty or whitespace-only name
- **THEN** the form SHALL show the required-name messageKey inline and SHALL NOT send a request

#### Scenario: Server-only duplicate error still shown inline
- **WHEN** the submitted name passes client-side validation but the server rejects it as a duplicate
- **THEN** the `error.trackerNameDuplicate` message SHALL render inline under the name field

### Requirement: REQ-256 Nearest-increment rounding rules on trackers
The accepted `roundingRule` values on a tracker SHALL be `none`, `up_15m`, `up_30m`, `up_1h`, `nearest_15m`, `nearest_30m` and `nearest_1h`. A `nearest_*` rule SHALL round a summed duration to the closest multiple of its increment, rounding **up** when the remainder is exactly half the increment. The `up_*` rules SHALL keep rounding up to the next multiple, and `none` SHALL pass the total through unchanged. Rounding SHALL remain a pure, once-applied, export-time transformation that never alters stored local entries. The tracker form SHALL offer every accepted rule with a translated label in both `en` and `pl`.

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

### Requirement: REQ-259 Trackers page list available on initial SSR render
The Trackers management page (`/trackers`) SHALL resolve the authenticated user's tracker list during server-side rendering of a full document load so the initial HTML/payload already contains the list data (or an empty list for the empty state). The SSR list fetch SHALL authenticate using the incoming session cookie. After mutations (create/update/delete), the page MAY refresh the list client-side; client navigations to `/trackers` within a hydrated session MAY reuse Nuxt async-data caching for the list key.

#### Scenario: Hard reload shows tracker rows without client-only bootstrap
- **WHEN** an authenticated user with at least one tracker performs a full document load of `/trackers`
- **THEN** the initial render payload SHALL already include those trackers so the table can render rows without depending solely on an `onMounted` client fetch

#### Scenario: Hard reload empty state
- **WHEN** an authenticated user with no trackers performs a full document load of `/trackers`
- **THEN** the page SHALL be able to render the empty state from the SSR-resolved empty list without a mandatory post-mount list fetch to discover emptiness

#### Scenario: SSR list uses the session cookie
- **WHEN** the Trackers page resolves the list during SSR
- **THEN** the request SHALL carry the browser session cookie material available on the incoming HTTP request

### Requirement: REQ-305 Persisted server execution modes migrate to client

The system SHALL migrate every persisted tracker whose execution mode is `server` to `client` before application code that accepts only the two-mode contract reads it. Tracker identity, ownership, system type, base URL, rounding rule, timestamps, project associations, and remote issue references SHALL remain unchanged.

#### Scenario: Existing server tracker is upgraded
- **WHEN** the migration encounters a tracker with `executionMode: server`
- **THEN** it SHALL change only the execution mode to `client`

#### Scenario: Existing supported modes are unchanged
- **WHEN** the migration encounters a tracker with `executionMode: client` or `executionMode: extension`
- **THEN** it SHALL leave that tracker unchanged
