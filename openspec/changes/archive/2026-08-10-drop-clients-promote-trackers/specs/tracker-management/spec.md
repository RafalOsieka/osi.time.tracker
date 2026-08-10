## Purpose

Define how authenticated users manage first-class Trackers: named remote issue-tracker connections (system type, base URL, execution mode, rounding, required-field defaults) with browser-only API secrets, list/create/edit/soft-delete APIs and an accessible Trackers UI, plus server-execution proxy behavior for tracker operations.

## ADDED Requirements

### Requirement: REQ-244 List own trackers
The system SHALL show the authenticated user only their own non-deleted trackers, ordered by name, via `GET /api/trackers`. The list SHALL exclude any tracker whose `deletedAt` is set and any tracker belonging to another user. Each tracker DTO SHALL include non-secret connection fields (`id`, `name`, `systemType`, `baseUrl`, `executionMode`, `roundingRule`, `requiredFieldDefaults`, timestamps) and SHALL never include an API secret.

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

### Requirement: REQ-245 Create a tracker
The system SHALL allow an authenticated user to create a tracker via `POST /api/trackers` with a required `name`, `systemType` (`redmine` or `openproject`), `baseUrl`, `executionMode`, and `roundingRule`, plus optional `requiredFieldDefaults`. `executionMode` SHALL accept `client` or `server` and SHALL default to `client` when omitted. The `name` SHALL be trimmed, non-empty, length-bounded, and unique per user among non-deleted trackers. `baseUrl` SHALL be a valid URL. On success the created tracker SHALL be returned and a success Toast SHALL be shown. The API secret SHALL NOT be accepted as a stored field.

#### Scenario: Successful creation
- **WHEN** an authenticated user submits a valid unique name and valid connection fields
- **THEN** the system SHALL create the tracker scoped to the user, return it (without secret), and the new tracker SHALL appear in the list

#### Scenario: Empty name rejected
- **WHEN** the submitted name is empty or whitespace-only
- **THEN** the system SHALL reject the request with `{ messageKey, params }` and the field error SHALL render inline under the field

#### Scenario: Duplicate name rejected
- **WHEN** the submitted name matches an existing non-deleted tracker of the same user
- **THEN** the system SHALL reject the request with `messageKey: 'error.trackerNameDuplicate'` and the error SHALL render inline under the name field

#### Scenario: Archived name reuse
- **WHEN** the submitted name matches only a soft-deleted tracker of the same user
- **THEN** the system SHALL allow creation

#### Scenario: Execution mode defaults to client
- **WHEN** a user submits a tracker without an explicit `executionMode`
- **THEN** the system SHALL persist it with `executionMode` set to `client`

#### Scenario: Invalid base URL rejected
- **WHEN** a user submits a tracker whose `baseUrl` is missing or not a valid URL
- **THEN** the system SHALL reject the request with `{ messageKey, params }` and persist nothing

#### Scenario: Unsupported system type rejected
- **WHEN** a user submits a `systemType` that is not `redmine` or `openproject`
- **THEN** the system SHALL reject the request with `{ messageKey, params }` and persist nothing

#### Scenario: Secret is not accepted as a stored field
- **WHEN** a create or update body includes a credential/secret field intended for storage
- **THEN** the server SHALL ignore or reject that field and SHALL never persist it

### Requirement: REQ-246 Edit a tracker
The system SHALL allow an authenticated user to update their own tracker via `PATCH /api/trackers/[id]`, applying the same validation as creation for provided fields. Editing SHALL be scoped by `userId`. Editing any configuration field, including `systemType` or normalized `baseUrl`, SHALL retain the tracker identity and existing Task remote issue references without remote validation, cleanup, or metadata migration. On success the updated tracker SHALL be returned and the row SHALL reflect the change.

#### Scenario: Successful edit
- **WHEN** an authenticated user submits valid changes for their own tracker
- **THEN** the system SHALL persist the updated values, return the same tracker id, and leave Task references linked without remote validation

#### Scenario: Rename to a duplicate rejected
- **WHEN** the new name matches another non-deleted tracker of the same user
- **THEN** the system SHALL reject the request with `messageKey: 'error.trackerNameDuplicate'` rendered inline

#### Scenario: Change tracker identity fields
- **WHEN** a user changes the existing tracker's system type or normalized base URL
- **THEN** the system SHALL assume referenced issue IDs remain valid and SHALL retain their cached titles without validation, cleanup, or migration prompts

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
The API secret SHALL be entered and kept only in the user's browser and SHALL never be stored on the server. In `client` execution mode the secret SHALL be sent only to the configured tracker origin. In `server` execution mode the secret MAY be transmitted to the OSI server per request solely for immediate upstream forwarding, but SHALL NOT be persisted, logged, or returned by the server. The secret SHALL be stored in the browser keyed by the tracker id and SHALL remain available after a page reload without being persisted on the server.

#### Scenario: Browser retains the secret across sessions
- **WHEN** a user enters an API secret for a tracker in the browser
- **THEN** the secret SHALL be stored only in the browser (localStorage keyed by the tracker id) and SHALL remain available after a page reload without being persisted on the server

#### Scenario: Server execution forwarding does not persist the secret
- **WHEN** the browser forwards the secret to the OSI server for a `server` execution-mode request
- **THEN** the server SHALL use it only for the immediate upstream request and SHALL NOT persist, log, or return it

### Requirement: REQ-250 Default values for the tracker's required fields
A user SHALL be able to store default values for the remote system's required fields as an adapter-agnostic key–value map (`requiredFieldDefaults`) on the tracker, so they can later pre-fill the Remote Sync page.

#### Scenario: Store required-field defaults
- **WHEN** a user saves a tracker including one or more required-field defaults (e.g. an activity id)
- **THEN** the system SHALL persist them as a string key–value map on the tracker

#### Scenario: Defaults are optional
- **WHEN** a user saves a tracker with no required-field defaults
- **THEN** the system SHALL persist the tracker with an empty defaults map and SHALL NOT treat the absence as an error

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

### Requirement: REQ-253 Proxy remote issue search through the OSI server
For a tracker whose `executionMode` is `server`, the system SHALL expose authenticated, user-scoped OSI server endpoints that forward title-phrase search and exact issue-ID lookup to the configured tracker and return the adapter-neutral issue shape. The client SHALL identify only the owned tracker and search input; the server SHALL derive the target tracker base URL from the authenticated user's owned stored tracker and SHALL NOT accept a target URL from the client. The endpoints SHALL forward exactly the known contract operations, SHALL NOT act as a generic HTTP pass-through, and SHALL delegate to the same provider adapter used in `client` execution mode. Title search SHALL require at least three trimmed characters and return a fixed bounded result set; issue-ID search SHALL require a non-empty valid remote issue ID and perform an exact lookup; both SHALL include open and closed issues.

#### Scenario: Server execution-mode title search returns matching issues
- **WHEN** an authenticated user submits a title search of at least three trimmed characters for their eligible Task under a `server` tracker
- **THEN** the OSI server SHALL query the tracker's remote origin server-side and return a bounded set of adapter-neutral issues regardless of status

#### Scenario: Target tracker is derived server-side, not client-supplied
- **WHEN** a server execution-mode search request includes any client-supplied target URL or origin
- **THEN** the server SHALL ignore it and resolve the tracker base URL solely from the authenticated user's owned stored tracker

#### Scenario: Invalid search input does not call the tracker
- **WHEN** a server execution-mode request has a title shorter than three trimmed characters or an empty or invalid issue ID
- **THEN** the server SHALL respond with a translated `{ messageKey, params }` validation error and SHALL NOT contact the remote system

### Requirement: REQ-254 Forwarded proxy credential is never persisted
For `server` execution-mode requests the browser SHALL send the tracker API secret per request in a dedicated request header, and the OSI server SHALL use it only to authorize the single upstream call. The server SHALL NOT persist, log, serialize, or return the forwarded secret, and SHALL NOT place it in any error payload. Server-execution endpoints SHALL require a valid session and CSRF protection for mutations and SHALL scope tracker lookup to the authenticated user.

#### Scenario: Secret is used only for the upstream call
- **WHEN** the server forwards a server execution-mode request using the per-request secret header
- **THEN** the secret SHALL be attached only to the upstream remote request and SHALL NOT be persisted, logged, or returned in any OSI response

#### Scenario: Missing forwarded secret is rejected
- **WHEN** a server execution-mode request omits the credential header
- **THEN** the server SHALL respond with a translated `{ messageKey, params }` error and SHALL NOT contact the remote system

#### Scenario: Unauthenticated or cross-user request is rejected
- **WHEN** a server execution-mode request lacks a valid session, lacks CSRF for a mutation, or references a tracker the user does not own
- **THEN** the server SHALL reject it without contacting the remote system and without disclosing the tracker

### Requirement: REQ-255 Proxy failures map to the translated error contract
The server-execution endpoints SHALL translate upstream outcomes into distinct `{ messageKey, params }` errors mirroring the client execution-mode error states: rejected credential, connection failure or timeout, and not-found. The server SHALL NOT return raw upstream status text or response bodies to the client.

#### Scenario: Upstream rejects the credential
- **WHEN** the remote system rejects the forwarded credential
- **THEN** the server SHALL respond with a distinct translated authentication `messageKey` and SHALL NOT expose the raw upstream body

#### Scenario: Tracker is unreachable from the server
- **WHEN** the upstream request fails to connect, times out, or its host cannot be resolved
- **THEN** the server SHALL respond with a distinct translated connection `messageKey`

#### Scenario: Requested issue does not exist
- **WHEN** an exact issue-ID lookup finds no matching issue
- **THEN** the server SHALL respond with a translated not-found result state without changing any Task reference

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
