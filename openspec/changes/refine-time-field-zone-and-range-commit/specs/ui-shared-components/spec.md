## MODIFIED Requirements

### Requirement: REQ-361 Segmented clock-time field is the single clock-time entry mechanism
Wherever the UI accepts a wall-clock time of day from the user, it SHALL use one shared segmented time field built on the Nuxt UI time input rather than a free-text input: a single time SHALL be entered through the field's hour and minute segments, and a start–end pair SHALL be entered through the range variant of the same field (one control with two hour–minute groups and a separator under one accessible label). The field SHALL always present a 24-hour clock with two-digit hour and minute segments regardless of the active locale; no seconds segment SHALL be shown.

The field's value SHALL be a structured date-time, not a string. When the field is seeded from an existing instant, editing a segment SHALL change only that segment: the calendar date, seconds, and milliseconds of the seeded value SHALL be preserved unchanged in the resulting value. Typing digits into a segment SHALL fill that segment and advance to the next one when the segment is complete; arrow keys SHALL step the focused segment; Backspace SHALL clear it. Because segments are constrained, the field SHALL never hold an invalid time; a partially filled field SHALL report `null` for that side rather than a guessed time, and the owning feature SHALL treat `null` as "incomplete" (block the action) rather than as a value.

For a zoned value, the field SHALL hide the visible timezone abbreviation when neither bound's calendar date has a timezone offset transition in that bound's timezone. It SHALL show the abbreviation if either bound's calendar date contains a transition, including when a range spans two dates. Hiding the abbreviation SHALL NOT remove the timezone or offset from the bound value or change conversion back to an instant. Plain times and date-times without a timezone SHALL not acquire a timezone label.

The field SHALL support two commit styles from the same component: a live binding that updates the owner on every segment change (forms with an explicit submit action), and an inline contract that emits a commit only when focus leaves the whole field or the user presses Enter, and a cancel that restores the last committed value when the user presses Escape. Moving focus between the field's own segments SHALL NOT count as leaving the field, including moving between the start and end groups of a range. In the inline contract, a commit whose resulting value equals the last committed value SHALL be reported as unchanged so the owner sends no request. A partial or incomplete range SHALL NOT trigger an update request when focus moves inside the field.

The field MAY be asked to clamp same-minute inversions: when this option is enabled on a range field and a commit would leave the start and end in the same calendar minute with the start's seconds later than the end's seconds, the field SHALL set the seconds and milliseconds of the bound the user edited equal to those of the other bound before emitting the commit, so the pair is ordered (a zero-length range) and matches what the segments display. The option SHALL default to off.

Replacing a text time input with the segmented field SHALL NOT change the height of the control or the layout of its surrounding form or row: the field SHALL use the same size token as the neighbouring controls, keep the same wrapper, label, `id`, `data-testid`, and `aria-*` wiring where the control shape survives (the `data-testid` lands on the field's root element; segments are addressable by their `data-segment` part), and, in compact row contexts, SHALL sit in a slot of fixed width derived from its segment widths so every row's field is the same size whether or not it has an end value. The field and its segments SHALL be keyboard operable, and all labels SHALL exist in `en` and `pl` in parity.

#### Scenario: Digits fill hour then minute
- **WHEN** the user focuses an empty field and types `9` `3` `0`
- **THEN** the hour segment SHALL show `09`, the minute segment SHALL show `30`, and no separate commit action SHALL be required for the value to update

#### Scenario: Four digits fill both segments
- **WHEN** the user types `1` `2` `3` `4` into an empty field
- **THEN** the field SHALL show `12:34`

#### Scenario: Always a 24-hour clock
- **WHEN** the active locale is `en`
- **THEN** the field SHALL still show hours `00`–`23` with no AM/PM segment

#### Scenario: Out-of-range digits are constrained
- **WHEN** the user types `2` `9` into the hour segment or `7` `5` into the minute segment
- **THEN** the field SHALL NOT produce hour `29` or minute `75`; it SHALL keep a valid value and the model SHALL never contain an invalid time

#### Scenario: Editing a segment preserves the untouched parts
- **WHEN** the field is seeded from `10:42:31.812` on 12 March and the user changes the minute segment to `45`
- **THEN** the resulting value SHALL be `10:45:31.812` on 12 March — same date, seconds, and milliseconds

#### Scenario: Ordinary date hides timezone abbreviation
- **WHEN** a zoned time is shown on a calendar date with no offset change in that timezone
- **THEN** the timezone abbreviation SHALL NOT be visible, while edits SHALL retain that zoned value's instant conversion

#### Scenario: Transition date shows timezone abbreviation
- **WHEN** a zoned time is shown on a calendar date containing an offset transition in its timezone, including a repeated hour
- **THEN** the timezone abbreviation SHALL be visible so the offset remains distinguishable

#### Scenario: Range checks both dates
- **WHEN** a zoned start–end range spans two calendar dates and only one date contains an offset transition in its timezone
- **THEN** the timezone abbreviation SHALL be visible for the range

#### Scenario: Unzoned value has no timezone abbreviation
- **WHEN** the field contains a plain time or date-time without a timezone
- **THEN** it SHALL NOT display a timezone abbreviation or invent a timezone

#### Scenario: Unchanged commit is reported as unchanged
- **WHEN** the user focuses a field seeded from `10:42:31`, retypes `42` into the minute segment, and leaves the field
- **THEN** the field SHALL report that the value is unchanged and the owner SHALL send no request

#### Scenario: Inline commit on focus leaving the field
- **WHEN** the user edits a segment and then moves focus outside the field, or presses Enter
- **THEN** the field SHALL emit one commit with the new value

#### Scenario: Focus between segments is not a commit
- **WHEN** the user moves focus from the hour segment to the minute segment (or, in a range field, from the start group to the end group)
- **THEN** no commit SHALL be emitted

#### Scenario: Incomplete start does not send a premature update
- **WHEN** the user partially edits a range's start time and moves focus to its end group, even if the departing segment does not identify the next focused segment
- **THEN** no commit or update request SHALL occur until the user explicitly commits or leaves the entire field with a complete value

#### Scenario: Escape cancels the edit
- **WHEN** the user presses Escape while editing
- **THEN** the field SHALL restore the last committed value and SHALL NOT emit a commit

#### Scenario: Same-minute inversion is clamped
- **WHEN** clamping is enabled, the range is `10:42:50 – 10:43:10`, and the user changes the start minute to `43`
- **THEN** the committed start SHALL be `10:43:10` (the end's seconds), the pair SHALL be ordered with zero length, and the segments SHALL still display `10:43 – 10:43`

#### Scenario: Clamping is off by default
- **WHEN** clamping is not enabled and the same edit is committed
- **THEN** the field SHALL emit the inverted pair unchanged and leave validation to the owner

#### Scenario: Range field with no end
- **WHEN** a range field is seeded with a start and no end
- **THEN** the start segments SHALL be filled, the end segments SHALL show placeholders, and the model SHALL report the end as `null`

#### Scenario: Incomplete side reports null
- **WHEN** the user clears the minute segment of a filled field
- **THEN** the model for that side SHALL be `null` and any dependent action (save, submit, patch) SHALL be blocked by the owner's existing inline handling rather than acting on a partial time

#### Scenario: Swap preserves height and layout
- **WHEN** a text time input in a dialog form or entry row is replaced by the segmented field
- **THEN** the control's rendered height and the surrounding grid or row SHALL be unchanged, and in a row the field SHALL occupy the same fixed width whether the entry has an end time or not

#### Scenario: Keyboard-only operation
- **WHEN** a keyboard user tabs into a time field
- **THEN** each segment SHALL be reachable, arrow keys SHALL step the focused segment, and Enter and Escape SHALL commit and cancel as specified