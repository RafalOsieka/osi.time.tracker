# time-tracking Delta

## ADDED Requirements

### Requirement: REQ-TTR-044 List time entries by instant range
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

### Requirement: REQ-TTR-045 Bulk-assign untitled entries to a task
The system SHALL allow an authenticated user to assign a set of their untitled time entries to a task in one atomic operation via `POST /api/time-entries/bulk-assign`, accepting `{ ids, title, projectId? }` where `ids` is a non-empty array of entry uuids, `title` is trimmed, non-empty, and length-bounded, and `projectId` is optional. Within a single transaction the system SHALL resolve the title to a `taskId` exactly once using the REQ-TTR-038 matching rules and set that `taskId` on every listed entry. Every listed entry MUST belong to the authenticated user and MUST currently be untitled (`taskId IS NULL`); otherwise the whole request SHALL fail with `{ messageKey, params }` (or HTTP 404 for foreign/unknown ids) and no entry SHALL be modified. On success the updated `TimeEntryDto`s SHALL be returned.

#### Scenario: Successful bulk assign
- **WHEN** an authenticated user submits their own untitled entry ids with a valid title
- **THEN** the system SHALL resolve the title to a task once and bind all listed entries to it in a single transaction, returning the updated entries

#### Scenario: Atomic failure leaves entries untouched
- **WHEN** any listed id is foreign, unknown, or references an entry that already has a task
- **THEN** the system SHALL reject the whole request and none of the listed entries SHALL be modified

#### Scenario: Empty title rejected
- **WHEN** the submitted title is empty or whitespace-only, or `ids` is empty
- **THEN** the system SHALL reject the request with `{ messageKey, params }`

### Requirement: REQ-TTR-046 Timer view page
The application SHALL render the timer view as the home page at `/` (replacing the welcome placeholder). The page SHALL display the user's time entries grouped per calendar day using the browser-local timezone (grouping by each entry's `startedAt`), newest day first. Each day SHALL show a localized date heading and the day's total duration. Within a day, entries SHALL be grouped by task: each task group SHALL show the task name with its project/client context (when present), the group's total duration, and the entry count; expanding a group SHALL list its entries read-only (start–stop times and derived duration). Untitled entries of a day SHALL collect in a "(no task)" group. The page SHALL initially load the most recent 7 days and provide a "load more" control that extends the window further back by the same step; days without entries SHALL NOT render empty groups. When the user has no entries at all, the page SHALL render a dedicated empty state pointing to the timer widget.

#### Scenario: Entries grouped by local day and task
- **WHEN** the authenticated user opens `/` with entries on multiple days
- **THEN** the page SHALL show one section per browser-local day, newest first, each with a day total and per-task groups showing name, context, entry count, and group total

#### Scenario: Expanding a task group lists its entries
- **WHEN** the user expands a task group
- **THEN** the group SHALL list its individual entries with start/stop times and durations, without any per-entry edit controls

#### Scenario: Untitled entries form the "(no task)" group
- **WHEN** a day contains entries with `taskId` `null`
- **THEN** those entries SHALL appear in a "(no task)" group for that day

#### Scenario: Load more pages further back
- **WHEN** the user activates the "load more" control
- **THEN** the page SHALL fetch and append the previous window of days below the existing ones

#### Scenario: Empty state
- **WHEN** the user has no time entries in the loaded window and none at all
- **THEN** the page SHALL render an empty state directing the user to start the timer

### Requirement: REQ-TTR-048 Continue a task from the timer view
Each task group on the timer view SHALL offer a continue action that starts a new running entry via the existing `POST /api/time-entries`, passing the group's task name as `title` and the group's `projectId`. Stop-on-new-start (REQ-TTR-037) and title resolution (REQ-TTR-038) SHALL apply unchanged, and the shell's timer widget SHALL reflect the new running entry. The "(no task)" group SHALL NOT offer a continue action; instead it SHALL offer the bulk-assign action (REQ-TTR-045) that lets the user pick or type a task title (autocomplete over existing tasks) and assign all of the day's untitled entries at once.

#### Scenario: Continue starts a timer for the task
- **WHEN** the user activates continue on a task group
- **THEN** a new running entry SHALL be started with that task's name and project, stopping any currently running entry first

#### Scenario: Running entry reflected in the shell
- **WHEN** a continue action succeeds
- **THEN** the shell timer widget SHALL show the new running entry's title and live elapsed time

#### Scenario: Bulk assign from the "(no task)" group
- **WHEN** the user activates assign on a day's "(no task)" group and confirms a title
- **THEN** all of that day's untitled entries SHALL be assigned via the bulk-assign endpoint and the page SHALL regroup them under the resolved task

### Requirement: REQ-TTR-049 Mini task editor on the timer view
Each task group on the timer view SHALL offer a mini task editor allowing the user to rename the task and change or clear its project, committed via `PATCH /api/tasks/[id]` (per the task-management capability, including its merge-on-collision behavior). The editor SHALL validate the name client-side (trimmed, non-empty) before sending, SHALL seed the project select with the task's current project even when that project has been soft-deleted, and on success the page SHALL update the affected groups (including regrouping when a merge occurred).

#### Scenario: Rename from the mini editor
- **WHEN** the user renames a task group to a non-colliding name
- **THEN** the task SHALL be updated and the group SHALL show the new name and context

#### Scenario: Rename onto an existing task merges groups
- **WHEN** the user renames or re-projects a task group so it collides with another existing task
- **THEN** the tasks SHALL merge server-side and the page SHALL show a single combined group for the survivor

#### Scenario: Empty name blocked client-side
- **WHEN** the user submits the mini editor with an empty or whitespace-only name
- **THEN** an inline error SHALL be shown and no request SHALL be sent

### Requirement: REQ-NFR-028 Accessible, localized, tokenized timer view
The timer view SHALL meet WCAG 2.1 AA: day and group structures SHALL use semantic headings/landmarks, expand/collapse controls SHALL be keyboard operable and expose their expanded state, action controls (continue, assign, edit) SHALL be labelled, and the mini editor's fields SHALL be labelled with inline errors exposed via `aria-invalid`/`aria-describedby`. The page SHALL prefer existing PrimeVue components, derive styling from theme tokens (no ad-hoc inline colors), format dates and durations via the active locale, and keep all user-facing strings in `en` and `pl` in parity. Server/network failures SHALL surface as a Toast translated from the `{ messageKey, params }` contract.

#### Scenario: Group toggle is accessible
- **WHEN** a task group's expand control is rendered
- **THEN** it SHALL be keyboard operable and expose its expanded/collapsed state to assistive technology

#### Scenario: Strings localized in parity
- **WHEN** new user-facing timer-view strings are added
- **THEN** they SHALL exist in both `en.json` and `pl.json` with matching keys

#### Scenario: API failure surfaced
- **WHEN** a timer-view action fails with an API error
- **THEN** the client SHALL show a Toast translated from the returned `messageKey`
