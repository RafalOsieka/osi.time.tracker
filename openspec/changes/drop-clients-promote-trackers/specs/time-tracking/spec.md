## MODIFIED Requirements

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
