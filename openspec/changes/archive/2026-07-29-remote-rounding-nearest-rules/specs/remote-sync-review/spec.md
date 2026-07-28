## ADDED Requirements

### Requirement: REQ-222 One-tap rounding suggestions on a manageable row

A manageable task row SHALL offer one-tap alternatives for the editable export duration, derived from the selected-entry total and the Client configuration's rounding increment: the exact selected total, the previous multiple of the increment, and the next multiple of the increment. Duplicate alternatives SHALL be shown once; when the rule is `none` only the exact total SHALL be offered. Activating an alternative SHALL set the same per-task export-duration override as typing the value, so REQ-113 override retention and the reset action SHALL behave identically. Each alternative SHALL be keyboard operable, SHALL be labelled with translated text stating its duration, and SHALL expose a stable `data-testid`.

#### Scenario: Alternatives reflect the selected total and increment
- **WHEN** a manageable row under `nearest_15m` has a selected total of 1 hour 3 minutes
- **THEN** the row SHALL offer 1 hour 3 minutes, 1 hour 0 minutes and 1 hour 15 minutes as one-tap alternatives

#### Scenario: Choosing an alternative overrides the export duration
- **WHEN** the user activates one of the offered alternatives
- **THEN** the editable export duration SHALL become that value, SHALL be treated as an explicit user override, and SHALL be retained when the entry selection changes until the user resets it

#### Scenario: Reset returns to the configured rule
- **WHEN** the user resets the export duration after choosing an alternative
- **THEN** the row SHALL recompute the default by applying the Client configuration's rounding rule once to the current selected total

#### Scenario: Duplicate alternatives collapse
- **WHEN** the selected total is already an exact multiple of the increment
- **THEN** the row SHALL offer that single value rather than three identical alternatives

#### Scenario: Passthrough rule offers only the exact total
- **WHEN** the Client configuration's rounding rule is `none`
- **THEN** the row SHALL offer only the exact selected total as an alternative

#### Scenario: Alternatives are keyboard operable
- **WHEN** a keyboard user tabs to the export-duration field of a manageable row
- **THEN** every offered alternative SHALL be reachable and activatable without a pointer
