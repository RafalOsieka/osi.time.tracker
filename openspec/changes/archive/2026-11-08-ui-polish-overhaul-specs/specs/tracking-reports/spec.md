## ADDED Requirements

### Requirement: REQ-519 Timesheet legend explains flagged values
Under the monthly timesheet a legend SHALL explain the flags (REQ-293) at a glance: for the Local and Direct columns, what a flagged value there usually means, each keyed by a sample duration in the flag's look, and how to reveal each value's own reason with the pointer or the keyboard. The legend SHALL NOT redefine the columns and SHALL be translated.

#### Scenario: Legend under the timesheet
- **WHEN** the monthly timesheet is shown
- **THEN** a legend under it SHALL say that a flagged Local value means nothing from that day reached a tracker, that a flagged Direct value means time logged in the tracker but not sent from the app, and that hovering a flagged value or moving to it with Tab shows its reason

#### Scenario: Legend keys look like the flag
- **WHEN** the legend is shown
- **THEN** each explanation SHALL be keyed by a sample duration styled like a flagged value, followed by plain text

## MODIFIED Requirements

### Requirement: REQ-472 Flagged and zero duration styling
A flagged duration (REQ-293) SHALL use warning-colored **semibold** text with an underline, a cue besides color (REQ-004), with a themed hover and focus tooltip giving the reason (REQ-269). An unflagged `0:00` SHALL use dimmed text. The table SHALL NOT have an attention column.

#### Scenario: Zero durations recede
- **WHEN** a cell is `0:00` and is not flagged
- **THEN** that duration SHALL use dimmed text, still at least 4.5:1 against its background, and SHALL NOT use warning styling

#### Scenario: Flagged durations have a non-color cue
- **WHEN** a cell is flagged
- **THEN** its duration SHALL be underlined as well as warning-colored and semibold, and its reason SHALL be available from its tooltip on hover and keyboard focus
