## MODIFIED Requirements

### Requirement: REQ-224 On-page day navigation

The Remote Sync page SHALL present a stable translated page title and a compact day switcher in its
header. The switcher SHALL provide previous-day and next-day actions around a short localized date
label that opens a calendar for jumping to any chosen date. That calendar SHALL be the shared
calendar grid (REQ-359, shared-ui-components) shown directly in a popover — not a text field — with
the currently displayed day pre-selected and the month of that day in view; choosing a day SHALL
navigate to it and close the popover, and choosing the already-displayed day SHALL only close the
popover. The primary Export action SHALL follow the switcher in the same header action area.
Navigation SHALL change the page's date route, SHALL recompute the day boundary in the user's
configured timezone, and SHALL reload the day review for the new date. Unfinalized review state
belongs to the day being left and SHALL NOT leak into the new day. A date with no entries SHALL
render the existing translated empty state. All controls SHALL be keyboard operable and labelled
for assistive technology, and the calendar grid SHALL be navigable with arrow keys and confirmable
with Enter or Space.

#### Scenario: Header presents the compact day switcher and primary action

- **WHEN** the user opens the Remote Sync page
- **THEN** the header SHALL show the stable page title, previous-day action, short localized date
  label, next-day action, and Export action without a long date in the title

#### Scenario: Move to the previous day

- **WHEN** the user activates the previous-day action
- **THEN** the page SHALL navigate to the preceding date and display that day's review

#### Scenario: Jump to an arbitrary date

- **WHEN** the user activates the date label and picks a date in the calendar grid
- **THEN** the popover SHALL close and the page SHALL navigate to that date, including dates with no
  time entries

#### Scenario: Calendar opens on the displayed day

- **WHEN** the user activates the date label while viewing `2026-09-07`
- **THEN** the calendar SHALL show September 2026 with the 7th selected, and picking the 7th again
  SHALL close the popover without navigating or reloading

#### Scenario: Calendar is keyboard operable

- **WHEN** a keyboard user opens the calendar from the date label
- **THEN** focus SHALL move into the grid, arrow keys SHALL move between days (crossing month
  boundaries), Enter SHALL navigate to the focused day, and Escape SHALL close the popover without
  navigating

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
