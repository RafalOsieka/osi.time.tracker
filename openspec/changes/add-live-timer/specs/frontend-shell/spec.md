## ADDED Requirements

### Requirement: REQ-AUTH-016 Reserved timer region hosts the live timer widget
The shell's reserved running-timer region SHALL host the live timer widget instead of a placeholder, at every responsive tier where the region is present — inline within the top bar (desktop and above the very-small threshold) and in the dedicated full-width stacked row below the very-small threshold. The widget SHALL provide a title input (autocomplete over existing tasks) and a start/stop control, and SHALL display the running entry's title and live elapsed time whenever a timer is running (the persistent running indicator). The widget SHALL derive styling from PrimeVue theme tokens, meet WCAG 2.1 AA (labelled, keyboard-operable controls), and source all user-facing strings from the i18n catalogs with `en`/`pl` parity.

#### Scenario: Timer widget renders inline in the top bar
- **WHEN** an authenticated user views the shell at or above the very-small threshold
- **THEN** the reserved timer region SHALL render the live timer widget inline within the top bar rather than a placeholder

#### Scenario: Timer widget renders in the stacked row
- **WHEN** the viewport is narrower than the very-small threshold
- **THEN** the live timer widget SHALL render in the dedicated full-width row beneath the top bar

#### Scenario: Running indicator shown while a timer runs
- **WHEN** the authenticated user has a running entry
- **THEN** the widget SHALL display the running entry's title (or "(no task)") and its live elapsed time

#### Scenario: Widget controls are accessible
- **WHEN** the timer widget is rendered
- **THEN** its title input and start/stop control SHALL be labelled, keyboard operable, and styled from PrimeVue theme tokens
