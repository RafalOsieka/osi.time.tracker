## MODIFIED Requirements

### Requirement: REQ-NFR-026 Persistent running-timer indicator
The application shell SHALL display an always-visible running indicator whenever the authenticated user has a running entry, showing the running entry's title and its live-updating elapsed time. The running state SHALL be sourced from the server (`GET /api/time-entries/running`) so it survives page reloads and is consistent across devices.

The timer widget's title input SHALL be bound to the running entry's title (`taskName`) whenever a timer is running (so the title remains visible after starting and after a reload). When the running entry is untitled (`taskName` is `null`), the title input SHALL be shown **blank** — it SHALL NOT show a placeholder and SHALL NOT show a "(no task)" label.

While the initial running-entry fetch is in flight, the widget SHALL expose a `loading` state and SHALL disable the title input and the start/stop toggle until the fetch resolves, then reflect the server result; the widget SHALL NOT allow starting or editing against the pre-fetch idle state.

The running title SHALL be editable in place: an edit SHALL be committed via `PATCH /api/time-entries/[id]` (REQ-TTR-039) on blur or on Enter, and SHALL NOT be committed per keystroke. Committing a blank (empty or whitespace-only) title SHALL detach the task by sending `title = null`, resulting in `taskId = null`.

Pressing Enter in the title input SHALL start the timer when the suggestion overlay is closed; when the suggestion overlay is open, Enter SHALL retain the autocomplete's default select/close behavior and SHALL NOT start the timer.

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

#### Scenario: Strings localized in parity
- **WHEN** new user-facing timer strings are added
- **THEN** they SHALL exist in both `en.json` and `pl.json` with matching keys
