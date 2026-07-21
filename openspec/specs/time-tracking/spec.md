# time-tracking Specification

## Purpose
Define authenticated live time-entry tracking with a single running entry per user, title-to-task resolution within project scope, stop/retitle behavior, server-backed running-entry reads, derived durations, and a persistent shell indicator. All time-entry endpoints follow the shared `api-endpoint-conventions` (authentication, CSRF, the translated error contract, strict per-user isolation, and boundary validation).

## Requirements

### Requirement: REQ-140 Start a live timer
The system SHALL allow an authenticated user to start a live timer via `POST /api/time-entries`, creating a `TimeEntry` scoped to the user with `startedAt` set to the current server time and `stoppedAt` `null` (a running entry). The request MAY include an optional `title` (trimmed, length-bounded) and an optional `projectId`; both MAY be omitted or `null`. The title SHALL be resolved to a `taskId` server-side (see REQ-142); an empty or omitted title SHALL create an untitled running entry (`taskId = null`). On success the created `TimeEntry` SHALL be returned as a `TimeEntryDto` with timestamps serialized as strings.

The same endpoint SHALL also support manual entry creation: the request MAY include an explicit `startedAt`/`stoppedAt` pair (both ISO 8601 instants; providing only one of the two SHALL be rejected). When the pair is provided, the system SHALL create an already-stopped entry with the given timestamps, subject to `startedAt <= stoppedAt` and `startedAt` not in the future (beyond a small clock-skew tolerance). Manual creation SHALL NOT affect any currently running entry (no stop-on-new-start), and title resolution (REQ-142) SHALL apply unchanged.

#### Scenario: Start with a title and project
- **WHEN** an authenticated user posts a start request with a non-empty title and an owned `projectId`
- **THEN** the system SHALL create a running entry (`stoppedAt` null) bound to the resolved task and return the `TimeEntryDto`

#### Scenario: Start untitled
- **WHEN** an authenticated user posts a start request with no title
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
The system SHALL treat a time entry's title as the name of the `Task` it points to; a `TimeEntry` SHALL carry no title column of its own. When a title is provided, the system SHALL resolve it to a `Task` within one transaction using the matching key `(userId, name, projectId)`, where `projectId = NULL` is a distinct scope. If a non-deleted task with that name exists in the given project scope, the entry SHALL bind to it; otherwise a new `Task` SHALL be created in that scope and the entry SHALL bind to it. A project-less title that matches an existing project-less task SHALL silently bind to it. An empty, whitespace-only, or omitted title SHALL leave `taskId` `null`.

#### Scenario: New title creates a task
- **WHEN** a title with no matching task in the target project scope is provided
- **THEN** the system SHALL create a new task in that scope and bind the entry to it

#### Scenario: Existing title matches a task
- **WHEN** a title matches an existing non-deleted task in the target project scope
- **THEN** the system SHALL bind the entry to that existing task without creating a new one

#### Scenario: Project-less silent match
- **WHEN** a title with no project matches an existing project-less task of the user
- **THEN** the entry SHALL silently bind to that project-less task

#### Scenario: Empty title leaves the entry untitled
- **WHEN** the title is empty or whitespace-only
- **THEN** the entry SHALL have `taskId` `null` and be shown as "(no task)"

### Requirement: REQ-143 Stop or retitle a running entry
The system SHALL allow an authenticated user to stop, retitle, and/or edit the timestamps of their own entry via `PATCH /api/time-entries/[id]`, addressed by its `uuidv7` `id` and scoped by `userId`. Setting `stoppedAt` (or requesting a stop) SHALL mark the entry as stopped. The request MAY include `startedAt` (ISO 8601 instant) to move the entry's start. Validation SHALL apply to the entry's effective post-patch state: `stoppedAt` SHALL be greater than or equal to `startedAt` for a stopped entry, and for an entry that remains running, `startedAt` SHALL NOT be in the future (beyond a small clock-skew tolerance). Overlap with the user's other entries SHALL be permitted. A provided `title` (with optional `projectId`) SHALL be re-resolved to a `taskId` using the same matching rules as REQ-142. The presence of the `projectId` field SHALL be significant when the task is re-resolved: **omitting** `projectId` SHALL preserve the entry's current project scope (the project of its current task, or project-less when it has none), while an explicit **`null`** SHALL resolve the entry into the project-less scope. The system SHALL NOT treat an absent `projectId` as an implicit `null`, so a title-only edit SHALL NOT re-home the entry into the no-project scope. A foreign or unknown entry id SHALL resolve to HTTP 404 without confirming existence. On success the updated `TimeEntryDto` SHALL be returned.

#### Scenario: Stop the running entry
- **WHEN** an authenticated user patches their running entry with a stop request
- **THEN** the system SHALL set `stoppedAt` and return the stopped `TimeEntryDto`

#### Scenario: Retitle re-resolves the task
- **WHEN** an authenticated user patches an entry's title to a different value
- **THEN** the system SHALL re-resolve the title to a task and bind the entry to it

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
The system SHALL expose the authenticated user's time entries via `GET /api/time-entries` with required `from` and `to` query parameters (ISO 8601 instants). The response SHALL be a flat array of `TimeEntryDto` (including `taskId`, `taskName`, `projectId`, `projectName`, `clientName`, with parent names resolved via LEFT joins that do NOT filter on the parent's `deletedAt`) for entries whose `startedAt` falls within `[from, to)`, ordered by `startedAt` descending, scoped strictly to the authenticated user. A running entry (`stoppedAt` null) whose `startedAt` is in range SHALL be included. Invalid or missing `from`/`to`, or `from >= to`, SHALL be rejected with `{ messageKey, params }`. The server SHALL perform no timezone or day-boundary logic; callers convert their local day boundaries to instants.

#### Scenario: Entries in range returned newest first
- **WHEN** an authenticated user requests entries with a valid `from`/`to` window
- **THEN** the system SHALL return only their entries with `startedAt` in `[from, to)`, ordered by `startedAt` descending, each with task/project/client context

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

### Requirement: REQ-150 Timer view page
The application SHALL render the timer view as the home page at `/` (replacing the welcome placeholder). The page SHALL display the user's time entries grouped per calendar day using the user's effective timezone (REQ-165, user-settings; day boundaries computed via the timezone-aware utilities of REQ-168) (grouping by each entry's `startedAt`), newest day first. Because the grouping depends on the effective timezone (which may fall back to browser detection), the day/group list (including the empty state) SHALL be rendered client-side only — the server SHALL NOT render day groups, so no hydration mismatch can occur. Each day SHALL show a localized date heading, the day's total duration, and an "add entry" action for creating a manual entry on that day. Within a day, entries SHALL be grouped by task: each task group SHALL show the task name with its project/client context (when present), the group's total duration, and the entry count; expanding a group SHALL list its entries with their start–stop times and derived duration. Untitled entries of a day SHALL collect in a "(no task)" group. The page SHALL initially load the most recent 7 days and provide a "load more" control that extends the window further back by the same step; days without entries SHALL NOT render empty groups. When the user has no entries at all, the page SHALL render a dedicated empty state pointing to the timer widget.

The "add entry" action SHALL open a manual-entry form scoped to that day, accepting an optional title (same task autocomplete as the timer widget), a start time, and an end time entered via the shared smart time input (REQ-131, shared-ui-components; the date is fixed by the day section). The form SHALL convert the entered wall-clock times to instants using the effective timezone (REQ-168) and submit them via `POST /api/time-entries` (REQ-140 manual pair); an end time earlier than the start time SHALL be blocked client-side with an inline error. On success the page SHALL insert the entry into the correct day/task group.

Each listed entry SHALL be editable inline: its start time, stop time (via the shared smart time input, REQ-131), and title SHALL be individually editable, committed on blur or Enter and cancelled on Escape, via `PATCH /api/time-entries/[id]` (REQ-143). Activating one of the row's inline editors SHALL cancel any other editor active in that row without committing, and the swapped-in input SHALL receive focus so editing starts with a single click. Retitling a single entry SHALL re-resolve it to another (or a new) task, leaving the rest of the group unaffected. When an edited `startedAt` moves the entry to a different day in the effective timezone, the page SHALL regroup the entry under that day. Each listed entry SHALL also offer a delete action requiring an explicit confirmation before calling `DELETE /api/time-entries/[id]` (REQ-151); on success the entry SHALL be removed from the page and emptied groups SHALL disappear.

The page SHALL observe the shell's running-timer state: when the running entry stops (including a stop triggered from the top-bar widget or a stop-on-new-start), the page SHALL refresh its entry list so the finished entry appears in its day/task group immediately, without a manual reload.

When the user's timezone or week-start setting changes, the page SHALL regroup and re-render from the already-loaded entries (pure re-render); no data migration or refetch SHALL be required for correctness.

#### Scenario: Entries grouped by effective-timezone day and task
- **WHEN** the authenticated user opens `/` with entries on multiple days
- **THEN** the page SHALL show one section per day in the effective timezone, newest first, each with a day total and per-task groups showing name, context, entry count, and group total

#### Scenario: Day list renders client-side only
- **WHEN** the timer view is served with server-side rendering enabled
- **THEN** the day/group list SHALL be rendered only on the client and the page SHALL produce no hydration mismatch for the grouped content

#### Scenario: Expanding a task group lists its entries
- **WHEN** the user expands a task group
- **THEN** the group SHALL list its individual entries with start/stop times and durations, each with inline edit and delete controls

#### Scenario: Untitled entries form the "(no task)" group
- **WHEN** a day contains entries with `taskId` `null`
- **THEN** those entries SHALL appear in a "(no task)" group for that day

#### Scenario: Load more pages further back
- **WHEN** the user activates the "load more" control
- **THEN** the page SHALL fetch and append the previous window of days below the existing ones

#### Scenario: Empty state
- **WHEN** the user has no time entries in the loaded window and none at all
- **THEN** the page SHALL render an empty state directing the user to start the timer

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
Each task group on the timer view SHALL offer a continue action that starts a new running entry via the existing `POST /api/time-entries`, passing the group's task name as `title` and the group's `projectId`. Stop-on-new-start (REQ-141) and title resolution (REQ-142) SHALL apply unchanged, and the shell's timer widget SHALL reflect the new running entry. The "(no task)" group SHALL NOT offer a continue action; instead it SHALL offer the bulk-assign action (REQ-149) that lets the user pick or type a task title (autocomplete over existing tasks) and assign all of the day's untitled entries at once.

#### Scenario: Continue starts a timer for the task
- **WHEN** the user activates continue on a task group
- **THEN** a new running entry SHALL be started with that task's name and project, stopping any currently running entry first

#### Scenario: Running entry reflected in the shell
- **WHEN** a continue action succeeds
- **THEN** the shell timer widget SHALL show the new running entry's title and live elapsed time

#### Scenario: Bulk assign from the "(no task)" group
- **WHEN** the user activates assign on a day's "(no task)" group and confirms a title
- **THEN** all of that day's untitled entries SHALL be assigned via the bulk-assign endpoint and the page SHALL regroup them under the resolved task

### Requirement: REQ-153 Mini task editor on the timer view
Each task group on the timer view SHALL allow inline (in-place) editing of the task, replacing any modal editor: the task name and the project SHALL each be editable directly in the group header, committed via `PATCH /api/tasks/[id]` (per the task-management capability, including its merge-on-collision behavior).

The group title SHALL be an activatable control that swaps to a text input; the edit SHALL be committed on blur or Enter and cancelled on Escape. A committed name that is empty or whitespace-only SHALL silently revert to the previous name without sending a request (a task cannot be unnamed).

The project/client context SHALL be an activatable control that swaps to a project select with a clear option; when the task has no project, the group SHALL render a localized "(no project)" placeholder that is equally activatable. The select SHALL include the task's current project as an option even when that project has been soft-deleted. Committing a selection (including clearing) SHALL patch the task; dismissing without selection SHALL change nothing.

Inline editing SHALL be single-click and exclusive: at most one inline editor (group title or group project, across all groups and days) SHALL be active at a time. Activating an editor SHALL cancel any other active inline editor — reverting its control to the read-only display without committing — and SHALL immediately make the new editor ready for input: the swapped-in text input SHALL receive focus, and the swapped-in project select SHALL open its option list, so no second click is required.

On success the page SHALL update the affected groups (including regrouping when a merge occurred) and refresh the running-timer state. The "(no task)" group SHALL NOT offer title or project editing (it has no task).

#### Scenario: Inline rename from the group header
- **WHEN** the user activates the group title, types a non-colliding name, and commits (blur or Enter)
- **THEN** the task SHALL be updated via `PATCH /api/tasks/[id]` and the group SHALL show the new name and context

#### Scenario: Rename onto an existing task merges groups
- **WHEN** the user renames or re-projects a task group so it collides with another existing task
- **THEN** the tasks SHALL merge server-side and the page SHALL show a single combined group for the survivor

#### Scenario: Empty name silently reverts
- **WHEN** the user commits an empty or whitespace-only name in the inline title editor
- **THEN** the title SHALL revert to the previous name and no request SHALL be sent

#### Scenario: Escape cancels the inline edit
- **WHEN** the user presses Escape while editing the group title or choosing a project
- **THEN** the edit SHALL be discarded and no request SHALL be sent

#### Scenario: Project changed inline
- **WHEN** the user activates the group's project context and selects a different project (or clears it)
- **THEN** the task SHALL be patched and the group SHALL show the updated project/client context

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