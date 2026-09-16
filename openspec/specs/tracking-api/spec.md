# tracking-api Specification

## Purpose
Define the HTTP contract for time entries: starting a live timer or creating a manual entry, the single-running-entry invariant, title-to-task resolution within project scope, stop/retitle/timestamp edits, reading the running entry, derived durations, the instant-range list and the timer-view feed, bulk assignment of untitled entries, deletion with task garbage collection, and day-scoped reassignment of entries to a task. All endpoints follow `core-api-conventions` (authentication, CSRF, the translated error contract, strict per-user isolation, boundary validation). The top-bar widget and the timer view page that drive these endpoints are specified in `tracking-timer-widget` and `tracking-timer-view`.

## Requirements


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


### Requirement: REQ-141 At most one running entry per user
The system SHALL guarantee that an authenticated user has at most one running `TimeEntry` (`stoppedAt IS NULL`) at any time, enforced by a partial unique index on `(userId) WHERE stoppedAt IS NULL`. When a user starts a new timer while another entry is running, the system SHALL first stop the currently running entry (setting its `stoppedAt` to the new entry's `startedAt`) and then create the new running entry, within a single transaction (Toggl stop-on-new-start behavior).

#### Scenario: Starting a new timer stops the running one
- **WHEN** an authenticated user with a running entry starts a new timer
- **THEN** the previously running entry SHALL be stopped and exactly one running entry (the new one) SHALL remain

#### Scenario: Concurrent starts do not create two running entries
- **WHEN** an authenticated user issues two start requests concurrently
- **THEN** the partial unique index SHALL prevent two running entries and the system SHALL end with exactly one running entry


### Requirement: REQ-142 Title binds an entry to a Task
The system SHALL treat a time entry's title as the name of the `Task` it points to; a `TimeEntry` SHALL carry no title column of its own. When a title is provided, the system SHALL resolve it to a `Task` within one transaction using the matching key `(userId, name, projectId, remoteIssueId)`, where `projectId = NULL` is a distinct scope and `remoteIssueId = NULL` means unlinked. When the caller supplies no remote issue, resolution SHALL consider all tasks matching `(userId, name, projectId)` and SHALL apply the most-recently-used tie-break of REQ-137, creating a new **unlinked** `Task` only when no candidate exists. When the caller supplies an explicit remote issue (REQ-179), resolution SHALL find-or-create against the full four-part key. When an **existing** entry that already has a task is retitled via PATCH without a `taskId` (REQ-143), resolution SHALL likewise use the full four-part key, taking that task's current `remoteIssueId` (null meaning unlinked) rather than the bare-title tie-break. A new entry started or created with a bare title SHALL still use the tie-break. A project-less title that matches an existing project-less task SHALL silently bind to it. An empty, whitespace-only, or omitted title SHALL leave `taskId` `null`.

#### Scenario: New title creates a task
- **WHEN** a title with no matching task in the target project scope is provided on a **new** entry (start or manual create) with no remote issue
- **THEN** the system SHALL create a new unlinked task in that scope and bind the entry to it

#### Scenario: Existing title matches a task
- **WHEN** a title matches exactly one existing task in the target project scope
- **THEN** the system SHALL bind the entry to that existing task without creating a new one

#### Scenario: Ambiguous title binds to the most recently used task
- **WHEN** a title matches several tasks in the target project scope differing only by remote issue
- **THEN** the entry SHALL bind to the most recently used of them and no new task SHALL be created

#### Scenario: Project-less silent match
- **WHEN** a title with no project matches an existing project-less task of the user
- **THEN** the entry SHALL silently bind to that project-less task

#### Scenario: Empty title leaves the entry untitled
- **WHEN** the title is empty or whitespace-only
- **THEN** the entry SHALL have `taskId` `null` and be shown as "(no task)"

#### Scenario: Retitle of a tasked entry uses the four-part key
- **WHEN** an existing entry that has a task is patched with a new title and no `taskId`
- **THEN** resolution SHALL find-or-create `(userId, name, projectId, remoteIssueId)` using the current task's remote issue and SHALL NOT apply the bare-title most-recently-used tie-break


### Requirement: REQ-143 Stop or retitle a running entry
The system SHALL allow an authenticated user to stop, retitle, and/or edit the timestamps of their own entry via `PATCH /api/time-entries/[id]`, addressed by its `uuidv7` `id` and scoped by `userId`. Setting `stoppedAt` (or requesting a stop) SHALL mark the entry as stopped. The request MAY include `startedAt` (ISO 8601 instant) to move the entry's start. Validation SHALL apply to the entry's effective post-patch state: `stoppedAt` SHALL be greater than or equal to `startedAt` for a stopped entry, and for an entry that remains running, `startedAt` SHALL NOT be in the future (beyond a small clock-skew tolerance). Overlap with the user's other entries SHALL be permitted. The request MAY include an optional `taskId`: when provided, it SHALL identify a task owned by the authenticated user (foreign or unknown resolves to HTTP 404) and the entry SHALL bind directly to that task, taking precedence over `title`/`projectId` resolution. When no `taskId` is provided, a provided `title` (with optional `projectId`) SHALL be re-resolved to a `taskId` using the same matching rules as REQ-142. The presence of the `projectId` field SHALL be significant when the task is re-resolved by title: **omitting** `projectId` SHALL preserve the entry's current project scope (the project of its current task, or project-less when it has none), while an explicit **`null`** SHALL resolve the entry into the project-less scope. The system SHALL NOT treat an absent `projectId` as an implicit `null`, so a title-only edit SHALL NOT re-home the entry into the no-project scope. When the entry currently has a task and no `taskId` is provided, title re-resolution SHALL also preserve that task's current remote issue (including `remoteIssueId` null for an unlinked task): the system SHALL find-or-create against `(userId, effectiveName, effectiveProjectId, currentRemoteIssueId)` and SHALL NOT create a new unlinked task merely because the PATCH body omitted a remote-issue field. The PATCH body SHALL NOT be required to include a remote issue field for this keep. When the entry is untitled (`taskId` null), there is no current remote issue to keep and bare-title resolution (REQ-142) SHALL apply. A foreign or unknown entry id SHALL resolve to HTTP 404 without confirming existence. On success the updated `TimeEntryDto` SHALL be returned.

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

#### Scenario: Title-only edit preserves the current remote issue
- **WHEN** an authenticated user patches an entry's `title` without a `taskId`, and the entry's current task is linked to a remote issue
- **THEN** the system SHALL find-or-create the task of the new name in the current project scope with that same remote issue, and the updated entry SHALL still expose that remote issue reference

#### Scenario: Title-only edit of an unlinked task stays unlinked
- **WHEN** an authenticated user patches an entry's `title` without a `taskId`, and the entry's current task has no remote issue
- **THEN** the system SHALL resolve to the unlinked task of the new name in the current project scope and SHALL NOT bind the entry to a different remote-issue twin of that name

#### Scenario: Title-only edit does not steal a different remote issue via tie-break
- **WHEN** an authenticated user patches a linked entry's `title` to a name that already exists in the same project on a task with a **different** remote issue
- **THEN** the entry SHALL move to a find-or-create task carrying the **source** remote issue and SHALL NOT bind to the differently linked task

#### Scenario: Sibling entries keep the original task
- **WHEN** an authenticated user patches one entry's title in a group that has other entries on the same linked task
- **THEN** only the patched entry SHALL move, and the remaining entries SHALL keep the original task and remote issue

#### Scenario: Untitled entry titled without a remote issue stays on the bare-title path
- **WHEN** an authenticated user patches an untitled entry (`taskId` null) with a title and no `taskId`
- **THEN** the system SHALL resolve the title with no current remote issue to keep (REQ-142) and SHALL NOT invent a remote issue

#### Scenario: Running free-form retitle preserves the remote issue
- **WHEN** the user commits a free-form new title on the running top-bar widget (title-only PATCH, no `taskId`)
- **THEN** the running entry SHALL keep its current project and remote issue on the re-resolved task

#### Scenario: Explicit null moves the entry to the project-less scope
- **WHEN** an authenticated user patches an entry's `title` with an explicit `projectId` of `null`
- **THEN** the system SHALL resolve the title within the project-less scope and bind the entry to a project-less task

#### Scenario: Project-less move of a linked entry keeps the remote issue
- **WHEN** an authenticated user patches a linked entry's `title` with an explicit `projectId` of `null` and no `taskId`
- **THEN** the target SHALL be the project-less task of that name carrying the source remote issue

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


### Requirement: REQ-144 Read the running entry
The system SHALL expose the authenticated user's current running entry via `GET /api/time-entries/running`, returning the single running `TimeEntryDto` (`stoppedAt` null) or `null` when none is running. The response SHALL be scoped strictly to the authenticated user.

#### Scenario: Running entry returned
- **WHEN** an authenticated user with a running entry requests the running endpoint
- **THEN** the system SHALL return that entry's `TimeEntryDto`

#### Scenario: No running entry
- **WHEN** an authenticated user with no running entry requests the running endpoint
- **THEN** the system SHALL return `null`


### Requirement: REQ-145 Duration derived from timestamps
The system SHALL always derive a time entry's duration from `stoppedAt − startedAt`; a running entry's elapsed time SHALL be computed against the current time. The system SHALL NOT store a separate duration column.

#### Scenario: Duration is computed, not stored
- **WHEN** a stopped entry is displayed
- **THEN** its duration SHALL be computed as `stoppedAt − startedAt` rather than read from a stored duration field


### Requirement: REQ-148 List time entries by instant range
The system SHALL expose the authenticated user's time entries via `GET /api/time-entries` with required `from` and `to` query parameters (ISO 8601 instants). The response SHALL be a flat array of `TimeEntryDto` (including `taskId`, `taskName`, `projectId`, `projectName`, with parent names resolved via LEFT joins that do NOT filter on the parent's `deletedAt`) for entries whose `startedAt` falls within `[from, to)`, ordered by `startedAt` descending, scoped strictly to the authenticated user. The DTO SHALL NOT include `clientName` or any tracker display name for timer listing. A running entry (`stoppedAt` null) whose `startedAt` is in range SHALL be included. Invalid or missing `from`/`to`, or `from >= to`, SHALL be rejected with `{ messageKey, params }`. The server SHALL perform no timezone or day-boundary logic; callers convert their local day boundaries to instants.

#### Scenario: Entries in range returned newest first
- **WHEN** an authenticated user requests entries with a valid `from`/`to` window
- **THEN** the system SHALL return only their entries with `startedAt` in `[from, to)`, ordered by `startedAt` descending, each with task/project context and without a client name field

#### Scenario: Running entry included
- **WHEN** the user has a running entry whose `startedAt` is within the requested window
- **THEN** the response SHALL include it with `stoppedAt` `null`

#### Scenario: Invalid range rejected
- **WHEN** `from` or `to` is missing or not a valid instant, or `from` is not before `to`
- **THEN** the system SHALL reject the request with `{ messageKey, params }`

#### Scenario: Other users' entries never returned
- **WHEN** another user has entries within the requested window
- **THEN** those entries SHALL NOT appear in the response


### Requirement: REQ-149 Bulk-assign untitled entries to a task
The system SHALL allow an authenticated user to assign a set of their untitled time entries to a task in one atomic operation via `POST /api/time-entries/bulk-assign`, accepting `{ ids, title, projectId? }` where `ids` is a non-empty array of entry uuids, `title` is trimmed, non-empty, and length-bounded, and `projectId` is optional. Within a single transaction the system SHALL resolve the title to a `taskId` exactly once using the REQ-142 matching rules and set that `taskId` on every listed entry. Every listed entry MUST belong to the authenticated user and MUST currently be untitled (`taskId IS NULL`); otherwise the whole request SHALL fail with `{ messageKey, params }` (or HTTP 404 for foreign/unknown ids) and no entry SHALL be modified. On success the updated `TimeEntryDto`s SHALL be returned.

#### Scenario: Successful bulk assign
- **WHEN** an authenticated user submits their own untitled entry ids with a valid title
- **THEN** the system SHALL resolve the title to a task once and bind all listed entries to it in a single transaction, returning the updated entries

#### Scenario: Atomic failure leaves entries untouched
- **WHEN** any listed id is foreign, unknown, or references an entry that already has a task
- **THEN** the system SHALL reject the whole request and none of the listed entries SHALL be modified

#### Scenario: Empty title rejected
- **WHEN** the submitted title is empty or whitespace-only, or `ids` is empty
- **THEN** the system SHALL reject the request with `{ messageKey, params }`


### Requirement: REQ-264 Timer view feed API
The system SHALL expose an authenticated timer-view feed at `GET /api/time-entries/feed` that returns a page of the caller's time entries together with pagination metadata. The response SHALL be a DTO of the form `{ entries: TimeEntryDto[], hasMore: boolean, nextBefore: string | null }` where each `TimeEntryDto` matches the list shape of REQ-148 (task/project context, optional remote issue ref, ISO timestamps, no client/tracker display name), `hasMore` is true when at least one of the user's entries belongs to a local calendar day strictly older than the oldest day represented in `entries`, and `nextBefore` is an opaque-or-ISO cursor the client MUST pass to load the next page (or `null` when `hasMore` is false).

Day boundaries for the feed SHALL be computed in the **feed timezone**: the authenticated user's stored `timezone` when present, otherwise `UTC` (matching the SSR-safe effective timezone of REQ-165). The feed endpoint SHALL follow `core-api-conventions` for authentication and errors.

**Initial page** (no `before` query parameter):
1. If the user has no time entries at all, the response SHALL be `{ entries: [], hasMore: false, nextBefore: null }`.
2. Otherwise the server SHALL collect every entry of the user whose local day (from `startedAt` in the feed timezone) falls within the inclusive rolling window of the most recent **30** local calendar days ending on "today" in that timezone.
3. If that 30-day window yields zero entries while older entries exist, the server SHALL instead return **all** entries whose local day equals the local day of the user's newest entry (`max(startedAt)`), i.e. a single newest activity day.
4. `hasMore` / `nextBefore` SHALL reflect whether any entry exists on a strictly older local day than the oldest day in the returned set.

**Subsequent page** (`before` required): the server SHALL return all entries belonging to the next **7** distinct local activity days (days with ≥1 entry) strictly older than the cursor, ordered newest day first within the page, and SHALL set `hasMore` / `nextBefore` from whether any older activity day remains. A missing, malformed, or foreign cursor SHALL be rejected with `{ messageKey, params }` (or equivalent 422 contract). Empty calendar gaps between activity days SHALL NOT consume a slot in the "7 days" budget.

The existing range list (REQ-148) MAY remain for non-feed callers; the timer view page SHALL use the feed for its initial and load-more loads.

#### Scenario: Initial feed returns last 30 days of work
- **WHEN** an authenticated user with entries in the last 30 local days requests the feed without `before`
- **THEN** the system SHALL return those entries, `hasMore` true only if older activity days exist, and a usable `nextBefore` when `hasMore` is true

#### Scenario: Empty 30-day window falls back to newest activity day
- **WHEN** the user has no entries in the last 30 local days but has at least one older entry
- **THEN** the initial feed SHALL return all entries from the single local day of the newest entry and SHALL NOT return an empty list

#### Scenario: Never tracked returns empty feed
- **WHEN** the user has no time entries
- **THEN** the initial feed SHALL return empty `entries`, `hasMore` false, and `nextBefore` null

#### Scenario: Load more returns seven activity days
- **WHEN** the client requests the feed with a valid `before` cursor after a page that left older activity days
- **THEN** the system SHALL return entries for up to seven older distinct local days with entries, skipping empty calendar gaps, and set `hasMore` false when no older activity day remains

#### Scenario: Load more with no older history
- **WHEN** the client requests the next page but no older activity days exist
- **THEN** the system SHALL return empty `entries` (or an equivalent no-op page) with `hasMore` false

#### Scenario: Feed uses stored timezone then UTC
- **WHEN** the user has a stored timezone `Europe/Warsaw`
- **THEN** day windows and activity-day counts SHALL use that timezone; when timezone is null the feed SHALL use `UTC`

#### Scenario: Other users never included
- **WHEN** another user has entries that would fall in the window
- **THEN** those entries SHALL NOT appear in the feed

#### Scenario: Unauthenticated rejected
- **WHEN** an unauthenticated client requests the feed
- **THEN** the system SHALL reject the request per shared authentication conventions


### Requirement: REQ-151 Delete a time entry with task garbage collection
The system SHALL allow an authenticated user to delete their own `TimeEntry` via `DELETE /api/time-entries/[id]`, addressed by its `uuidv7` `id` and scoped by `userId`. Within a single transaction the system SHALL delete the entry and, when the entry's `taskId` was non-null and no other time entry references that task afterwards, SHALL hard-delete the emptied `Task` (garbage collection). A foreign or unknown entry id SHALL resolve to HTTP 404 without confirming existence. On success the system SHALL respond with a success status and no entry data.

#### Scenario: Delete an entry
- **WHEN** an authenticated user deletes their own time entry that shares its task with other entries
- **THEN** the entry SHALL be deleted and the task SHALL remain

#### Scenario: Deleting the task's last entry garbage-collects the task
- **WHEN** an authenticated user deletes an entry that is the only entry referencing its task
- **THEN** the entry and the task SHALL both be hard-deleted in one transaction

#### Scenario: Deleting an untitled entry
- **WHEN** an authenticated user deletes an entry with `taskId` `null`
- **THEN** the entry SHALL be deleted and no task SHALL be affected

#### Scenario: Foreign or unknown entry id
- **WHEN** an authenticated user deletes an entry id owned by another user or that does not exist
- **THEN** the system SHALL respond with HTTP 404 without revealing existence


### Requirement: REQ-179 Day-scoped reassignment of time entries to a task
The system SHALL allow an authenticated user to move a set of their time entries to a target task in one atomic operation via `POST /api/time-entries/reassign`, accepting `{ ids, name?, projectId?, remoteIssueId? }` where `ids` is a non-empty array of entry uuids and `name` is trimmed and length-bounded. This powers the timer view's day-scoped group edits: the client sends exactly the entry ids of one day's task group so that only that day's entries move, while the same task's entries on other days are unaffected.

Within a single transaction the system SHALL determine the effective target scope from the listed entries' current task. When `projectId` is omitted, the target scope's project SHALL be the source task's current `projectId`; an explicit `null` SHALL target the project-less scope; a uuid SHALL target that owned, non-deleted project. The presence of `remoteIssueId` SHALL be equally significant: **omitting** it SHALL keep the source task's current remote issue, an explicit **`null`** SHALL target the unlinked task, and a **value** SHALL target the task carrying that remote issue. When a `remoteIssueId` value is supplied, the system SHALL derive the tracker provenance server-side from the target project's active tracker (rejecting a project-less target, a local project, a missing or inactive tracker, or an unsupported `systemType` with `{ messageKey, params }`), and SHALL NOT trust client-supplied tracker identity. The cached issue title MAY be accepted from the client search result for display caching and is not used as ownership or tracker provenance.

The system SHALL resolve `(userId, effectiveName, effectiveProjectId, effectiveRemoteIssueId)` to a `taskId` exactly once using the REQ-142 matching rules (find-or-create), set that `taskId` on every listed entry, and then garbage-collect the source task if it is left with zero entries (hard delete, mirroring REQ-151). When `name` is omitted the entries keep their current task name. This operation is the only way a set of entries changes its remote issue, replacing the removed task-global link and unlink endpoints (REQ-105).

Every listed entry MUST belong to the authenticated user; otherwise the whole request SHALL fail (HTTP 404 for foreign/unknown ids, or `{ messageKey, params }` for validation errors) and no entry SHALL be modified. On success the updated `TimeEntryDto`s SHALL be returned.

#### Scenario: Rename only the current day's entries
- **WHEN** a task is used on several days and the user reassigns just one day's entry ids with a new `name`
- **THEN** only those entries SHALL move to the find-or-create target task and the task's entries on other days SHALL remain on the original task

#### Scenario: Source task garbage-collected when emptied
- **WHEN** a reassignment moves the source task's last remaining entries away
- **THEN** the emptied source task SHALL be hard-deleted in the same transaction

#### Scenario: Reassign keeps the source project and remote issue by default
- **WHEN** the user reassigns entries with a new `name` and omits both `projectId` and `remoteIssueId`
- **THEN** the target task SHALL be resolved within the source task's current project scope and with its current remote issue

#### Scenario: Link rejected for local project
- **WHEN** the user supplies a `remoteIssueId` value for entries whose target project has no active tracker
- **THEN** the system SHALL reject the request with `{ messageKey, params }` and move no entry

#### Scenario: Day-scoped project change
- **WHEN** the user reassigns a day's entries with a `projectId` (or explicit `null`) and no `name`
- **THEN** the entries SHALL move to the find-or-create task of the same name and remote issue in that project scope, leaving other days' entries on the original task

#### Scenario: Day-scoped remote issue link
- **WHEN** the user reassigns a day's entries with a `remoteIssueId` value while the same task has entries on other days
- **THEN** only those entries SHALL move to the find-or-create task carrying that remote issue, with provenance and cached title derived server-side, and the other days' entries SHALL keep the previous remote issue

#### Scenario: Day-scoped remote issue unlink
- **WHEN** the user reassigns a day's entries with an explicit `null` `remoteIssueId`
- **THEN** the entries SHALL move to the find-or-create task of the same name and project with no remote issue, and no remote request SHALL be made

#### Scenario: Two remote issues under one name coexist
- **WHEN** one day's entries are reassigned to remote issue `4711` and another day's entries of the same name and project to `4899`
- **THEN** both target tasks SHALL exist and each day's group SHALL show its own remote issue

#### Scenario: Atomic failure leaves entries untouched
- **WHEN** any listed id is foreign or unknown
- **THEN** the system SHALL reject the whole request with HTTP 404 and none of the listed entries SHALL be modified

