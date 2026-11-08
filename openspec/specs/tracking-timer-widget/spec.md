# tracking-timer-widget Specification

## Purpose
Define the live timer widget in the authenticated shell's top bar: its layout and start/stop control, the running indicator resolved from the server, in-place retitling and start-time editing, title suggestions with the create-new-task option, and debounced suggestion requests. The HTTP contract it drives is `tracking-api`; the shell region that hosts it is `ui-shell`.

## Requirements

### Requirement: REQ-070 Reserved timer region hosts the live timer widget
The shell's timer region (ui-shell REQ-068) SHALL host one live timer widget: a title input with task autocomplete that grows to fill the free width, an elapsed-time display, and a start/stop control (REQ-469) on the right. While a timer runs, the widget SHALL show the running entry's title and live elapsed time. Its colors SHALL come from theme tokens, it SHALL meet WCAG 2.1 AA (labelled, keyboard-operable controls), and its strings SHALL have `en`/`pl` parity.

#### Scenario: Running indicator shown while a timer runs
- **WHEN** the authenticated user has a running entry
- **THEN** the widget SHALL display the running entry's title (or blank untitled title) and its live elapsed time

#### Scenario: Widget controls are accessible
- **WHEN** the timer widget is rendered
- **THEN** its title input and start/stop control SHALL be labelled, keyboard operable, and styled from Nuxt UI design tokens

#### Scenario: Title grows and controls sit on the right
- **WHEN** the timer widget is rendered
- **THEN** the title input SHALL grow to consume free horizontal space within the widget and the elapsed display and start/stop control SHALL sit to the right of the title input

### Requirement: REQ-469 Start/stop control
The start/stop control SHALL be icon-only, a ghost button with a play icon to start and a square icon to stop, with a translated accessible name and a pressed state while running. While running, the stop icon's color SHALL animate (not the whole button's opacity, not a halo), except for users who prefer reduced motion. The elapsed display SHALL be the same kind of button in both states, disabled while idle and, while running, opening the start-time editor (REQ-466).

#### Scenario: Start and stop are icon-only with accessible names
- **WHEN** the timer is idle
- **THEN** the toggle control SHALL show a play icon without a visible Start label and SHALL expose an accessible name for start
- **WHEN** the timer is running
- **THEN** the toggle control SHALL show a square icon without a visible Stop label, SHALL expose an accessible name for stop, and SHALL indicate a pressed/running state

#### Scenario: Running stop has a stronger affordance
- **WHEN** a timer is running and the user does not prefer reduced motion
- **THEN** the stop **icon** SHALL animate its color (stronger than static error styling alone)
- **WHEN** a timer is running and the user prefers reduced motion
- **THEN** the stop control SHALL remain visually distinct without requiring continuous animation

### Requirement: REQ-146 Persistent running-timer indicator
The shell SHALL show the running entry's title and live elapsed time while one exists, from `GET /api/time-entries/running` so it survives reloads and devices, resolved during SSR on a full load (REQ-258). The title input SHALL show the running entry's title, blank for an untitled entry (no placeholder, no "(no task)"). After a task edit that affects the running entry (rename, project change, merge, bulk assignment) the client SHALL refetch the running state.

#### Scenario: Indicator visible while running
- **WHEN** the authenticated user has a running entry
- **THEN** the shell SHALL show a running indicator with the entry's title and a live elapsed time

#### Scenario: Title stays visible after starting
- **WHEN** the user starts a timer with a non-empty title
- **THEN** the title input SHALL continue to display that title rather than reverting to a placeholder

#### Scenario: Running state survives reload
- **WHEN** a user with a running entry reloads the app
- **THEN** the shell SHALL display the running entry (including its title) from the server-resolved state on first paint of the authenticated shell, without requiring a client-only post-mount fetch to reveal the running mode

#### Scenario: Untitled running entry shows blank
- **WHEN** the running entry has no title (`taskName` is `null`)
- **THEN** the title input SHALL be blank, showing neither a placeholder nor a "(no task)" label

#### Scenario: Task edit refreshes the indicator
- **WHEN** the user renames or re-projects the task of the running entry (including via a merge or bulk assignment)
- **THEN** the client SHALL re-fetch the running state and the indicator SHALL show the updated title

#### Scenario: Strings localized in parity
- **WHEN** new user-facing timer strings are added
- **THEN** they SHALL exist in both `en.json` and `pl.json` with matching keys

### Requirement: REQ-464 Loading gate and client-side elapsed time
While the running state is not yet known, the widget SHALL be in a loading state with the title input and start/stop control disabled, so nothing can start against an unresolved idle state; once SSR has seeded the state, it SHALL NOT wait for a redundant client fetch. Elapsed time SHALL be computed in the browser: zero until the client ticker starts after hydration, then from `startedAt` against the client clock at least once per second.

#### Scenario: Widget disabled during running fetch
- **WHEN** the running-entry result is not yet known (initial resolution still in flight)
- **THEN** the title input and the toggle button SHALL be disabled until the result resolves, after which they SHALL reflect the resolved state

#### Scenario: Elapsed starts at zero until client ticker
- **WHEN** a full document load completes for a user with a running entry
- **THEN** the elapsed display SHALL show zero until the client-side ticker starts, after which it SHALL show live elapsed computed on the client from `startedAt`

### Requirement: REQ-465 Retitling the running entry and Enter
The running title SHALL be editable in place, committed with `PATCH /api/time-entries/[id]` (REQ-143) on blur or Enter, never per keystroke. Committing a blank title SHALL send `title = null`, detaching the task. Enter in the title input SHALL start the timer when the suggestion overlay is closed; while it is open, Enter SHALL keep the autocomplete's select/close behavior and SHALL NOT start the timer.

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

### Requirement: REQ-466 Running start-time editor
While running, the elapsed control SHALL open a popover anchored to it with the shared date (REQ-359) and hour–minute (REQ-361) fields, seeded with the start in the user's timezone; Save SHALL be disabled while either is incomplete, and a calendar pick closes only the calendar. Saving SHALL convert to a UTC instant and PATCH `startedAt` (REQ-143); a future instant SHALL be blocked inline, a past one allowed even beyond 24 hours, and the ticker SHALL rebase. Dismissing SHALL change nothing.

#### Scenario: Elapsed time opens the start edit popover
- **WHEN** the user activates the elapsed-time control while a timer is running
- **THEN** a popover SHALL open with a segmented date field (with calendar affordance) and a segmented hour-and-minute time field seeded with the running entry's current start in the user's effective timezone

#### Scenario: Typed time is normalized in the popover
- **WHEN** the user focuses the popover's time field and types `9` `0` `0`
- **THEN** the field SHALL show `09:00` without a separate commit step and the save action SHALL use that time

#### Scenario: Incomplete time blocks saving
- **WHEN** the user clears the minute segment of the popover's time field
- **THEN** the save action SHALL be disabled and no request SHALL be sent until the time is complete again

#### Scenario: Typed date commits in the popover
- **WHEN** the user focuses the popover's date field and types the digits of `9 July 2026` in the active locale's segment order
- **THEN** the field SHALL show `2026-07-09` in that locale's presentation and the save action SHALL use that date without a separate commit step

#### Scenario: Invalid typed date reverts
- **WHEN** the user types digits that do not form a valid segment value (for example `3` `5` into the day segment, or `1` `3` into the month segment)
- **THEN** the segment SHALL keep a valid value, the field SHALL never resolve to an invalid date, and no request SHALL be sent on that basis

#### Scenario: Calendar pick stays inside the start editor
- **WHEN** the user opens the date field's calendar from inside the start editor and chooses a day
- **THEN** the calendar SHALL close, the start editor SHALL remain open with the chosen day in the date field, and no request SHALL be sent until the user saves

#### Scenario: Incomplete date blocks saving
- **WHEN** the user clears a segment of the popover's date field
- **THEN** the save action SHALL be disabled and no request SHALL be sent until the date is complete again

#### Scenario: Committing a new start rebases the ticker
- **WHEN** the user commits a valid past start date/time in the popover
- **THEN** the running entry SHALL be patched with the new `startedAt` (converted from the effective timezone) and the elapsed time SHALL rebase from it, remaining running

#### Scenario: Future start blocked in the popover
- **WHEN** the popover's combined date and time resolve to a future instant
- **THEN** an inline error SHALL be shown and no request SHALL be sent

#### Scenario: Start moved to a previous day
- **WHEN** the user commits a start on an earlier date
- **THEN** the change SHALL be accepted and the elapsed time MAY display a duration exceeding 24 hours

#### Scenario: Popover anchored to the elapsed control
- **WHEN** the user activates the elapsed-time control to edit the start
- **THEN** the popover SHALL open anchored to that control rather than misaligned to an unrelated element

### Requirement: REQ-180 Top-bar suggestion binding, labels, and popover anchoring
Title suggestions SHALL come from `GET /api/tasks?search=` as object items with one selection handler and nothing clickable nested inside, so a pick fires once and never sets `[object Object]`. A label SHALL show the task name, its project and its remote issue id when present. A pick SHALL send that task's identity so the entry binds to it; free-form text SHALL take the title path (REQ-142) in the chip's project or none (REQ-376). A set chip SHALL limit suggestions to its project.

#### Scenario: Single selection, no duplicate requests
- **WHEN** the user selects a suggestion with the mouse
- **THEN** exactly one selection SHALL be handled, no duplicate requests SHALL be sent, and the title SHALL be the task name (never `[object Object]`)

#### Scenario: Suggestion label shows the remote issue id
- **WHEN** a suggested task has a remote issue reference
- **THEN** its label SHALL include the remote issue id alongside the name and project context

#### Scenario: Picking a suggestion binds to that exact task
- **WHEN** the user picks an existing suggestion and starts the timer
- **THEN** the entry SHALL bind to that task's identity (its project and remote reference), not a newly created project-less task

### Requirement: REQ-467 Create-new-task option
For non-empty text the overlay SHALL offer a separate **create-new-task** option, first and initially highlighted even beside an exact match, labelled with the title and "(new task)", or "(new task in {project})" when a chip or resolved mention (REQ-375) gives one. Activating it SHALL drop any captured task, commit the text free-form with the chip's `projectId` (or null), and close the overlay so the next Enter starts. It SHALL be keyboard reachable and named; project mode (REQ-372) hides it.

#### Scenario: Create option is offered alongside exact matches
- **WHEN** the typed text exactly matches one or more existing task suggestions
- **THEN** the overlay SHALL still offer the create-new-task option labelled with the typed text and a localized "(new task)" marker

#### Scenario: Create option is first
- **WHEN** the typed text is non-empty and the overlay lists one or more task suggestions
- **THEN** the create-new-task option SHALL appear before every suggestion

#### Scenario: Create option names the chip's project
- **WHEN** the project chip shows "Helios" and the user types `fix login`
- **THEN** the create-new-task option SHALL read "fix login (new task in Helios)"

#### Scenario: Overlay Enter on the highlighted create option commits freeform
- **WHEN** the overlay is open, the create-new-task option is highlighted, and the user presses Enter
- **THEN** the typed text SHALL be committed as a free-form title with no task binding and the overlay SHALL close

#### Scenario: Create option sends the title without a task binding
- **WHEN** the project chip is empty and the user activates the create-new-task option and starts the timer
- **THEN** the request SHALL carry the typed `title` with no `taskId` and the entry SHALL resolve in the project-less scope per REQ-142

#### Scenario: Create option sends the chip's project
- **WHEN** the project chip shows "Helios" and the user activates the create-new-task option and starts the timer
- **THEN** the request SHALL carry the typed `title` and Helios's `projectId` with no `taskId`, and the entry SHALL resolve in "Helios" per REQ-142

#### Scenario: Create option clears a previously captured suggestion
- **WHEN** the user first selects a suggestion, edits the text, and then activates the create-new-task option
- **THEN** the previously captured task identity SHALL be discarded and SHALL NOT be sent

#### Scenario: Create option is keyboard operable
- **WHEN** the user navigates the overlay with the keyboard to the create-new-task option and activates it
- **THEN** the typed text SHALL be committed as a free-form title, the overlay SHALL close, and a subsequent Enter SHALL start the timer

#### Scenario: No create option for empty text
- **WHEN** the title input is empty or whitespace-only
- **THEN** the overlay SHALL NOT offer a create-new-task option

### Requirement: REQ-468 The add-entry dialog shares the title autocomplete
The add-entry dialog's title autocomplete SHALL behave as the top bar's: the same suggestion binding, labels, create-new-task option and order, free-form commit and project chip. A suggestion picked there SHALL bind the created entry by `taskId` until the title text is edited, after which the edited title and the chip's `projectId` SHALL be sent instead.

#### Scenario: Add-entry dialog shares create-option order
- **WHEN** the user types a non-empty title in the add-entry dialog autocomplete
- **THEN** the create-new-task option SHALL be first in that overlay and SHALL commit the typed text as a free-form title

#### Scenario: Add-entry dialog binds a picked suggestion
- **WHEN** the user picks the suggestion "fix login · Nordwind #412" in the add-entry dialog and saves without editing the title
- **THEN** the request SHALL carry that task's `taskId` and the created entry SHALL bind to that task, including its remote reference

#### Scenario: Add-entry dialog edit after pick falls back to title
- **WHEN** the user picks a suggestion in the add-entry dialog, then edits the title text, and saves
- **THEN** the request SHALL carry the edited `title` with the chip's `projectId` and no `taskId`

### Requirement: REQ-360 Bounded and debounced title suggestion requests
The top-bar and add-entry autocompletes SHALL fetch suggestions from `GET /api/tasks` through one shared mechanism. It SHALL debounce typing, sending one request for the latest text once typing pauses. A response for older text arriving after a newer request SHALL be discarded. A failed request SHALL keep the previous suggestions and show no error toast. It SHALL rely on the server's cap and ranking (REQ-133) and SHALL NOT ask for more than the overlay shows.

#### Scenario: Rapid typing issues one request
- **WHEN** the user types several characters in quick succession
- **THEN** the system SHALL issue a single suggestion request carrying the final text once typing pauses

#### Scenario: Stale response is discarded
- **WHEN** a request for text "a" is still in flight, the user types "ab", and the response for "a" arrives after the request for "ab" was issued
- **THEN** the "a" response SHALL be ignored and the suggestions SHALL reflect the "ab" response when it arrives

#### Scenario: Failed request keeps previous suggestions
- **WHEN** a suggestion request fails
- **THEN** the currently shown suggestions SHALL remain unchanged and no error toast SHALL appear

#### Scenario: Add-entry dialog shares the mechanism
- **WHEN** the user types a title in the add-entry dialog
- **THEN** its requests SHALL be debounced and stale-guarded exactly as in the top-bar widget

#### Scenario: Overlay stays responsive with a large task history
- **WHEN** the user has tens of thousands of tasks and focuses or types in the title input
- **THEN** the overlay SHALL present at most the server cap of suggestions and the page SHALL remain interactive
