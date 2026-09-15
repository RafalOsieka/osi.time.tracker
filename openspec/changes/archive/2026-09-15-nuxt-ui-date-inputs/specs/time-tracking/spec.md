## MODIFIED Requirements

### Requirement: REQ-146 Persistent running-timer indicator
The application shell SHALL display an always-visible running indicator whenever the authenticated user has a running entry, showing the running entry's title and its live-updating elapsed time. The running state SHALL be sourced from the server (`GET /api/time-entries/running`) so it survives page reloads and is consistent across devices. On a full document load of an authenticated page, that fetch SHALL complete during SSR and seed shared timer state so the widget's running vs idle mode and title are correct on first paint (see frontend-shell REQ-258).

The timer widget's title input SHALL be bound to the running entry's title (`taskName`) whenever a timer is running (so the title remains visible after starting and after a reload). When the running entry is untitled (`taskName` is `null`), the title input SHALL be shown **blank** — it SHALL NOT show a placeholder and SHALL NOT show a "(no task)" label.

While the initial running-entry resolution is still in flight (including any client-only path that has not yet resolved), the widget SHALL expose a `loading` state and SHALL disable the title input and the start/stop toggle until the result is known; the widget SHALL NOT allow starting or editing against an unresolved pre-fetch idle state. When SSR has already resolved the running entry into shared state before first paint, the widget SHALL NOT remain in that disabled loading gate solely because a redundant client bootstrap has not run.

Live elapsed time SHALL be client-first: until the client ticker starts after hydration, the elapsed display SHALL show zero (`00:00:00` or equivalent) rather than a server-computed wall-clock duration. After the client ticker starts, elapsed time SHALL update from `startedAt` against the client clock at least once per second while running.

The running title SHALL be editable in place: an edit SHALL be committed via `PATCH /api/time-entries/[id]` (REQ-143) on blur or on Enter, and SHALL NOT be committed per keystroke. Committing a blank (empty or whitespace-only) title SHALL detach the task by sending `title = null`, resulting in `taskId = null`.

Pressing Enter in the title input SHALL start the timer when the suggestion overlay is closed; when the suggestion overlay is open, Enter SHALL retain the autocomplete's default select/close behavior and SHALL NOT start the timer.

While a timer is running, the elapsed-time display SHALL be an activatable control: activating it SHALL open a popover for editing the running entry's start, containing a date field and a single hours-and-minutes time input, seeded with the entry's current start in the user's effective timezone (REQ-165, user-settings). The time field SHALL be the shared smart time input (REQ-131, shared-ui-components), so a time typed from the keyboard (including compact forms like `900`) SHALL be normalized and accepted rather than reverted. The date field SHALL be the shared segmented date field with its calendar affordance (REQ-359, shared-ui-components): digits typed into the day, month, and year segments SHALL fill the date without a separate commit step, the field SHALL never hold an invalid date, and a day chosen from the calendar popover SHALL fill the segments. While the date field is incomplete the save action SHALL be disabled and no request SHALL be sent. Opening the calendar popover from inside the start editor SHALL NOT dismiss the start editor, and choosing a day SHALL close only the calendar. Committing SHALL convert the combined date and time from the effective timezone to a UTC instant (REQ-168) and send it as `startedAt` via `PATCH /api/time-entries/[id]` (REQ-143); a resulting instant in the future SHALL be blocked client-side with an inline error. Past dates SHALL be allowed, so the elapsed time MAY legitimately exceed 24 hours. On success the widget SHALL update the running entry from the response and the elapsed ticker SHALL rebase from the new start; dismissing the popover without committing SHALL change nothing.

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
- **THEN** a popover SHALL open with a segmented date field (with calendar affordance) and a smart hours-and-minutes input seeded with the running entry's current start in the user's effective timezone

#### Scenario: Typed time is normalized in the popover
- **WHEN** the user types a compact time such as `900` into the popover's time field and commits (blur or Enter)
- **THEN** the field SHALL show the normalized `09:00` and the committed start SHALL use that time rather than reverting to the previous value

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

### Requirement: REQ-154 Accessible, localized, tokenized timer view
The timer view SHALL meet WCAG 2.1 AA: day and group structures SHALL use semantic headings/landmarks, expand/collapse controls SHALL be keyboard operable and expose their expanded state, action controls (continue, assign) SHALL be labelled, and the inline editors (group title, group project, entry fields, and the shared smart time inputs) SHALL be activatable buttons or labelled inputs with accessible names, keyboard operable including Escape to cancel, with the project select reachable and operable by keyboard. Interactive controls SHALL NOT be nested inside one another: a group header row that combines an expand/collapse action with inline edit triggers SHALL use a non-interactive layout container with the controls as siblings. The page SHALL prefer existing Nuxt UI components — edit triggers and inline editors SHALL use Nuxt UI `UButton` and `UInput`/`USelect` rather than native `<button>`/`<input>`/`<select>` elements, and any date entry SHALL follow REQ-359 (shared-ui-components) — derive styling from Nuxt UI `--ui-*` theme tokens (no ad-hoc inline colors), format dates and durations via the active locale, and keep all user-facing strings (including the "(no project)" placeholder) in `en` and `pl` in parity. Server/network failures SHALL surface as a Toast translated from the `{ messageKey, params }` contract.

#### Scenario: Group toggle is accessible
- **WHEN** a task group's expand control is rendered
- **THEN** it SHALL be keyboard operable and expose its expanded/collapsed state to assistive technology

#### Scenario: No nested interactive controls in the group header
- **WHEN** a group header renders the expand control together with the inline title/project edit triggers
- **THEN** the controls SHALL be rendered as siblings inside a non-interactive container, with no button or input nested inside another interactive element

#### Scenario: Inline group editors are accessible
- **WHEN** a task group's title and project context are rendered
- **THEN** they SHALL be activatable buttons with accessible names, and the swapped-in input/select SHALL be labelled, keyboard operable, and cancellable with Escape

#### Scenario: Native form elements are not used for editors
- **WHEN** the timer view renders an edit trigger, an inline editor, or the manual add-entry dialog's fields
- **THEN** they SHALL be Nuxt UI components (`UButton`, `UInput`, `USelect`, the shared time input, the shared date field) rather than native `<button>`, `<input>`, or `<select>` elements

#### Scenario: Strings localized in parity
- **WHEN** new user-facing timer-view strings are added
- **THEN** they SHALL exist in both `en.json` and `pl.json` with matching keys

#### Scenario: API failure surfaced
- **WHEN** a timer-view action fails with an API error
- **THEN** the client SHALL show a Toast translated from the returned `messageKey`
