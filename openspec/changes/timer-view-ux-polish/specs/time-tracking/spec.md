## MODIFIED Requirements

### Requirement: REQ-NFR-026 Persistent running-timer indicator
The application shell SHALL display an always-visible running indicator whenever the authenticated user has a running entry, showing the running entry's title and its live-updating elapsed time. The running state SHALL be sourced from the server (`GET /api/time-entries/running`) so it survives page reloads and is consistent across devices.

The timer widget's title input SHALL be bound to the running entry's title (`taskName`) whenever a timer is running (so the title remains visible after starting and after a reload). When the running entry is untitled (`taskName` is `null`), the title input SHALL be shown **blank** — it SHALL NOT show a placeholder and SHALL NOT show a "(no task)" label.

While the initial running-entry fetch is in flight, the widget SHALL expose a `loading` state and SHALL disable the title input and the start/stop toggle until the fetch resolves, then reflect the server result; the widget SHALL NOT allow starting or editing against the pre-fetch idle state.

The running title SHALL be editable in place: an edit SHALL be committed via `PATCH /api/time-entries/[id]` (REQ-TTR-039) on blur or on Enter, and SHALL NOT be committed per keystroke. Committing a blank (empty or whitespace-only) title SHALL detach the task by sending `title = null`, resulting in `taskId = null`.

Pressing Enter in the title input SHALL start the timer when the suggestion overlay is closed; when the suggestion overlay is open, Enter SHALL retain the autocomplete's default select/close behavior and SHALL NOT start the timer.

While a timer is running, the elapsed-time display SHALL be an activatable control: activating it SHALL open a popover for editing the running entry's start, containing a date field and a single hours-and-minutes time input, seeded with the entry's current start in the browser-local timezone. The time field SHALL be the shared smart time input (REQ-NFR-034, shared-ui-components), so a time typed from the keyboard (including compact forms like `900`) SHALL be normalized and accepted rather than reverted. The date field MAY offer a calendar picker, but a manually typed valid `yyyy-mm-dd` date (tolerating unpadded month/day, e.g. `2026-7-9`) SHALL be committed on blur or Enter rather than reverted; text that does not resolve to a valid date SHALL revert to the previous value. Committing SHALL send the combined date and time as `startedAt` via `PATCH /api/time-entries/[id]` (REQ-TTR-039); a resulting instant in the future SHALL be blocked client-side with an inline error. Past dates SHALL be allowed, so the elapsed time MAY legitimately exceed 24 hours. On success the widget SHALL update the running entry from the response and the elapsed ticker SHALL rebase from the new start; dismissing the popover without committing SHALL change nothing.

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
- **THEN** a popover SHALL open with a date field and a smart hours-and-minutes input seeded with the running entry's current start in local time

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
- **THEN** the running entry SHALL be patched with the new `startedAt` and the elapsed time SHALL rebase from it, remaining running

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

### Requirement: REQ-TTR-046 Timer view page
The application SHALL render the timer view as the home page at `/` (replacing the welcome placeholder). The page SHALL display the user's time entries grouped per calendar day using the browser-local timezone (grouping by each entry's `startedAt`), newest day first. Because the grouping depends on the browser-local timezone, the day/group list (including the empty state) SHALL be rendered client-side only — the server SHALL NOT render day groups, so no hydration mismatch can occur. Each day SHALL show a localized date heading, the day's total duration, and an "add entry" action for creating a manual entry on that day. Within a day, entries SHALL be grouped by task: each task group SHALL show the task name with its project/client context (when present), the group's total duration, and the entry count; expanding a group SHALL list its entries with their start–stop times and derived duration. Untitled entries of a day SHALL collect in a "(no task)" group. The page SHALL initially load the most recent 7 days and provide a "load more" control that extends the window further back by the same step; days without entries SHALL NOT render empty groups. When the user has no entries at all, the page SHALL render a dedicated empty state pointing to the timer widget.

The "add entry" action SHALL open a manual-entry form scoped to that day, accepting an optional title (same task autocomplete as the timer widget), a start time, and an end time entered via the shared smart time input (REQ-NFR-034, shared-ui-components; the date is fixed by the day section). The form SHALL convert the local times to instants and submit them via `POST /api/time-entries` (REQ-TTR-036 manual pair); an end time earlier than the start time SHALL be blocked client-side with an inline error. On success the page SHALL insert the entry into the correct day/task group.

Each listed entry SHALL be editable inline: its start time, stop time (via the shared smart time input, REQ-NFR-034), and title SHALL be individually editable, committed on blur or Enter and cancelled on Escape, via `PATCH /api/time-entries/[id]` (REQ-TTR-039). Retitling a single entry SHALL re-resolve it to another (or a new) task, leaving the rest of the group unaffected. When an edited `startedAt` moves the entry to a different local day, the page SHALL regroup the entry under that day. Each listed entry SHALL also offer a delete action requiring an explicit confirmation before calling `DELETE /api/time-entries/[id]` (REQ-TTR-050); on success the entry SHALL be removed from the page and emptied groups SHALL disappear.

The page SHALL observe the shell's running-timer state: when the running entry stops (including a stop triggered from the top-bar widget or a stop-on-new-start), the page SHALL refresh its entry list so the finished entry appears in its day/task group immediately, without a manual reload.

#### Scenario: Entries grouped by local day and task
- **WHEN** the authenticated user opens `/` with entries on multiple days
- **THEN** the page SHALL show one section per browser-local day, newest first, each with a day total and per-task groups showing name, context, entry count, and group total

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
- **THEN** a stopped entry SHALL be created for that day and appear in the matching task group

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
- **WHEN** an inline `startedAt` edit moves an entry to a different browser-local day
- **THEN** the page SHALL show the entry under the new day's section

#### Scenario: Top-bar stop refreshes the list
- **WHEN** the user stops the running timer from the top-bar widget while viewing the timer page
- **THEN** the page SHALL refresh its entries and the finished entry SHALL appear in its day/task group without a manual reload

#### Scenario: Delete an entry with confirmation
- **WHEN** the user activates an entry's delete action and confirms
- **THEN** the entry SHALL be deleted, removed from the page, and a group left with no entries SHALL disappear

### Requirement: REQ-TTR-049 Mini task editor on the timer view
Each task group on the timer view SHALL allow inline (in-place) editing of the task, replacing any modal editor: the task name and the project SHALL each be editable directly in the group header, committed via `PATCH /api/tasks/[id]` (per the task-management capability, including its merge-on-collision behavior).

The group title SHALL be an activatable control that swaps to a text input; the edit SHALL be committed on blur or Enter and cancelled on Escape. A committed name that is empty or whitespace-only SHALL silently revert to the previous name without sending a request (a task cannot be unnamed).

The project/client context SHALL be an activatable control that swaps to a project select with a clear option; when the task has no project, the group SHALL render a localized "(no project)" placeholder that is equally activatable. The select SHALL include the task's current project as an option even when that project has been soft-deleted. Committing a selection (including clearing) SHALL patch the task; dismissing without selection SHALL change nothing.

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

#### Scenario: Soft-deleted project retained in the select
- **WHEN** the task's current project has been soft-deleted
- **THEN** the project select SHALL still list it as the current option

#### Scenario: No task group is not editable
- **WHEN** the "(no task)" group is rendered
- **THEN** it SHALL NOT offer inline title or project editing

### Requirement: REQ-NFR-028 Accessible, localized, tokenized timer view
The timer view SHALL meet WCAG 2.1 AA: day and group structures SHALL use semantic headings/landmarks, expand/collapse controls SHALL be keyboard operable and expose their expanded state, action controls (continue, assign) SHALL be labelled, and the inline editors (group title, group project, entry fields, and the shared smart time inputs) SHALL be activatable buttons or labelled inputs with accessible names, keyboard operable including Escape to cancel, with the project select reachable and operable by keyboard. The page SHALL prefer existing PrimeVue components, derive styling from theme tokens (no ad-hoc inline colors), format dates and durations via the active locale, and keep all user-facing strings (including the "(no project)" placeholder) in `en` and `pl` in parity. Server/network failures SHALL surface as a Toast translated from the `{ messageKey, params }` contract.

#### Scenario: Group toggle is accessible
- **WHEN** a task group's expand control is rendered
- **THEN** it SHALL be keyboard operable and expose its expanded/collapsed state to assistive technology

#### Scenario: Inline group editors are accessible
- **WHEN** a task group's title and project context are rendered
- **THEN** they SHALL be activatable buttons with accessible names, and the swapped-in input/select SHALL be labelled, keyboard operable, and cancellable with Escape

#### Scenario: Strings localized in parity
- **WHEN** new user-facing timer-view strings are added
- **THEN** they SHALL exist in both `en.json` and `pl.json` with matching keys

#### Scenario: API failure surfaced
- **WHEN** a timer-view action fails with an API error
- **THEN** the client SHALL show a Toast translated from the returned `messageKey`
