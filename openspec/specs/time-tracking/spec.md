# time-tracking Specification

## Purpose
Define authenticated live time-entry tracking with a single running entry per user, title-to-task resolution within project scope, stop/retitle behavior, server-backed running-entry reads, derived durations, and a persistent shell indicator. All time-entry endpoints follow the shared `api-endpoint-conventions` (authentication, CSRF, the translated error contract, strict per-user isolation, and boundary validation).

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
The system SHALL treat a time entry's title as the name of the `Task` it points to; a `TimeEntry` SHALL carry no title column of its own. When a title is provided, the system SHALL resolve it to a `Task` within one transaction using the matching key `(userId, name, projectId, remoteIssueId)`, where `projectId = NULL` is a distinct scope and `remoteIssueId = NULL` means unlinked. When the caller supplies no remote issue, resolution SHALL consider all tasks matching `(userId, name, projectId)` and SHALL apply the most-recently-used tie-break of REQ-137, creating a new **unlinked** `Task` only when no candidate exists. When the caller supplies an explicit remote issue (REQ-179), resolution SHALL find-or-create against the full four-part key. A project-less title that matches an existing project-less task SHALL silently bind to it. An empty, whitespace-only, or omitted title SHALL leave `taskId` `null`.

#### Scenario: New title creates a task
- **WHEN** a title with no matching task in the target project scope is provided
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

### Requirement: REQ-146 Persistent running-timer indicator
The application shell SHALL display an always-visible running indicator whenever the authenticated user has a running entry, showing the running entry's title and its live-updating elapsed time. The running state SHALL be sourced from the server (`GET /api/time-entries/running`) so it survives page reloads and is consistent across devices.

The timer widget's title input SHALL be bound to the running entry's title (`taskName`) whenever a timer is running (so the title remains visible after starting and after a reload). When the running entry is untitled (`taskName` is `null`), the title input SHALL be shown **blank** — it SHALL NOT show a placeholder and SHALL NOT show a "(no task)" label.

While the initial running-entry fetch is in flight, the widget SHALL expose a `loading` state and SHALL disable the title input and the start/stop toggle until the fetch resolves, then reflect the server result; the widget SHALL NOT allow starting or editing against the pre-fetch idle state.

The running title SHALL be editable in place: an edit SHALL be committed via `PATCH /api/time-entries/[id]` (REQ-143) on blur or on Enter, and SHALL NOT be committed per keystroke. Committing a blank (empty or whitespace-only) title SHALL detach the task by sending `title = null`, resulting in `taskId = null`.

Pressing Enter in the title input SHALL start the timer when the suggestion overlay is closed; when the suggestion overlay is open, Enter SHALL retain the autocomplete's default select/close behavior and SHALL NOT start the timer.

While a timer is running, the elapsed-time display SHALL be an activatable control: activating it SHALL open a popover for editing the running entry's start, containing a date field and a single hours-and-minutes time input, seeded with the entry's current start in the user's effective timezone (REQ-165, user-settings). The time field SHALL be the shared smart time input (REQ-131, shared-ui-components), so a time typed from the keyboard (including compact forms like `900`) SHALL be normalized and accepted rather than reverted. The date field MAY offer a calendar picker, but a manually typed valid `yyyy-mm-dd` date (tolerating unpadded month/day, e.g. `2026-7-9`) SHALL be committed on blur or Enter rather than reverted; text that does not resolve to a valid date SHALL revert to the previous value. Committing SHALL convert the combined date and time from the effective timezone to a UTC instant (REQ-168) and send it as `startedAt` via `PATCH /api/time-entries/[id]` (REQ-143); a resulting instant in the future SHALL be blocked client-side with an inline error. Past dates SHALL be allowed, so the elapsed time MAY legitimately exceed 24 hours. On success the widget SHALL update the running entry from the response and the elapsed ticker SHALL rebase from the new start; dismissing the popover without committing SHALL change nothing.

When a task edit affects the running entry (rename, project change, merge-on-collision, or bulk assignment binding the running entry to a task), the client SHALL re-fetch the running state (`GET /api/time-entries/running`) so the shell indicator reflects the updated title immediately.

The indicator and timer widget SHALL meet WCAG 2.1 AA (labelled controls, keyboard operable, disabled state conveyed) and derive styling from PrimeVue theme tokens; all user-facing strings SHALL exist in `en` and `pl` in parity.

#### Scenario: Indicator visible while running
- **WHEN** the authenticated user has a running entry
- **THEN** the shell SHALL show a running indicator with the entry's title and a live elapsed time

#### Scenario: Title stays visible after starting
- **WHEN** the user starts a timer with a non-empty title
- **THEN** the title input SHALL continue to display that title rather than reverting to a placeholder

#### Scenario: Running state survives reload
- **WHEN** a user with a running entry reloads the app
- **THEN** the shell SHALL re-fetch and display the running entry (including its title) from the server

#### Scenario: Untitled running entry shows blank
- **WHEN** the running entry has no title (`taskName` is `null`)
- **THEN** the title input SHALL be blank, showing neither a placeholder nor a "(no task)" label

#### Scenario: Widget disabled during running fetch
- **WHEN** the initial running-entry fetch is in flight after load
- **THEN** the title input and the toggle button SHALL be disabled until the fetch resolves, after which they SHALL reflect the fetched state

#### Scenario: Inline retitle committed on blur or Enter
- **WHEN** the user edits the running entry's title and blurs the input or presses Enter
- **THEN** the widget SHALL commit the new title via `PATCH /api/time-entries/[id]` and update the displayed running entry from the response

#### Scenario: Clearing the title detaches the task
- **WHEN** the user clears the running entry's title to blank and commits (blur or Enter)
- **THEN** the widget SHALL send `title = null` and the entry SHALL become untitled (`taskId = null`)

#### Scenario: Enter starts the timer when no overlay is open
- **WHEN** the user presses Enter in the title input while no timer is running and the suggestion overlay is closed
- **THEN** the timer SHALL start

#### Scenario: Enter with the overlay open does not start
- **WHEN** the user presses Enter while the suggestion overlay is open
- **THEN** the autocomplete SHALL handle the Enter (select/close) and the timer SHALL NOT start

#### Scenario: Elapsed time opens the start edit popover
- **WHEN** the user activates the elapsed-time control while a timer is running
- **THEN** a popover SHALL open with a date field and a smart hours-and-minutes input seeded with the running entry's current start in the user's effective timezone

#### Scenario: Typed time is normalized in the popover
- **WHEN** the user types a compact time such as `900` into the popover's time field and commits (blur or Enter)
- **THEN** the field SHALL show the normalized `09:00` and the committed start SHALL use that time rather than reverting to the previous value

#### Scenario: Typed date commits in the popover
- **WHEN** the user types a valid date such as `2026-7-9` into the popover's date field and commits (blur or Enter)
- **THEN** the field SHALL accept the date `2026-07-09` rather than reverting to the previous value

#### Scenario: Invalid typed date reverts
- **WHEN** the user types text that does not resolve to a valid date into the popover's date field and blurs it
- **THEN** the field SHALL revert to the previous value and no request SHALL be sent

#### Scenario: Committing a new start rebases the ticker
- **WHEN** the user commits a valid past start date/time in the popover
- **THEN** the running entry SHALL be patched with the new `startedAt` (converted from the effective timezone) and the elapsed time SHALL rebase from it, remaining running

#### Scenario: Future start blocked in the popover
- **WHEN** the popover's combined date and time resolve to a future instant
- **THEN** an inline error SHALL be shown and no request SHALL be sent

#### Scenario: Start moved to a previous day
- **WHEN** the user commits a start on an earlier date
- **THEN** the change SHALL be accepted and the elapsed time MAY display a duration exceeding 24 hours

#### Scenario: Task edit refreshes the indicator
- **WHEN** the user renames or re-projects the task of the running entry (including via a merge or bulk assignment)
- **THEN** the client SHALL re-fetch the running state and the indicator SHALL show the updated title

#### Scenario: Strings localized in parity
- **WHEN** new user-facing timer strings are added
- **THEN** they SHALL exist in both `en.json` and `pl.json` with matching keys

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

### Requirement: REQ-236 Newest entry anchor endpoint

The system SHALL expose the instant of the authenticated user's most recent time entry via `GET /api/time-entries/latest`, returning `{ startedAt }` as an ISO 8601 instant for the entry with the greatest `startedAt`, or `null` when the user has no entries at all. A running entry SHALL be eligible as the newest entry. The query SHALL be scoped strictly to the authenticated user and SHALL be served by a single indexed read (`ORDER BY startedAt DESC LIMIT 1`). The endpoint SHALL take no parameters and SHALL perform no timezone or day-boundary logic, so callers remain responsible for converting the instant to their local week (mirroring REQ-148). The endpoint SHALL follow the shared `api-endpoint-conventions` for authentication and error contract.

#### Scenario: Newest entry instant returned
- **WHEN** an authenticated user with entries requests the endpoint
- **THEN** the system SHALL return the `startedAt` of their entry with the greatest `startedAt` as an ISO 8601 instant

#### Scenario: Running entry is eligible
- **WHEN** the user's most recent entry is still running (`stoppedAt` null)
- **THEN** the system SHALL return that entry's `startedAt`

#### Scenario: User has never tracked anything
- **WHEN** an authenticated user with no time entries requests the endpoint
- **THEN** the system SHALL return `null`

#### Scenario: Other users' entries never considered
- **WHEN** another user has a more recent entry
- **THEN** the response SHALL be derived only from the authenticated user's entries

#### Scenario: Unauthenticated request rejected
- **WHEN** an unauthenticated client requests the endpoint
- **THEN** the system SHALL reject the request per the shared authentication conventions

### Requirement: REQ-150 Timer view page
The application SHALL render the timer view as the home page at `/` (replacing the welcome placeholder). The page SHALL display the user's time entries grouped per calendar day using the user's effective timezone (REQ-165, user-settings; day boundaries computed via the timezone-aware utilities of REQ-168) (grouping by each entry's `startedAt`), newest day first. Because the grouping depends on the effective timezone (which may fall back to browser detection), the day/group list (including the empty state) SHALL be rendered client-side only — the server SHALL NOT render day groups, so no hydration mismatch can occur. Each day SHALL show a localized date heading, the day's total duration, and an "add entry" action for creating a manual entry on that day. Within a day, entries SHALL be grouped by task: each task group SHALL show the task name with its **project** context only when present (no client or tracker secondary label), the group's total duration, and the entry count; expanding a group SHALL list its entries with their start–stop times and derived duration. Untitled entries of a day SHALL collect in a "(no task)" group. Days without entries SHALL NOT render empty groups.

The initial 7-day window SHALL be **anchored on the user's most recent entry** rather than always on the current instant: on first load the page SHALL read the anchor instant via `GET /api/time-entries/latest` (REQ-236) and align its window start to the user's `weekStart` for the week containing that instant, so a user opening the app in a week with no entries yet still sees their latest tracked week instead of an empty page. When the anchor is `null` (the user has never tracked anything) the page SHALL NOT issue an entry-range request for a further window and SHALL render the never-tracked empty state. When the anchor falls inside the current week, the window SHALL be the current week exactly as before. The page SHALL provide a "load more" control that extends the window further back by the same step from the anchored window.

The page SHALL distinguish three states: (a) entries present, (b) **no entries in the loaded window but entries exist elsewhere**, and (c) **no entries at all**. State (c) SHALL render a dedicated empty state pointing to the timer widget. State (b) SHALL render an empty-window state offering "load more". When the anchored window is not the current week, the page SHALL render a localized indication of which week is shown together with a control that returns the window to the current week; activating it SHALL re-align the window to the current week without a full reload.

The "add entry" action SHALL open a manual-entry form scoped to that day, accepting an optional title (same task autocomplete as the timer widget), a start time, and an end time entered via the shared smart time input (REQ-131, shared-ui-components; the date is fixed by the day section). The form SHALL convert the entered wall-clock times to instants using the effective timezone (REQ-168) and submit them via `POST /api/time-entries` (REQ-140 manual pair); an end time earlier than the start time SHALL be blocked client-side with an inline error. On success the page SHALL insert the entry into the correct day/task group.

Each listed entry SHALL be editable inline: its start time, stop time (via the shared smart time input, REQ-131), and title SHALL be individually editable, committed on blur or Enter and cancelled on Escape, via `PATCH /api/time-entries/[id]` (REQ-143). Activating one of the row's inline editors SHALL cancel any other editor active in that row without committing, and the swapped-in input SHALL receive focus so editing starts with a single click. Retitling a single entry SHALL re-resolve it to another (or a new) task, leaving the rest of the group unaffected. When an edited `startedAt` moves the entry to a different day in the effective timezone, the page SHALL regroup the entry under that day. Each listed entry SHALL also offer a delete action requiring an explicit confirmation before calling `DELETE /api/time-entries/[id]` (REQ-151); on success the entry SHALL be removed from the page and emptied groups SHALL disappear.

The page SHALL observe the shell's running-timer state: when the running entry stops (including a stop triggered from the top-bar widget or a stop-on-new-start), the page SHALL refresh its entry list so the finished entry appears in its day/task group immediately, without a manual reload.

When the user's timezone or week-start setting changes, the page SHALL regroup and re-render from the already-loaded entries (pure re-render); no data migration or refetch SHALL be required for correctness. A `weekStart` change SHALL re-align the anchored window without re-fetching the anchor.

#### Scenario: Entries grouped by effective-timezone day and task
- **WHEN** the authenticated user opens `/` with entries on multiple days
- **THEN** the page SHALL show one section per day in the effective timezone, newest first, each with a day total and per-task groups showing name, project context only (when present), entry count, and group total

#### Scenario: Group label omits tracker and client
- **WHEN** a task group belongs to a project that has a tracker
- **THEN** the group label SHALL show the project name only and SHALL NOT append a client or tracker name

#### Scenario: Day list renders client-side only
- **WHEN** the timer view is served with server-side rendering enabled
- **THEN** the day/group list SHALL be rendered only on the client and the page SHALL produce no hydration mismatch for the grouped content

#### Scenario: Fresh week opens on the latest tracked week
- **WHEN** the user opens `/` in a week that contains no entries while earlier entries exist
- **THEN** the initial window SHALL cover the `weekStart`-aligned week containing the newest entry and the page SHALL show that week's entries rather than an empty page

#### Scenario: Anchored week is signposted with a way back
- **WHEN** the initial window was anchored on a week other than the current one
- **THEN** the page SHALL state which week is shown and offer a control that re-aligns the window to the current week

#### Scenario: Current week is used when the newest entry is in it
- **WHEN** the user's newest entry falls within the current `weekStart`-aligned week
- **THEN** the initial window SHALL be the current week and no anchored-week indication SHALL be shown

#### Scenario: Never-tracked user sees a start-tracking empty state
- **WHEN** the user has no time entries at all
- **THEN** the page SHALL render the empty state directing the user to the timer widget and SHALL NOT offer "load more"

#### Scenario: Empty window with entries elsewhere offers load more
- **WHEN** the loaded window contains no entries but the user has entries outside it
- **THEN** the page SHALL render the empty-window state whose action extends the window further back

#### Scenario: Expanding a task group lists its entries
- **WHEN** the user expands a task group
- **THEN** the group SHALL list its individual entries with start/stop times and durations, each with inline edit and delete controls

#### Scenario: Untitled entries form the "(no task)" group
- **WHEN** a day contains entries with `taskId` `null`
- **THEN** those entries SHALL appear in a "(no task)" group for that day

#### Scenario: Load more pages further back
- **WHEN** the user activates the "load more" control
- **THEN** the page SHALL fetch and append the previous window of days below the existing ones, measured from the anchored window

#### Scenario: Add a manual entry to a day
- **WHEN** the user activates a day's "add entry" action and submits a valid start/end time pair with an optional title
- **THEN** a stopped entry SHALL be created for that day (times interpreted in the effective timezone) and appear in the matching task group

#### Scenario: Manual form accepts compact typed times
- **WHEN** the user types `900` into the manual form's start-time field and commits
- **THEN** the field SHALL normalize to `09:00` and the form SHALL submit that time

#### Scenario: Manual form blocks inverted times
- **WHEN** the user submits the manual-entry form with an end time earlier than the start time
- **THEN** an inline error SHALL be shown and no request SHALL be sent

#### Scenario: Inline edit of an entry's times
- **WHEN** the user edits an entry's start or stop time inline (including a compact form like `93` normalized to `09:30`) and commits (blur or Enter)
- **THEN** the entry SHALL be patched and the row, group, and day totals SHALL update from the response

#### Scenario: Invalid inline time reverts silently
- **WHEN** the user types a value that cannot be normalized to a valid time (e.g. `59`) into an entry's inline time field and commits
- **THEN** the field SHALL revert to the previous value and no request SHALL be sent

#### Scenario: Inline retitle splits the entry off
- **WHEN** the user retitles a single entry inside an expanded group
- **THEN** the entry SHALL move to the group of the re-resolved task and the remaining entries of the original group SHALL be unaffected

#### Scenario: Cross-midnight edit regroups the entry
- **WHEN** an inline `startedAt` edit moves an entry to a different day in the effective timezone
- **THEN** the page SHALL show the entry under the new day's section

#### Scenario: Top-bar stop refreshes the list
- **WHEN** the user stops the running timer from the top-bar widget while viewing the timer page
- **THEN** the page SHALL refresh its entries and the finished entry SHALL appear in its day/task group without a manual reload

#### Scenario: Delete an entry with confirmation
- **WHEN** the user activates an entry's delete action and confirms
- **THEN** the entry SHALL be deleted, removed from the page, and a group left with no entries SHALL disappear

#### Scenario: Timezone change regroups without refetch
- **WHEN** the user changes their timezone setting while entries are displayed
- **THEN** the page SHALL regroup the loaded entries under the day boundaries of the new timezone without requiring a reload

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

### Requirement: REQ-152 Continue a task from the timer view
Each task group on the timer view SHALL offer a continue action that starts a new running entry via the existing `POST /api/time-entries`. The action SHALL pass the group's **task identity** so the new entry binds to that exact task and therefore **inherits its remote issue reference** as well as its project, rather than re-resolving the name and risking a different task under the most-recently-used tie-break (REQ-137). Stop-on-new-start (REQ-141) SHALL apply unchanged, and the shell's timer widget SHALL reflect the new running entry. The "(no task)" group SHALL NOT offer a continue action; instead it SHALL offer the bulk-assign action (REQ-149) that lets the user pick or type a task title (autocomplete over existing tasks) and assign all of the day's untitled entries at once.

#### Scenario: Continue starts a timer for the task
- **WHEN** the user activates continue on a task group
- **THEN** a new running entry SHALL be started bound to that group's task, stopping any currently running entry first

#### Scenario: Continue inherits the remote issue
- **WHEN** the user continues a task group that is linked to a remote issue
- **THEN** the new running entry SHALL be bound to that same linked task and SHALL show the same remote issue

#### Scenario: Continue is unambiguous under duplicate names
- **WHEN** the continued task shares its name and project with another task carrying a different remote issue
- **THEN** the new entry SHALL bind to the continued task and SHALL NOT be re-resolved to the other one

#### Scenario: Running entry reflected in the shell
- **WHEN** a continue action succeeds
- **THEN** the shell timer widget SHALL show the new running entry's title and live elapsed time

#### Scenario: Bulk assign from the "(no task)" group
- **WHEN** the user activates assign on a day's "(no task)" group and confirms a title
- **THEN** all of that day's untitled entries SHALL be assigned via the bulk-assign endpoint and the page SHALL regroup them under the resolved task

### Requirement: REQ-153 Mini task editor on the timer view
Each task group on the timer view SHALL allow inline (in-place) editing of the task, replacing any modal editor: the task name, the project, and the remote issue SHALL each be editable directly in the group header.

Committing an inline group edit SHALL be **day-scoped**: it SHALL reassign only that day's entries of the group to the find-or-create target task via the day-scoped reassignment operation (REQ-179), passing the group's entry ids for that day. It SHALL NOT rename, re-project, or re-link the underlying task globally, so the same task's entries on other days SHALL be unaffected. This SHALL hold for **every** group-level edit without exception, including the remote issue: the timer view SHALL make no task-global mutation. When the group is the task's only day, the edit still goes through the day-scoped reassignment (move-only), which MAY leave the source task garbage-collected.

The group title SHALL be an activatable control that swaps to a text input; the edit SHALL be committed on blur or Enter and cancelled on Escape. A committed name that is empty or whitespace-only SHALL silently revert to the previous name without sending a request (a task cannot be unnamed).

The project context SHALL be an activatable control that swaps to a project select with a clear option; when the task has no project, the group SHALL render a localized "(no project)" placeholder that is equally activatable. The select SHALL include the task's current project as an option even when that project has been soft-deleted. Committing a selection (including clearing) SHALL reassign that day's entries per REQ-179; dismissing without selection SHALL change nothing. Project options SHALL be labeled by project name only (no client/tracker secondary segment).

The remote issue control (REQ-107) SHALL likewise commit through REQ-179, sending the chosen `remoteIssueId` — or an explicit `null` to unlink — together with that day's entry ids.

Inline editing SHALL be single-click and exclusive: at most one inline editor (group title, group project, or remote issue picker, across all groups and days) SHALL be active at a time. Activating an editor SHALL cancel any other active inline editor — reverting its control to the read-only display without committing — and SHALL immediately make the new editor ready for input: the swapped-in text input SHALL receive focus, and the swapped-in project select SHALL open its option list, so no second click is required.

On success the page SHALL update the affected groups (including regrouping when entries move between tasks) and refresh the running-timer state. The "(no task)" group SHALL NOT offer title, project or remote issue editing (it has no task).

#### Scenario: Inline rename is day-scoped
- **WHEN** the user activates the group title, types a new name, and commits (blur or Enter)
- **THEN** only that day's entries SHALL move to the find-or-create target task via the day-scoped reassignment, and the same task's entries on other days SHALL keep the old name

#### Scenario: Rename onto an existing task merges that day's entries
- **WHEN** the user renames a day's group so it matches another existing task with the same remote issue state
- **THEN** that day's entries SHALL move into the existing task's group and the page SHALL show them under the survivor for that day

#### Scenario: Remote issue change is day-scoped
- **WHEN** the user links, replaces or unlinks the remote issue on a day's group while the same task has entries on other days
- **THEN** only that day's entries SHALL move to the find-or-create target task and the other days' groups SHALL keep their previous remote issue

#### Scenario: No task-global mutation from the timer view
- **WHEN** any group-level edit (title, project, or remote issue) is committed
- **THEN** the request SHALL be the day-scoped reassignment and the page SHALL make no call that mutates a task row directly

#### Scenario: Empty name silently reverts
- **WHEN** the user commits an empty or whitespace-only name in the inline title editor
- **THEN** the title SHALL revert to the previous name and no request SHALL be sent

#### Scenario: Escape cancels the inline edit
- **WHEN** the user presses Escape while editing the group title, choosing a project, or picking a remote issue
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
- **WHEN** an inline editor is active in one group and the user activates a title, project or remote issue editor elsewhere (in the same or a different group)
- **THEN** the previously active editor SHALL close without committing, its control SHALL return to the read-only display, and the newly opened editor SHALL receive focus

#### Scenario: Soft-deleted project retained in the select
- **WHEN** the task's current project has been soft-deleted
- **THEN** the project select SHALL still list it as the current option

#### Scenario: No task group is not editable
- **WHEN** the "(no task)" group is rendered
- **THEN** it SHALL NOT offer inline title, project or remote issue editing

### Requirement: REQ-154 Accessible, localized, tokenized timer view
The timer view SHALL meet WCAG 2.1 AA: day and group structures SHALL use semantic headings/landmarks, expand/collapse controls SHALL be keyboard operable and expose their expanded state, action controls (continue, assign) SHALL be labelled, and the inline editors (group title, group project, entry fields, and the shared smart time inputs) SHALL be activatable buttons or labelled inputs with accessible names, keyboard operable including Escape to cancel, with the project select reachable and operable by keyboard. Interactive controls SHALL NOT be nested inside one another: a group header row that combines an expand/collapse action with inline edit triggers SHALL use a non-interactive layout container with the controls as siblings. The page SHALL prefer existing PrimeVue components — edit triggers and inline editors SHALL use PrimeVue `Button` and `InputText`/`Select` rather than native `<button>`/`<input>` elements — derive styling from theme tokens (no ad-hoc inline colors), format dates and durations via the active locale, and keep all user-facing strings (including the "(no project)" placeholder) in `en` and `pl` in parity. Server/network failures SHALL surface as a Toast translated from the `{ messageKey, params }` contract.

#### Scenario: Group toggle is accessible
- **WHEN** a task group's expand control is rendered
- **THEN** it SHALL be keyboard operable and expose its expanded/collapsed state to assistive technology

#### Scenario: No nested interactive controls in the group header
- **WHEN** a group header renders the expand control together with the inline title/project edit triggers
- **THEN** the controls SHALL be rendered as siblings inside a non-interactive container, with no button or input nested inside another interactive element

#### Scenario: Inline group editors are accessible
- **WHEN** a task group's title and project context are rendered
- **THEN** they SHALL be activatable buttons with accessible names, and the swapped-in input/select SHALL be labelled, keyboard operable, and cancellable with Escape

#### Scenario: Strings localized in parity
- **WHEN** new user-facing timer-view strings are added
- **THEN** they SHALL exist in both `en.json` and `pl.json` with matching keys

#### Scenario: API failure surfaced
- **WHEN** a timer-view action fails with an API error
- **THEN** the client SHALL show a Toast translated from the returned `messageKey`

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

### Requirement: REQ-180 Top-bar suggestion binding, labels, and popover anchoring

The top-bar timer widget's title autocomplete SHALL present each suggestion as a single object-based item resolved from `GET /api/tasks?search=`, using exactly one selection handler; it SHALL NOT nest an independently clickable control inside a menu item nor cast object items to strings. Selecting a suggestion by mouse or keyboard SHALL fire a single selection and SHALL NOT issue duplicate requests nor set a stringified-object (`[object Object]`) title.

Each suggestion label SHALL show the task name with its project/client context when present, and SHALL additionally append the remote issue id (from the task's remote issue reference) when the task has one.

When the user selects an existing suggestion, the widget SHALL capture that task's identity and send it to the server so the started/updated entry binds to that exact task (its project and remote reference), rather than reconstructing project/reference from front-end state. When the user commits a free-form title that matches no suggestion, the widget SHALL fall back to the title-based create path (REQ-142).

The suggestion overlay SHALL additionally offer, whenever the typed text is non-empty, a distinct **create-new-task option** labelled with the typed text and a localized "(new task)" marker, rendered separately from the task suggestions and shown even when one or more suggestions match the typed text exactly. Activating it (by mouse or keyboard) SHALL commit the typed text as a free-form title with **no task binding** — the widget SHALL clear any captured task identity and send `title` only — so the entry resolves through the project-less title path (REQ-142) instead of binding to a matching suggestion. Activating it SHALL close the overlay so a subsequent Enter starts the timer per REQ-146. The option SHALL be keyboard reachable, SHALL expose an accessible name including the typed text, and its strings SHALL exist in `en` and `pl` in parity.

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

#### Scenario: Create option is offered alongside exact matches
- **WHEN** the typed text exactly matches one or more existing task suggestions
- **THEN** the overlay SHALL still offer the create-new-task option labelled with the typed text and a localized "(new task)" marker

#### Scenario: Create option sends the title without a task binding
- **WHEN** the user activates the create-new-task option and starts the timer
- **THEN** the request SHALL carry the typed `title` with no `taskId` and the entry SHALL resolve in the project-less scope per REQ-142

#### Scenario: Create option clears a previously captured suggestion
- **WHEN** the user first selects a suggestion, edits the text, and then activates the create-new-task option
- **THEN** the previously captured task identity SHALL be discarded and SHALL NOT be sent

#### Scenario: Create option is keyboard operable
- **WHEN** the user navigates the overlay with the keyboard to the create-new-task option and activates it
- **THEN** the typed text SHALL be committed as a free-form title, the overlay SHALL close, and a subsequent Enter SHALL start the timer

#### Scenario: No create option for empty text
- **WHEN** the title input is empty or whitespace-only
- **THEN** the overlay SHALL NOT offer a create-new-task option

#### Scenario: Popover anchored to the elapsed control
- **WHEN** the user activates the elapsed-time control to edit the start
- **THEN** the popover SHALL open anchored to that control rather than misaligned to an unrelated element