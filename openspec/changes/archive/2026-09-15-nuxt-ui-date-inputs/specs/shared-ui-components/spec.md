## ADDED Requirements

### Requirement: REQ-359 Nuxt UI date components are the single date-entry mechanism
Wherever the UI accepts a calendar date from the user, it SHALL use the Nuxt UI date components rather than a native `<input type="date">`: a single date SHALL be entered through the segmented date field (`UInputDate`), an inclusive date range SHALL be entered through the range variant of that field (one control with start and end segments and a separator, under one accessible label), and a "jump to a date" picker whose only purpose is to choose a day SHALL present the calendar grid (`UCalendar`) directly. Every segmented date field SHALL offer a calendar affordance: a labelled trailing button that opens the calendar grid in a popover anchored to the field, where choosing a day fills the field and closes the popover. Segment order and month/day labels SHALL follow the active application locale (`en` / `pl`) as configured on the app root, and the year segment SHALL always be four digits.

The date field SHALL expose its value to the surrounding feature as a local calendar day in `YYYY-MM-DD` form (or `null` when incomplete); callers SHALL NOT receive time-of-day or timezone information from a date field. Typing digits into a segment SHALL fill that segment and advance to the next one when the segment is complete; arrow keys SHALL step the focused segment; Backspace SHALL clear it. Because segments are constrained, the field SHALL never hold a syntactically invalid date, and a partially filled field SHALL report `null` rather than a guessed date. Optional bounds (minimum, maximum) SHALL prevent both typing and picking a day outside them.

Replacing a native date input with the segmented field SHALL NOT change the height of the control or the layout of its surrounding form: the field SHALL use the same size token as the neighbouring Nuxt UI controls and SHALL keep the same wrapper, label, `id`, `data-testid`, and `aria-*` wiring so existing accessibility contracts and selectors remain valid (the `data-testid` lands on the field's root element; its segments are addressable by their `data-segment` part). The calendar button and calendar grid SHALL be keyboard operable and labelled with translated strings existing in `en` and `pl` in parity.

#### Scenario: Digits fill segments in locale order
- **WHEN** the active locale is `pl` and the user focuses an empty date field and types `0` `7` `0` `9` `2` `0` `2` `6`
- **THEN** the field SHALL show `07.09.2026`, the model SHALL be `2026-09-07`, and no separate commit action SHALL be required

#### Scenario: Locale changes segment order, not the value
- **WHEN** the same date is shown while the active locale is `en`
- **THEN** the segments SHALL be presented in that locale's order (month before day) while the model stays `2026-09-07`

#### Scenario: Incomplete date reports null
- **WHEN** the user clears the year segment of a filled date field
- **THEN** the model SHALL be `null` and any dependent action (save, navigate, scan) SHALL be blocked with its existing inline validation rather than acting on a partial date

#### Scenario: Out-of-range segment value is constrained
- **WHEN** the user types `3` `5` into the day segment
- **THEN** the field SHALL NOT produce day `35`; it SHALL keep a valid day and the model SHALL never contain an invalid calendar date

#### Scenario: Calendar affordance fills the field
- **WHEN** the user activates the field's calendar button and chooses a day in the calendar grid
- **THEN** the popover SHALL close, the field's segments SHALL show that day, and the model SHALL update to it

#### Scenario: Range field reports both ends
- **WHEN** the user fills both the start and end segments of a date-range field
- **THEN** the model SHALL expose `{ start, end }` as two `YYYY-MM-DD` values; an inverted pair (start after end) SHALL still be representable so the owning feature can show its own inline error

#### Scenario: Swap preserves layout and selectors
- **WHEN** a native date input in a dialog form is replaced by the segmented field
- **THEN** the control's rendered height and the form's grid SHALL be unchanged, and the pre-existing `data-testid`, `id`, and `<label for>` wiring SHALL still resolve to the new control

#### Scenario: Keyboard-only operation
- **WHEN** a keyboard user tabs into a date field
- **THEN** each segment SHALL be reachable, arrow keys SHALL step the focused segment, and the calendar button and its grid SHALL be reachable and operable without a pointer
