# tracking-timer-widget Specification

## Purpose
Define the live timer widget hosted in the authenticated shell's top bar: its layout and controls (title autocomplete, elapsed display, icon-only start/stop), the persistent running indicator sourced from the server, in-place retitle and start-time editing, suggestion binding and the create-new-task option, and the bounded, debounced title-suggestion requests. The HTTP contract it drives is `tracking-api`; the shell region that hosts it is `ui-shell`.

## Requirements

### Requirement: REQ-070 Reserved timer region hosts the live timer widget
The shell's reserved running-timer region SHALL host the live timer widget instead of a placeholder, left-aligned in the remaining top-bar width at every viewport width (a single instance — no separate stacked row). The widget SHALL provide a title input (autocomplete over existing tasks) that grows to fill available horizontal space within the widget, an elapsed-time display, and an icon-only start/stop control aligned to the right of the widget. Start SHALL use a play icon; stop SHALL use a square icon; both SHALL use a ghost button variant. The start/stop control SHALL remain labelled for assistive technology (`aria-label` from i18n) and SHALL expose pressed state while a timer is running. While a timer is running, the stop control SHALL present a stronger visual affordance by **animating the stop icon’s color** (not opacity-pulsing the entire button and not a background halo), and that continuous animation SHALL be omitted when the user prefers reduced motion. The elapsed display SHALL use the same button control type for idle and running states so font metrics stay consistent; when idle the elapsed control SHALL be non-activatable (disabled) and SHALL NOT open the start editor; when running it MAY open the start-time editor. Whenever a timer is running the widget SHALL display the running entry's title and live elapsed time (the persistent running indicator). The widget SHALL derive styling from Tailwind utilities and Nuxt UI `--ui-*` design tokens, meet WCAG 2.1 AA (labelled, keyboard-operable controls), and source all user-facing strings from the i18n catalogs with `en`/`pl` parity.

#### Scenario: Timer widget renders centered in the top bar
- **WHEN** an authenticated user views the shell at any viewport width
- **THEN** the reserved timer region SHALL render the live timer widget left-aligned in the remaining top-bar width rather than a centered capped-width placeholder or a row beneath the bar

#### Scenario: Utility menu renders on the top bar right
- **WHEN** the shell is rendered
- **THEN** the top bar's right region SHALL NOT render a utility menu or logout control

#### Scenario: Running indicator shown while a timer runs
- **WHEN** the authenticated user has a running entry
- **THEN** the widget SHALL display the running entry's title (or blank untitled title) and its live elapsed time

#### Scenario: Widget controls are accessible
- **WHEN** the timer widget is rendered
- **THEN** its title input and start/stop control SHALL be labelled, keyboard operable, and styled from Nuxt UI design tokens

#### Scenario: Title grows and controls sit on the right
- **WHEN** the timer widget is rendered
- **THEN** the title input SHALL grow to consume free horizontal space within the widget and the elapsed display and start/stop control SHALL sit to the right of the title input

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
The application shell SHALL display an always-visible running indicator whenever the authenticated user has a running entry, showing the running entry's title and its live-updating elapsed time. The running state SHALL be sourced from the server (`GET /api/time-entries/running`) so it survives page reloads and is consistent across devices. On a full document load of an authenticated page, that fetch SHALL complete during SSR and seed shared timer state so the widget's running vs idle mode and title are correct on first paint (see ui-shell REQ-258).

The timer widget's title input SHALL be bound to the running entry's title (`taskName`) whenever a timer is running (so the title remains visible after starting and after a reload). When the running entry is untitled (`taskName` is `null`), the title input SHALL be shown **blank** — it SHALL NOT show a placeholder and SHALL NOT show a "(no task)" label.

While the initial running-entry resolution is still in flight (including any client-only path that has not yet resolved), the widget SHALL expose a `loading` state and SHALL disable the title input and the start/stop toggle until the result is known; the widget SHALL NOT allow starting or editing against an unresolved pre-fetch idle state. When SSR has already resolved the running entry into shared state before first paint, the widget SHALL NOT remain in that disabled loading gate solely because a redundant client bootstrap has not run.

Live elapsed time SHALL be client-first: until the client ticker starts after hydration, the elapsed display SHALL show zero (`00:00:00` or equivalent) rather than a server-computed wall-clock duration. After the client ticker starts, elapsed time SHALL update from `startedAt` against the client clock at least once per second while running.

The running title SHALL be editable in place: an edit SHALL be committed via `PATCH /api/time-entries/[id]` (REQ-143) on blur or on Enter, and SHALL NOT be committed per keystroke. Committing a blank (empty or whitespace-only) title SHALL detach the task by sending `title = null`, resulting in `taskId = null`.

Pressing Enter in the title input SHALL start the timer when the suggestion overlay is closed; when the suggestion overlay is open, Enter SHALL retain the autocomplete's default select/close behavior and SHALL NOT start the timer.

While a timer is running, the elapsed-time display SHALL be an activatable control: activating it SHALL open a popover for editing the running entry's start, containing a date field and a single hour-and-minute time field, seeded with the entry's current start in the user's effective timezone (REQ-165, workspace-settings). The time field SHALL be the shared segmented clock-time field (REQ-361, ui-shared-components): digits typed into the hour and minute segments SHALL fill the time without a separate commit step (`9` `0` `0` fills `09:00`), and the field SHALL never hold an invalid time. The date field SHALL be the shared segmented date field with its calendar affordance (REQ-359, ui-shared-components): digits typed into the day, month, and year segments SHALL fill the date without a separate commit step, the field SHALL never hold an invalid date, and a day chosen from the calendar popover SHALL fill the segments. While either the date field or the time field is incomplete the save action SHALL be disabled and no request SHALL be sent. Opening the calendar popover from inside the start editor SHALL NOT dismiss the start editor, and choosing a day SHALL close only the calendar. Committing SHALL convert the combined date and time from the effective timezone to a UTC instant (REQ-168) and send it as `startedAt` via `PATCH /api/time-entries/[id]` (REQ-143); a resulting instant in the future SHALL be blocked client-side with an inline error. Past dates SHALL be allowed, so the elapsed time MAY legitimately exceed 24 hours. On success the widget SHALL update the running entry from the response and the elapsed ticker SHALL rebase from the new start; dismissing the popover without committing SHALL change nothing.

When a task edit affects the running entry (rename, project change, merge-on-collision, or bulk assignment binding the running entry to a task), the client SHALL re-fetch the running state (`GET /api/time-entries/running`) so the shell indicator reflects the updated title immediately.

The indicator and timer widget SHALL meet WCAG 2.1 AA (labelled controls, keyboard operable, disabled state conveyed) and derive styling from Nuxt UI `--ui-*` design tokens; all user-facing strings SHALL exist in `en` and `pl` in parity.

#### Scenario: Indicator visible while running
- **WHEN** the authenticated user has a running entry
- **THEN** the shell SHALL show a running indicator with the entry's title and a live elapsed time

#### Scenario: Title stays visible after starting
- **WHEN** the user starts a timer with a non-empty title
- **THEN** the title input SHALL continue to display that title rather than reverting to a placeholder

#### Scenario: Running state survives reload
- **WHEN** a user with a running entry reloads the app
- **THEN** the shell SHALL display the running entry (including its title) from the server-resolved state on first paint of the authenticated shell, without requiring a client-only post-mount fetch to reveal the running mode

#### Scenario: Elapsed starts at zero until client ticker
- **WHEN** a full document load completes for a user with a running entry
- **THEN** the elapsed display SHALL show zero until the client-side ticker starts, after which it SHALL show live elapsed computed on the client from `startedAt`

#### Scenario: Untitled running entry shows blank
- **WHEN** the running entry has no title (`taskName` is `null`)
- **THEN** the title input SHALL be blank, showing neither a placeholder nor a "(no task)" label

#### Scenario: Widget disabled during running fetch
- **WHEN** the running-entry result is not yet known (initial resolution still in flight)
- **THEN** the title input and the toggle button SHALL be disabled until the result resolves, after which they SHALL reflect the resolved state

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

#### Scenario: Task edit refreshes the indicator
- **WHEN** the user renames or re-projects the task of the running entry (including via a merge or bulk assignment)
- **THEN** the client SHALL re-fetch the running state and the indicator SHALL show the updated title

#### Scenario: Strings localized in parity
- **WHEN** new user-facing timer strings are added
- **THEN** they SHALL exist in both `en.json` and `pl.json` with matching keys


### Requirement: REQ-180 Top-bar suggestion binding, labels, and popover anchoring

The top-bar timer widget's title autocomplete SHALL present each suggestion as a single object-based item resolved from `GET /api/tasks?search=`, using exactly one selection handler; it SHALL NOT nest an independently clickable control inside a menu item nor cast object items to strings. Selecting a suggestion by mouse or keyboard SHALL fire a single selection and SHALL NOT issue duplicate requests nor set a stringified-object (`[object Object]`) title.

Each suggestion label SHALL show the task name with its project/client context when present, and SHALL additionally append the remote issue id (from the task's remote issue reference) when the task has one.

When the user selects an existing suggestion, the widget SHALL capture that task's identity and send it to the server so the started/updated entry binds to that exact task (its project and remote reference), rather than reconstructing project/reference from front-end state. When the user commits a free-form title that matches no suggestion, the widget SHALL fall back to the title-based create path (REQ-142).

The suggestion overlay SHALL additionally offer, whenever the typed text is non-empty, a distinct **create-new-task option** labelled with the typed text and a localized "(new task)" marker, rendered separately from the task suggestions and shown even when one or more suggestions match the typed text exactly. That option SHALL be the **first** item in the overlay. The overlay's initial keyboard highlight SHALL land on it. Activating it (by mouse or by overlay-open Enter while it is highlighted) SHALL commit the typed text as a free-form title with **no task binding** — the widget SHALL clear any captured task identity and send `title` only — so the entry resolves through the project-less title path (REQ-142) instead of binding to a matching suggestion. Activating it SHALL close the overlay so a subsequent Enter starts the timer per REQ-146. The option SHALL be keyboard reachable, SHALL expose an accessible name including the typed text, and its strings SHALL exist in `en` and `pl` in parity.

The same create-new-task ordering, labelling, and free-form commit contract SHALL apply to the add-entry dialog title autocomplete.

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

#### Scenario: Create option is first
- **WHEN** the typed text is non-empty and the overlay lists one or more task suggestions
- **THEN** the create-new-task option SHALL appear before every suggestion

#### Scenario: Overlay Enter on the highlighted create option commits freeform
- **WHEN** the overlay is open, the create-new-task option is highlighted, and the user presses Enter
- **THEN** the typed text SHALL be committed as a free-form title with no task binding and the overlay SHALL close

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

#### Scenario: Add-entry dialog shares create-option order
- **WHEN** the user types a non-empty title in the add-entry dialog autocomplete
- **THEN** the create-new-task option SHALL be first in that overlay and SHALL commit the typed text as a free-form title

#### Scenario: Popover anchored to the elapsed control
- **WHEN** the user activates the elapsed-time control to edit the start
- **THEN** the popover SHALL open anchored to that control rather than misaligned to an unrelated element


### Requirement: REQ-360 Bounded and debounced title suggestion requests
The title autocompletes in the top-bar timer widget and the add-entry dialog SHALL request suggestions from `GET /api/tasks` through one shared mechanism so both behave identically. The mechanism SHALL debounce typing: while the user keeps typing, the system SHALL NOT issue a request for every keystroke, and SHALL issue one request for the latest text once typing pauses. The mechanism SHALL guard against out-of-order responses: when a response for an older search text arrives after a request for newer text has been issued, the older response SHALL be discarded and SHALL NOT replace the suggestions. A request that fails SHALL leave the previous suggestions untouched and SHALL NOT surface an error toast, so a transient failure does not interrupt typing a title. The request SHALL rely on the server-side cap and ranking of REQ-133 and SHALL NOT ask for more suggestions than the overlay presents.

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

