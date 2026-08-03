## MODIFIED Requirements

### Requirement: REQ-179 Day-scoped reassignment of time entries to a task

The system SHALL allow an authenticated user to move a set of their time entries to a target task in one atomic operation via `POST /api/time-entries/reassign`, accepting `{ ids, name?, projectId?, remoteIssueId? }` where `ids` is a non-empty array of entry uuids and `name` is trimmed and length-bounded. This powers the timer view's day-scoped group edits: the client sends exactly the entry ids of one day's task group so that only that day's entries move, while the same task's entries on other days are unaffected.

Within a single transaction the system SHALL determine the effective target scope from the listed entries' current task. When `projectId` is omitted, the target scope's project SHALL be the source task's current `projectId`; an explicit `null` SHALL target the project-less scope; a uuid SHALL target that owned, non-deleted project. The presence of `remoteIssueId` SHALL be equally significant: **omitting** it SHALL keep the source task's current remote issue, an explicit **`null`** SHALL target the unlinked task, and a **value** SHALL target the task carrying that remote issue. When a `remoteIssueId` value is supplied, the system SHALL derive the remote-system configuration provenance and the cached issue title server-side from the target project's client (rejecting a project-less target, a missing or inactive configuration, or an unsupported `systemType` with `{ messageKey, params }`), and SHALL NOT trust client-supplied provenance.

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

#### Scenario: Remote issue on an ineligible target rejected
- **WHEN** a `remoteIssueId` value is supplied while the effective target scope is project-less or its client has no active supported configuration
- **THEN** the system SHALL reject the request with `{ messageKey, params }` and no entry SHALL be modified

#### Scenario: Atomic failure leaves entries untouched
- **WHEN** any listed id is foreign or unknown
- **THEN** the system SHALL reject the whole request with HTTP 404 and none of the listed entries SHALL be modified

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

### Requirement: REQ-153 Mini task editor on the timer view

Each task group on the timer view SHALL allow inline (in-place) editing of the task, replacing any modal editor: the task name, the project, and the remote issue SHALL each be editable directly in the group header.

Committing an inline group edit SHALL be **day-scoped**: it SHALL reassign only that day's entries of the group to the find-or-create target task via the day-scoped reassignment operation (REQ-179), passing the group's entry ids for that day. It SHALL NOT rename, re-project, or re-link the underlying task globally, so the same task's entries on other days SHALL be unaffected. This SHALL hold for **every** group-level edit without exception, including the remote issue: the timer view SHALL make no task-global mutation. When the group is the task's only day, the edit still goes through the day-scoped reassignment (move-only), which MAY leave the source task garbage-collected.

The group title SHALL be an activatable control that swaps to a text input; the edit SHALL be committed on blur or Enter and cancelled on Escape. A committed name that is empty or whitespace-only SHALL silently revert to the previous name without sending a request (a task cannot be unnamed).

The project/client context SHALL be an activatable control that swaps to a project select with a clear option; when the task has no project, the group SHALL render a localized "(no project)" placeholder that is equally activatable. The select SHALL include the task's current project as an option even when that project has been soft-deleted. Committing a selection (including clearing) SHALL reassign that day's entries per REQ-179; dismissing without selection SHALL change nothing.

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
