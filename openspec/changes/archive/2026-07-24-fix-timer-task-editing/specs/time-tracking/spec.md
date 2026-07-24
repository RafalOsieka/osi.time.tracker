## ADDED Requirements

### Requirement: REQ-179 Day-scoped reassignment of time entries to a task
The system SHALL allow an authenticated user to move a set of their time entries to a target task in one atomic operation via `POST /api/time-entries/reassign`, accepting `{ ids, name?, projectId? }` where `ids` is a non-empty array of entry uuids and `name` is trimmed and length-bounded. This powers the timer view's day-scoped group edits: the client sends exactly the entry ids of one day's task group so that only that day's entries move, while the same task's entries on other days are unaffected.

Within a single transaction the system SHALL determine the effective target scope from the listed entries' current task: when `projectId` is omitted, the target scope's project SHALL be the source task's current `projectId`; an explicit `null` SHALL target the project-less scope; a uuid SHALL target that owned, non-deleted project. The system SHALL resolve `(userId, effectiveName, effectiveProjectId)` to a `taskId` exactly once using the REQ-142 matching rules (find-or-create, no remote-issue-reference cloning), set that `taskId` on every listed entry, and then garbage-collect the source task if it is left with zero entries (hard delete, mirroring REQ-151). When `name` is omitted the entries keep their current task name and only the project scope changes.

Every listed entry MUST belong to the authenticated user; otherwise the whole request SHALL fail (HTTP 404 for foreign/unknown ids, or `{ messageKey, params }` for validation errors) and no entry SHALL be modified. On success the updated `TimeEntryDto`s SHALL be returned.

#### Scenario: Rename only the current day's entries
- **WHEN** a task is used on several days and the user reassigns just one day's entry ids with a new `name`
- **THEN** only those entries SHALL move to the find-or-create target task and the task's entries on other days SHALL remain on the original task

#### Scenario: Source task garbage-collected when emptied
- **WHEN** a reassignment moves the source task's last remaining entries away
- **THEN** the emptied source task SHALL be hard-deleted in the same transaction

#### Scenario: Reassign keeps the source project by default
- **WHEN** the user reassigns entries with a new `name` and omits `projectId`
- **THEN** the target task SHALL be resolved within the source task's current project scope

#### Scenario: Day-scoped project change
- **WHEN** the user reassigns a day's entries with a `projectId` (or explicit `null`) and no `name`
- **THEN** the entries SHALL move to the find-or-create task of the same name in that project scope, leaving other days' entries on the original task

#### Scenario: Atomic failure leaves entries untouched
- **WHEN** any listed id is foreign or unknown
- **THEN** the system SHALL reject the whole request with HTTP 404 and none of the listed entries SHALL be modified

### Requirement: REQ-180 Top-bar suggestion binding, labels, and popover anchoring
The top-bar timer widget's title autocomplete SHALL present each suggestion as a single object-based item resolved from `GET /api/tasks?search=`, using exactly one selection handler; it SHALL NOT nest an independently clickable control inside a menu item nor cast object items to strings. Selecting a suggestion by mouse or keyboard SHALL fire a single selection and SHALL NOT issue duplicate requests nor set a stringified-object (`[object Object]`) title.

Each suggestion label SHALL show the task name with its project/client context when present, and SHALL additionally append the remote issue id (from the task's remote issue reference) when the task has one.

When the user selects an existing suggestion, the widget SHALL capture that task's identity and send it to the server so the started/updated entry binds to that exact task (its project and remote reference), rather than reconstructing project/reference from front-end state. When the user commits a free-form title that matches no suggestion, the widget SHALL fall back to the title-based create path (REQ-142).

The elapsed-time start-edit popover SHALL be anchored to the elapsed-time control that opens it, so it appears adjacent to that control rather than to an unrelated element.

#### Scenario: Single selection, no duplicate requests
- **WHEN** the user selects a suggestion with the mouse
- **THEN** exactly one selection SHALL be handled, no duplicate requests SHALL be sent, and the title SHALL be the task name (never `[object Object]`)

#### Scenario: Suggestion label shows the remote issue id
- **WHEN** a suggested task has a remote issue reference
- **THEN** its label SHALL include the remote issue id alongside the name and project/client context

#### Scenario: Picking a suggestion binds to that exact task
- **WHEN** the user picks an existing suggestion and starts the timer
- **THEN** the entry SHALL bind to that task's identity (its project and remote reference), not a newly created project-less task

#### Scenario: Popover anchored to the elapsed control
- **WHEN** the user activates the elapsed-time control to edit the start
- **THEN** the popover SHALL open anchored to that control rather than misaligned to an unrelated element

## MODIFIED Requirements

### Requirement: REQ-140 Start a live timer
The system SHALL allow an authenticated user to start a live timer via `POST /api/time-entries`, creating a `TimeEntry` scoped to the user with `startedAt` set to the current server time and `stoppedAt` `null` (a running entry). The request MAY include an optional `title` (trimmed, length-bounded), an optional `projectId`, and an optional `taskId`; all MAY be omitted or `null`. When a `taskId` is provided, it SHALL identify an existing task owned by the authenticated user (a foreign or unknown `taskId` SHALL resolve to HTTP 404 without confirming existence); the entry SHALL bind directly to that task and its `title`/`projectId` SHALL be ignored for resolution (the server owns identity). When no `taskId` is provided, the title SHALL be resolved to a `taskId` server-side (see REQ-142); an empty or omitted title SHALL create an untitled running entry (`taskId = null`). On success the created `TimeEntry` SHALL be returned as a `TimeEntryDto` with timestamps serialized as strings.

The same endpoint SHALL also support manual entry creation: the request MAY include an explicit `startedAt`/`stoppedAt` pair (both ISO 8601 instants; providing only one of the two SHALL be rejected). When the pair is provided, the system SHALL create an already-stopped entry with the given timestamps, subject to `startedAt <= stoppedAt` and `startedAt` not in the future (beyond a small clock-skew tolerance). Manual creation SHALL NOT affect any currently running entry (no stop-on-new-start), and task binding (`taskId` or title resolution) SHALL apply unchanged.

#### Scenario: Start with a title and project
- **WHEN** an authenticated user posts a start request with a non-empty title and an owned `projectId`
- **THEN** the system SHALL create a running entry (`stoppedAt` null) bound to the resolved task and return the `TimeEntryDto`

#### Scenario: Start bound to an explicit taskId
- **WHEN** an authenticated user posts a start request with a `taskId` identifying one of their own tasks
- **THEN** the system SHALL bind the running entry directly to that task (with its project and remote reference) and return the `TimeEntryDto`

#### Scenario: Start with a foreign or unknown taskId
- **WHEN** a start request provides a `taskId` owned by another user or that does not exist
- **THEN** the system SHALL respond with HTTP 404 without revealing existence

#### Scenario: Start untitled
- **WHEN** an authenticated user posts a start request with no title and no taskId
- **THEN** the system SHALL create a running entry with `taskId` `null` and return it

#### Scenario: Invalid project value rejected
- **WHEN** the start request provides a non-null `projectId` that is not a valid uuid
- **THEN** the system SHALL reject the request with `{ messageKey, params }`

#### Scenario: Manual entry created stopped
- **WHEN** an authenticated user posts a request with a valid `startedAt`/`stoppedAt` pair and an optional title
- **THEN** the system SHALL create a stopped entry with those timestamps, bound per the title-resolution rules, and return the `TimeEntryDto`

#### Scenario: Manual creation does not stop the running timer
- **WHEN** a user with a running entry creates a manual entry with an explicit `startedAt`/`stoppedAt` pair
- **THEN** the running entry SHALL remain running and the manual entry SHALL be created as stopped

#### Scenario: Manual pair incomplete or inverted rejected
- **WHEN** the request provides only one of `startedAt`/`stoppedAt`, or `stoppedAt` earlier than `startedAt`, or a `startedAt` in the future
- **THEN** the system SHALL reject the request with `{ messageKey, params }`

### Requirement: REQ-143 Stop or retitle a running entry
The system SHALL allow an authenticated user to stop, retitle, and/or edit the timestamps of their own entry via `PATCH /api/time-entries/[id]`, addressed by its `uuidv7` `id` and scoped by `userId`. Setting `stoppedAt` (or requesting a stop) SHALL mark the entry as stopped. The request MAY include `startedAt` (ISO 8601 instant) to move the entry's start. Validation SHALL apply to the entry's effective post-patch state: `stoppedAt` SHALL be greater than or equal to `startedAt` for a stopped entry, and for an entry that remains running, `startedAt` SHALL NOT be in the future (beyond a small clock-skew tolerance). Overlap with the user's other entries SHALL be permitted. The request MAY include an optional `taskId`: when provided, it SHALL identify a task owned by the authenticated user (foreign or unknown resolves to HTTP 404) and the entry SHALL bind directly to that task, taking precedence over `title`/`projectId` resolution. When no `taskId` is provided, a provided `title` (with optional `projectId`) SHALL be re-resolved to a `taskId` using the same matching rules as REQ-142. The presence of the `projectId` field SHALL be significant when the task is re-resolved by title: **omitting** `projectId` SHALL preserve the entry's current project scope (the project of its current task, or project-less when it has none), while an explicit **`null`** SHALL resolve the entry into the project-less scope. The system SHALL NOT treat an absent `projectId` as an implicit `null`, so a title-only edit SHALL NOT re-home the entry into the no-project scope. A foreign or unknown entry id SHALL resolve to HTTP 404 without confirming existence. On success the updated `TimeEntryDto` SHALL be returned.

#### Scenario: Stop the running entry
- **WHEN** an authenticated user patches their running entry with a stop request
- **THEN** the system SHALL set `stoppedAt` and return the stopped `TimeEntryDto`

#### Scenario: Retitle re-resolves the task
- **WHEN** an authenticated user patches an entry's title to a different value
- **THEN** the system SHALL re-resolve the title to a task and bind the entry to it

#### Scenario: Patch binds to an explicit taskId
- **WHEN** an authenticated user patches an entry with a `taskId` identifying one of their own tasks
- **THEN** the system SHALL bind the entry directly to that task and return the updated `TimeEntryDto`

#### Scenario: Title-only edit preserves the current project scope
- **WHEN** an authenticated user patches an entry's `title` without including a `projectId` field, and the entry's current task belongs to a project
- **THEN** the system SHALL re-resolve the title within that same project scope and the entry SHALL keep its project association rather than moving to the no-project scope

#### Scenario: Explicit null moves the entry to the project-less scope
- **WHEN** an authenticated user patches an entry's `title` with an explicit `projectId` of `null`
- **THEN** the system SHALL resolve the title within the project-less scope and bind the entry to a project-less task

#### Scenario: Edit the start of a stopped entry
- **WHEN** an authenticated user patches a stopped entry's `startedAt` to an instant at or before its `stoppedAt`
- **THEN** the system SHALL update `startedAt` and return the updated `TimeEntryDto`

#### Scenario: Edit the start of the running entry
- **WHEN** an authenticated user patches their running entry's `startedAt` to a past instant
- **THEN** the system SHALL update `startedAt`, the entry SHALL remain running, and elapsed time SHALL derive from the new start

#### Scenario: Future start on a running entry rejected
- **WHEN** a patch would set a running entry's `startedAt` to a future instant (beyond clock-skew tolerance)
- **THEN** the system SHALL reject the request with `{ messageKey, params }`

#### Scenario: Start after stop rejected
- **WHEN** a patch would result in `startedAt` later than the entry's effective `stoppedAt`
- **THEN** the system SHALL reject the request with `{ messageKey, params }`

#### Scenario: Stop time before start rejected
- **WHEN** a patch would set `stoppedAt` earlier than the entry's effective `startedAt`
- **THEN** the system SHALL reject the request with `{ messageKey, params }`

#### Scenario: Overlapping entries permitted
- **WHEN** a patch moves an entry's `startedAt` so it overlaps another of the user's entries
- **THEN** the system SHALL accept the change without any overlap error

#### Scenario: Foreign or unknown entry id
- **WHEN** an authenticated user patches an entry id owned by another user or that does not exist
- **THEN** the system SHALL respond with HTTP 404 without revealing existence

### Requirement: REQ-153 Mini task editor on the timer view
Each task group on the timer view SHALL allow inline (in-place) editing of the task, replacing any modal editor: the task name and the project SHALL each be editable directly in the group header.

Committing an inline group edit SHALL be **day-scoped**: it SHALL reassign only that day's entries of the group to the find-or-create target task via the day-scoped reassignment operation (REQ-179), passing the group's entry ids for that day. It SHALL NOT rename or re-project the underlying task globally via `PATCH /api/tasks/[id]`, so the same task's entries on other days SHALL be unaffected. When the group is the task's only day, the edit still goes through the day-scoped reassignment (move-only), which MAY leave the source task garbage-collected.

The group title SHALL be an activatable control that swaps to a text input; the edit SHALL be committed on blur or Enter and cancelled on Escape. A committed name that is empty or whitespace-only SHALL silently revert to the previous name without sending a request (a task cannot be unnamed).

The project/client context SHALL be an activatable control that swaps to a project select with a clear option; when the task has no project, the group SHALL render a localized "(no project)" placeholder that is equally activatable. The select SHALL include the task's current project as an option even when that project has been soft-deleted. Committing a selection (including clearing) SHALL reassign that day's entries per REQ-179; dismissing without selection SHALL change nothing.

Inline editing SHALL be single-click and exclusive: at most one inline editor (group title or group project, across all groups and days) SHALL be active at a time. Activating an editor SHALL cancel any other active inline editor — reverting its control to the read-only display without committing — and SHALL immediately make the new editor ready for input: the swapped-in text input SHALL receive focus, and the swapped-in project select SHALL open its option list, so no second click is required.

On success the page SHALL update the affected groups (including regrouping when entries move between tasks) and refresh the running-timer state. The "(no task)" group SHALL NOT offer title or project editing (it has no task).

#### Scenario: Inline rename is day-scoped
- **WHEN** the user activates the group title, types a new name, and commits (blur or Enter)
- **THEN** only that day's entries SHALL move to the find-or-create target task via the day-scoped reassignment, and the same task's entries on other days SHALL keep the old name

#### Scenario: Rename onto an existing task merges that day's entries
- **WHEN** the user renames a day's group so it matches another existing task
- **THEN** that day's entries SHALL move into the existing task's group and the page SHALL show them under the survivor for that day

#### Scenario: Empty name silently reverts
- **WHEN** the user commits an empty or whitespace-only name in the inline title editor
- **THEN** the title SHALL revert to the previous name and no request SHALL be sent

#### Scenario: Escape cancels the inline edit
- **WHEN** the user presses Escape while editing the group title or choosing a project
- **THEN** the edit SHALL be discarded and no request SHALL be sent

#### Scenario: Project changed inline is day-scoped
- **WHEN** the user activates the group's project context and selects a different project (or clears it)
- **THEN** only that day's entries SHALL be reassigned to the target task in the chosen project scope and the group SHALL show the updated context for that day

#### Scenario: Missing project shows a clickable placeholder
- **WHEN** a task group has no project assigned
- **THEN** the group SHALL render a localized "(no project)" placeholder that the user can activate to assign a project inline

#### Scenario: Project editor opens on a single click
- **WHEN** the user activates the group's project context (or the "(no project)" placeholder)
- **THEN** the project select SHALL render with its option list already open, without requiring a second click

#### Scenario: Activating one editor cancels another
- **WHEN** an inline editor is active in one group and the user activates a title or project editor elsewhere (in the same or a different group)
- **THEN** the previously active editor SHALL close without committing, its control SHALL return to the read-only display, and the newly opened editor SHALL receive focus

#### Scenario: Soft-deleted project retained in the select
- **WHEN** the task's current project has been soft-deleted
- **THEN** the project select SHALL still list it as the current option

#### Scenario: No task group is not editable
- **WHEN** the "(no task)" group is rendered
- **THEN** it SHALL NOT offer inline title or project editing
