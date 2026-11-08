## MODIFIED Requirements

### Requirement: REQ-070 Reserved timer region hosts the live timer widget
The shell's timer region (ui-shell REQ-068) SHALL host one live timer widget: a title field with task autocomplete that grows to fill the free width, an elapsed-time display, and a start/stop control (REQ-469) on the right. While a timer runs, the widget SHALL show the running entry's title and live elapsed time. Its colors SHALL come from theme tokens, it SHALL meet WCAG 2.1 AA (labelled, keyboard-operable controls), and its strings SHALL have `en`/`pl` parity.

#### Scenario: Running indicator shown while a timer runs
- **WHEN** the authenticated user has a running entry
- **THEN** the widget SHALL display the running entry's title (or blank untitled title) and its live elapsed time

#### Scenario: Widget controls are accessible
- **WHEN** the timer widget is rendered
- **THEN** its title input and start/stop control SHALL be labelled, keyboard operable, and styled from Nuxt UI design tokens

#### Scenario: Title grows and controls sit on the right
- **WHEN** the timer widget is rendered
- **THEN** the title field SHALL grow to consume free horizontal space within the widget and the elapsed display and start/stop control SHALL sit to the right of it

#### Scenario: Free space after the title focuses it
- **WHEN** the user activates the empty part of the title field after the text and its Project chip (tracking-project-mentions REQ-374)
- **THEN** the title input SHALL receive focus

### Requirement: REQ-469 Start/stop control
The start/stop control SHALL be icon-only, with a play icon to start and a square stop icon while running, a translated accessible name and a pressed state while running. While running, the stop icon's color SHALL animate (not the whole button's opacity, not a halo), except for users who prefer reduced motion. The elapsed display SHALL be the same kind of button in both states, disabled while idle and, while running, opening the start-time editor (REQ-466).

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
- **THEN** the popover SHALL open beside that control, and while it is open it SHALL cover neither the Task title nor its Project chip

#### Scenario: Editor names its timezone
- **WHEN** the start editor is open
- **THEN** it SHALL show the effective timezone with its UTC offset at the chosen date and time (for example "Europe/Warsaw (UTC+01:00)"), updating as the date or time changes
