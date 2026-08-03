## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: REQ-150 Timer view page

The application SHALL render the timer view as the home page at `/` (replacing the welcome placeholder). The page SHALL display the user's time entries grouped per calendar day using the user's effective timezone (REQ-165, user-settings; day boundaries computed via the timezone-aware utilities of REQ-168) (grouping by each entry's `startedAt`), newest day first. Because the grouping depends on the effective timezone (which may fall back to browser detection), the day/group list (including the empty state) SHALL be rendered client-side only — the server SHALL NOT render day groups, so no hydration mismatch can occur. Each day SHALL show a localized date heading, the day's total duration, and an "add entry" action for creating a manual entry on that day. Within a day, entries SHALL be grouped by task: each task group SHALL show the task name with its project/client context (when present), the group's total duration, and the entry count; expanding a group SHALL list its entries with their start–stop times and derived duration. Untitled entries of a day SHALL collect in a "(no task)" group. Days without entries SHALL NOT render empty groups.

The initial 7-day window SHALL be **anchored on the user's most recent entry** rather than always on the current instant: on first load the page SHALL read the anchor instant via `GET /api/time-entries/latest` (REQ-236) and align its window start to the user's `weekStart` for the week containing that instant, so a user opening the app in a week with no entries yet still sees their latest tracked week instead of an empty page. When the anchor is `null` (the user has never tracked anything) the page SHALL NOT issue an entry-range request for a further window and SHALL render the never-tracked empty state. When the anchor falls inside the current week, the window SHALL be the current week exactly as before. The page SHALL provide a "load more" control that extends the window further back by the same step from the anchored window.

The page SHALL distinguish three states: (a) entries present, (b) **no entries in the loaded window but entries exist elsewhere**, and (c) **no entries at all**. State (c) SHALL render a dedicated empty state pointing to the timer widget. State (b) SHALL render an empty-window state offering "load more". When the anchored window is not the current week, the page SHALL render a localized indication of which week is shown together with a control that returns the window to the current week; activating it SHALL re-align the window to the current week without a full reload.

The "add entry" action SHALL open a manual-entry form scoped to that day, accepting an optional title (same task autocomplete as the timer widget), a start time, and an end time entered via the shared smart time input (REQ-131, shared-ui-components; the date is fixed by the day section). The form SHALL convert the entered wall-clock times to instants using the effective timezone (REQ-168) and submit them via `POST /api/time-entries` (REQ-140 manual pair); an end time earlier than the start time SHALL be blocked client-side with an inline error. On success the page SHALL insert the entry into the correct day/task group.

Each listed entry SHALL be editable inline: its start time, stop time (via the shared smart time input, REQ-131), and title SHALL be individually editable, committed on blur or Enter and cancelled on Escape, via `PATCH /api/time-entries/[id]` (REQ-143). Activating one of the row's inline editors SHALL cancel any other editor active in that row without committing, and the swapped-in input SHALL receive focus so editing starts with a single click. Retitling a single entry SHALL re-resolve it to another (or a new) task, leaving the rest of the group unaffected. When an edited `startedAt` moves the entry to a different day in the effective timezone, the page SHALL regroup the entry under that day. Each listed entry SHALL also offer a delete action requiring an explicit confirmation before calling `DELETE /api/time-entries/[id]` (REQ-151); on success the entry SHALL be removed from the page and emptied groups SHALL disappear.

The page SHALL observe the shell's running-timer state: when the running entry stops (including a stop triggered from the top-bar widget or a stop-on-new-start), the page SHALL refresh its entry list so the finished entry appears in its day/task group immediately, without a manual reload.

When the user's timezone or week-start setting changes, the page SHALL regroup and re-render from the already-loaded entries (pure re-render); no data migration or refetch SHALL be required for correctness. A `weekStart` change SHALL re-align the anchored window without re-fetching the anchor.

#### Scenario: Entries grouped by effective-timezone day and task
- **WHEN** the authenticated user opens `/` with entries on multiple days
- **THEN** the page SHALL show one section per day in the effective timezone, newest first, each with a day total and per-task groups showing name, context, entry count, and group total

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
