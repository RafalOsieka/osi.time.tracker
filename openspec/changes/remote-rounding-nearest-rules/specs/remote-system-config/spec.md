## ADDED Requirements

### Requirement: REQ-220 Nearest-increment rounding rules

The accepted `roundingRule` values SHALL be `none`, `up_15m`, `up_30m`, `up_1h`, `nearest_15m`, `nearest_30m` and `nearest_1h`. A `nearest_*` rule SHALL round a summed duration to the closest multiple of its increment, rounding **up** when the remainder is exactly half the increment. The `up_*` rules SHALL keep rounding up to the next multiple, and `none` SHALL pass the total through unchanged; existing stored configurations SHALL keep their current behaviour without migration or remapping. Rounding SHALL remain a pure, once-applied, export-time transformation that never alters stored local entries. The configuration form SHALL offer every accepted rule with a translated label in both `en` and `pl`.

#### Scenario: Nearest rule rounds down below the midpoint
- **WHEN** a selected total of 1 hour 3 minutes is rounded under `nearest_15m`
- **THEN** the result SHALL be 1 hour 0 minutes

#### Scenario: Nearest rule rounds up above the midpoint
- **WHEN** a selected total of 1 hour 11 minutes is rounded under `nearest_15m`
- **THEN** the result SHALL be 1 hour 15 minutes

#### Scenario: Exact midpoint rounds up
- **WHEN** a selected total of 1 hour 7 minutes 30 seconds is rounded under `nearest_15m`
- **THEN** the result SHALL be 1 hour 15 minutes

#### Scenario: Exact multiple is unchanged
- **WHEN** a selected total is already an exact multiple of the rule's increment
- **THEN** the result SHALL equal the total for both `nearest_*` and `up_*` rules

#### Scenario: Existing up rule is unaffected
- **WHEN** a selected total of 1 hour 3 minutes is rounded under `up_15m`
- **THEN** the result SHALL be 1 hour 15 minutes, as before this change

#### Scenario: Unsupported rounding rule is rejected
- **WHEN** a user saves a remote configuration with a `roundingRule` outside the accepted set
- **THEN** the system SHALL reject the request with a `{ messageKey, params }` validation error and persist nothing

### Requirement: REQ-221 Rounding never reduces a non-zero duration to zero

For any increment-based rounding rule, a total greater than `0` SHALL never round to `0`; when the rounded result would be `0`, the system SHALL return exactly one increment instead. A total of exactly `0` SHALL still round to `0` so that a task with no selected entries remains excluded from export.

#### Scenario: Short duration is lifted to one increment
- **WHEN** a selected total of 4 minutes is rounded under `nearest_15m`
- **THEN** the result SHALL be 15 minutes rather than 0, so the task remains exportable

#### Scenario: Empty selection stays zero
- **WHEN** the selected total is `0` under any rounding rule
- **THEN** the result SHALL be `0` and the task SHALL remain excluded from export

#### Scenario: Passthrough rule is unaffected
- **WHEN** a total of 4 minutes is rounded under `none`
- **THEN** the result SHALL be 4 minutes
