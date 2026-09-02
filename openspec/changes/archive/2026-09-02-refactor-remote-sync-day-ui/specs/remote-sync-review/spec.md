## MODIFIED Requirements

### Requirement: REQ-116 Remote Sync page accessibility and i18n

The Remote Sync page SHALL meet WCAG 2.1 AA: row states and reasons SHALL be conveyed in text (not
color alone), duration and field controls SHALL have accessible labels, asynchronous option loading
and errors SHALL be announced via live regions, and all interactions SHALL be keyboard operable.
Table semantics SHALL be conveyed programmatically, each row's expansion control SHALL expose its
expanded state and be operable from the keyboard, and the day summaries and per-row deltas SHALL be
labelled text rather than unlabelled numbers. Warnings, including the possible-duplicate warning,
SHALL pair an icon with translated text and SHALL never rely on colour alone. All user-facing strings
SHALL come from the i18n catalogs with `en`/`pl` parity, and stable `data-testid` hooks SHALL be
provided for rows, states, durations, field controls, expansion controls, day summaries, day
navigation, the primary export action, and duplicate warnings. Hooks for removed day-level bulk
actions and separate Today and Pick date actions SHALL be retired; all other hooks in use before this
change SHALL remain on equivalent elements.

#### Scenario: States are announced as text

- **WHEN** a row is read-only for any reason
- **THEN** the reason SHALL be available as translated text to assistive technologies, not conveyed
  by styling alone

#### Scenario: Keyboard-only review

- **WHEN** a keyboard user tabs through the page
- **THEN** the compact day switcher, export action, row expansion controls, rounded-duration fields,
  activity selects, per-task selection actions, and inline link actions SHALL all be reachable and
  operable without a pointer

#### Scenario: Expansion state is programmatically exposed

- **WHEN** assistive technology inspects a task row's expansion control
- **THEN** the control SHALL expose whether the row is expanded or collapsed and which region it
  controls

#### Scenario: Existing test hooks keep addressing the same data

- **WHEN** a test queries a retained `data-testid` from before the header refactor
- **THEN** it SHALL resolve to the element carrying the same information in the new layout

#### Scenario: Removed controls are absent

- **WHEN** the Remote Sync page header is rendered
- **THEN** the retired day-level bulk, separate Today, and separate Pick date controls and their test
  hooks SHALL NOT be present

### Requirement: REQ-224 On-page day navigation

The Remote Sync page SHALL present a stable translated page title and a compact day switcher in its
header. The switcher SHALL provide previous-day and next-day actions around a short localized date
label that opens a calendar for jumping to any chosen date. The primary Export action SHALL follow
the switcher in the same header action area. Navigation SHALL change the page's date route, SHALL
recompute the day boundary in the user's configured timezone, and SHALL reload the day review for
the new date. Unfinalized review state belongs to the day being left and SHALL NOT leak into the new
day. A date with no entries SHALL render the existing translated empty state. All controls SHALL be
keyboard operable and labelled for assistive technology.

#### Scenario: Header presents the compact day switcher and primary action

- **WHEN** the user opens the Remote Sync page
- **THEN** the header SHALL show the stable page title, previous-day action, short localized date
  label, next-day action, and Export action without a long date in the title

#### Scenario: Move to the previous day

- **WHEN** the user activates the previous-day action
- **THEN** the page SHALL navigate to the preceding date and display that day's review

#### Scenario: Jump to an arbitrary date

- **WHEN** the user activates the date label and picks a date in the calendar
- **THEN** the page SHALL navigate to that date, including dates with no time entries

#### Scenario: Empty day after navigation

- **WHEN** navigation lands on a date with no time entries
- **THEN** the page SHALL render the translated empty state and no task rows

#### Scenario: Review state does not carry over

- **WHEN** the user has overridden an export duration and then navigates to another day
- **THEN** the new day's rows SHALL be derived from their own data with default selections and no
  inherited override

#### Scenario: Date label remains usable in narrow layouts

- **WHEN** the page is viewed at a supported narrow viewport
- **THEN** the short localized date and adjacent navigation and Export controls SHALL remain legible
  and operable without restoring the long date heading

### Requirement: REQ-228 Bulk selection within a task

Within each manageable task, the page SHALL provide actions to select and deselect all of that
task's completed entries. These actions SHALL affect only that task, SHALL update the row and day
summaries immediately, and SHALL be keyboard operable with translated labels. The page SHALL NOT
provide day-level actions to include or exclude all exportable tasks at once; users SHALL retain
control through task inclusion and per-entry selection.

#### Scenario: Select all entries of a task

- **WHEN** the user activates the select-all-entries action inside a manageable row
- **THEN** every completed entry of that task SHALL become selected and the row's tracked and to-send
  durations SHALL update

#### Scenario: Deselect all entries excludes the task

- **WHEN** the user deselects all entries of a task
- **THEN** the task SHALL be excluded from export with a translated explanation

#### Scenario: Task bulk action does not affect other rows

- **WHEN** the user selects or deselects all entries within one task
- **THEN** selections for every other task and the untitled bucket SHALL remain unchanged

#### Scenario: Day-level bulk task actions are unavailable

- **WHEN** the user reviews a day containing multiple exportable tasks
- **THEN** no action to include all or exclude all exportable tasks SHALL be presented