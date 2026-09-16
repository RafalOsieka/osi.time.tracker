## ADDED Requirements

### Requirement: REQ-361 Segmented clock-time field is the single clock-time entry mechanism
Wherever the UI accepts a wall-clock time of day from the user, it SHALL use one shared segmented time field built on the Nuxt UI time input rather than a free-text input: a single time SHALL be entered through the field's hour and minute segments, and a start–end pair SHALL be entered through the range variant of the same field (one control with two hour–minute groups and a separator under one accessible label). The field SHALL always present a 24-hour clock with two-digit hour and minute segments regardless of the active locale; no seconds segment SHALL be shown.

The field's value SHALL be a structured date-time, not a string. When the field is seeded from an existing instant, editing a segment SHALL change only that segment: the calendar date, seconds, and milliseconds of the seeded value SHALL be preserved unchanged in the resulting value. Typing digits into a segment SHALL fill that segment and advance to the next one when the segment is complete; arrow keys SHALL step the focused segment; Backspace SHALL clear it. Because segments are constrained, the field SHALL never hold an invalid time; a partially filled field SHALL report `null` for that side rather than a guessed time, and the owning feature SHALL treat `null` as "incomplete" (block the action) rather than as a value.

The field SHALL support two commit styles from the same component: a live binding that updates the owner on every segment change (forms with an explicit submit action), and an inline contract that emits a commit only when focus leaves the whole field or the user presses Enter, and a cancel that restores the last committed value when the user presses Escape. Moving focus between the field's own segments SHALL NOT count as leaving the field. In the inline contract, a commit whose resulting value equals the last committed value SHALL be reported as unchanged so the owner sends no request.

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

#### Scenario: Unchanged commit is reported as unchanged
- **WHEN** the user focuses a field seeded from `10:42:31`, retypes `42` into the minute segment, and leaves the field
- **THEN** the field SHALL report that the value is unchanged and the owner SHALL send no request

#### Scenario: Inline commit on focus leaving the field
- **WHEN** the user edits a segment and then moves focus outside the field, or presses Enter
- **THEN** the field SHALL emit one commit with the new value

#### Scenario: Focus between segments is not a commit
- **WHEN** the user moves focus from the hour segment to the minute segment (or, in a range field, from the start group to the end group)
- **THEN** no commit SHALL be emitted

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

### Requirement: REQ-362 Shared duration input component
The application SHALL provide a reusable duration-input component with an `HH:MM:SS` string model (nullable) backed by a Nuxt UI `UInput` (numeric input mode) and a pure, unit-testable normalization function that forgivingly parses keyboard input into a valid duration in seconds. The parser SHALL apply these deterministic rules:

- one to three colon-separated numeric parts SHALL be accepted as `H:MM:SS`, `H:MM`, or a bare number of minutes;
- parts SHALL be zero-padded on output (e.g. `1:5` → `01:05:00`);
- a minutes or seconds part above `59` SHALL be invalid (including a bare number above `59`); hours SHALL NOT be bounded, so a duration MAY exceed 24 hours;
- surrounding whitespace SHALL be ignored; anything else SHALL be invalid.

The component SHALL commit the normalized value on blur or Enter and cancel on Escape; input that cannot be normalized SHALL silently revert the field to the previous value without emitting a model update and without sending any request. The component SHALL accept an accessible label and `data-testid` via props, and SHALL be the single duration input used wherever the UI accepts a typed duration. Wall-clock times of day SHALL NOT use this component; they use the segmented clock-time field (REQ-361).

When the component is presented in a compact inline context, a committed value SHALL be fully visible without clipping. Compact presentation SHALL reserve enough space for the eight-character `HH:MM:SS` value together with the control's own padding and border.

#### Scenario: Bare minutes normalized on commit
- **WHEN** the user types `45` and blurs the field or presses Enter
- **THEN** the model SHALL update to `00:45:00`

#### Scenario: Hours are unbounded
- **WHEN** the user types `26:15` and commits
- **THEN** the model SHALL update to `26:15:00`

#### Scenario: Invalid input silently reverts
- **WHEN** the user types `1:75` or `abc` and commits
- **THEN** the field SHALL revert to the previous value, the model SHALL NOT update, and no request SHALL be sent

#### Scenario: Escape cancels the edit
- **WHEN** the user presses Escape while editing
- **THEN** the field SHALL revert to the previous value and the model SHALL NOT update

#### Scenario: Compact presentation shows a full HH:MM:SS
- **WHEN** the compact duration input displays a committed value such as `01:30:00`
- **THEN** all eight characters SHALL be visible without clipping

## MODIFIED Requirements

### Requirement: REQ-178 Inline-edit affordance uses a Nuxt UI input

Click-to-edit **text** fields (timer group and entry titles, Remote Sync title-to-send) SHALL express their editable affordance with a shared Nuxt UI `UInput` pattern — a seamless display state (`variant="none"`, styled like plain text) that becomes an editable state (`variant="ghost"`) on focus/activation — rather than a native `<button>` or a `UButton` styled with custom CSS to look like editable text. The group **project** control and Remote Sync **activity** control SHALL occupy a stable slot-owned `UButton` that opens a non-modal `UPopover` listbox on a single activation (not a `USelect`, whose dismiss overlay swallows the first click). Remote Sync **to-send duration** SHALL use a compact slot pattern: a none-variant `UInput` in the reserved slot that becomes the compact outlined duration input (REQ-362) on activation. Timer entry **start/stop times** SHALL NOT use a display/editor swap: they are the segmented clock-time field (REQ-361) rendered permanently in a none-variant presentation whose segments highlight only on focus. The affordance SHALL commit the normalized value on blur or Enter (text and duration) or on option activate (project/activity) and revert on Escape or invalid input (no model update, no request), preserving the existing behavior. It SHALL retain its accessible label and `data-testid`. The control SHALL occupy a stable layout slot whose width is determined by the surrounding layout, not by the current string length: dynamic `ch`-based sizing that grows or shrinks the control with the text SHALL NOT be used. When the display value exceeds the slot, the visible text SHALL be truncated. Activating the editor SHALL fill that same slot and SHALL NOT shift neighboring controls. No `<style scoped>` block SHALL be added to reset button chrome for this pattern.

Timer group and entry titles and Remote Sync title-to-send SHALL use the same shared inline-edit control. Project and activity remain the slot-owned button + popover. To-send duration keeps its own compact slot.

#### Scenario: Text field reads as plain text until edited

- **WHEN** an inline-editable title field is displayed without focus
- **THEN** it SHALL render as seamless plain text (`UInput variant="none"`) with no border, ring, or button chrome

#### Scenario: Field becomes editable on activation and commits

- **WHEN** the user focuses a title field, edits the value, and blurs or presses Enter
- **THEN** the field SHALL present an editable `UInput` and SHALL commit the normalized value

#### Scenario: Project listbox opens on one click

- **WHEN** the user activates a group's project control
- **THEN** a non-modal popover listbox SHALL open on that activation and SHALL NOT require a second click

#### Scenario: Compact time editor is an outlined input

- **WHEN** the compact duration input is shown in the Remote Sync to-send slot
- **THEN** it SHALL render as an outlined `UInput` that still fits the reserved slot

#### Scenario: Entry time field needs no activation step

- **WHEN** an expanded entry row is displayed
- **THEN** its start/stop control SHALL already be the segmented time field, reading as plain text until a segment is focused, and a single click on a segment SHALL make that segment editable

#### Scenario: Invalid input or Escape reverts without side effects

- **WHEN** the user presses Escape or enters a value that cannot be normalized
- **THEN** the field SHALL revert to the previous value, SHALL NOT emit a model update, and SHALL NOT send a request

#### Scenario: No button-as-text CSS overrides remain

- **WHEN** the inline-edit affordance is implemented
- **THEN** it SHALL NOT rely on a `UButton`/`<button>` reset via `<style scoped>` (background/padding/font resets) to imitate editable text

#### Scenario: Display width is not content-sized

- **WHEN** an inline-editable title or project field is displayed
- **THEN** its reserved width SHALL come from the surrounding layout slot and SHALL NOT be a `ch` width derived from the current string length

#### Scenario: Activating the editor keeps the same slot

- **WHEN** the user activates an inline-editable title or project field
- **THEN** the editor SHALL occupy the same reserved width as the display state and neighboring controls SHALL NOT shift

#### Scenario: Remote Sync duration uses the compact time-slot pattern

- **WHEN** a Ready Remote Sync row's to-send value is displayed without focus
- **THEN** it SHALL use a none-variant `UInput` slot and SHALL become the compact outlined duration input on activation

#### Scenario: Remote Sync activity opens like project

- **WHEN** the user activates a Ready row's activity control
- **THEN** a non-modal popover listbox SHALL open on that activation and SHALL NOT require a second click

## REMOVED Requirements

### Requirement: REQ-131 Shared smart time input component
**Reason**: Clock times of day are now entered through the segmented clock-time field (REQ-361); the forgiving `HH:mm` text parser (`93` → `09:30`, revert-on-invalid) no longer has a clock-time consumer.
**Migration**: Clock-time call sites (timer entry rows, add-entry dialog, running-start popover) move to REQ-361. The component's duration mode, its only remaining use (Remote Sync to-send), is specified on its own as REQ-362 and the component is renamed accordingly.
