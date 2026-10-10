# ui-shared-components Specification

## Purpose
Define the reusable UI building blocks shared across pages — list-page sections, truncated text, the confirm dialog, date formatting, clock-time, duration and date fields, inline editing, and the compact expandable row — so pages stay consistent and accessible without duplicated markup.

## Requirements

### Requirement: REQ-127 Shared table template components
List pages SHALL share reusable sections: a table header (page title plus "New" button), an empty state (message plus create call-to-action), and row actions (edit and delete icon buttons). The sections SHALL take their labels and `data-testid` values from the page, SHALL report create, edit and delete to the page instead of accessing data themselves, and SHALL NOT own the page's table.

#### Scenario: Header rendered from props
- **WHEN** a page renders the table header above its table with a title, button label, and testid
- **THEN** the header SHALL render the title and the "New" button with the supplied `data-testid`, and activating the button SHALL report a create

#### Scenario: Empty state rendered from props
- **WHEN** a list is empty and the empty-state section is rendered in the table's empty slot
- **THEN** it SHALL render the supplied message and a CTA button with the supplied `data-testid`, and activating the CTA SHALL report a create

#### Scenario: Row actions are accessible
- **WHEN** the row actions render for a row
- **THEN** the edit and delete buttons SHALL expose the supplied accessible names and per-row `data-testid` values, and activating them SHALL report edit / delete

#### Scenario: Row actions show matching tooltips
- **WHEN** the row actions render for a row
- **THEN** pointer hover or keyboard focus on the edit or delete button SHALL show a themed tooltip whose text matches that button's accessible name

### Requirement: REQ-270 Shared truncated-text tooltip
The application SHALL provide a reusable truncated-text hint for slots that ellipsize their displayed value. When the value overflows the slot, pointer hover and keyboard focus SHALL expose the complete string as a themed tooltip (REQ-269). When the value fits the slot, the tooltip SHALL be omitted. Call sites SHALL keep their existing accessible names and `data-testid` hooks.

#### Scenario: Overflowing slot shows the full value
- **WHEN** a slot using the shared truncated-text hint displays a value longer than the allocated space
- **THEN** the visible text SHALL end with an ellipsis, and pointer hover or keyboard focus SHALL show the complete string

#### Scenario: Fitting slot omits the tooltip
- **WHEN** a slot using the shared truncated-text hint displays a value that fits entirely
- **THEN** the slot SHALL NOT show a tooltip

### Requirement: REQ-129 Single app-level confirm dialog
The application SHALL provide one shared confirmation dialog. Pages SHALL NOT mount their own confirm instances; they SHALL open the shared one with page-specific copy and receive the user's accept or reject decision.

#### Scenario: Page delete uses the shared confirm
- **WHEN** a user activates a delete action on any list page
- **THEN** the shared confirm dialog SHALL open with that page's header, message, and accept/reject labels, and deletion SHALL proceed only when the user confirms

### Requirement: REQ-130 Locale-aware shared date formatting
The application SHALL provide a single shared date-formatting utility for rendering ISO timestamp strings in tables, formatted according to the active i18n locale rather than only the browser default.

#### Scenario: Date cell follows active locale
- **WHEN** a `createdAt` value is rendered in a table with the active locale set to `pl`
- **THEN** the date SHALL be formatted using the `pl` locale conventions

#### Scenario: Invalid date input handled
- **WHEN** the utility receives an empty or unparsable string
- **THEN** it SHALL return an empty string rather than rendering "Invalid Date"

### Requirement: REQ-361 Segmented clock-time field is the single clock-time entry mechanism
Every wall-clock time input SHALL use one shared segmented hour–minute field, and every start–end pair its range variant (two groups, one label). It SHALL always show a 24-hour clock with two-digit segments and no seconds. Typing fills a segment and advances; arrow keys step and Backspace clears it. Replacing a text input SHALL keep its height, label, `id`, `data-testid` (on the root) and `aria-*` wiring; in rows it SHALL take a fixed width. Labels SHALL have `en`/`pl` parity.

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

#### Scenario: Swap preserves height and layout
- **WHEN** a text time input in a dialog form or entry row is replaced by the segmented field
- **THEN** the control's rendered height and the surrounding grid or row SHALL be unchanged, and in a row the field SHALL occupy the same fixed width whether the entry has an end time or not

#### Scenario: Keyboard-only operation
- **WHEN** a keyboard user tabs into a time field
- **THEN** each segment SHALL be reachable, arrow keys SHALL step the focused segment, and Enter and Escape SHALL commit and cancel as specified

### Requirement: REQ-429 Clock-time field value is structured and never guessed
The clock-time field's value SHALL be a structured date-time, not a string. Editing a segment of a value seeded from an instant SHALL change only that segment, keeping its calendar date, seconds and milliseconds. The field SHALL never hold an invalid time; a partially filled side SHALL report `null`, which the owner SHALL treat as incomplete and block its action.

#### Scenario: Editing a segment preserves the untouched parts
- **WHEN** the field is seeded from `10:42:31.812` on 12 March and the user changes the minute segment to `45`
- **THEN** the resulting value SHALL be `10:45:31.812` on 12 March — same date, seconds, and milliseconds

#### Scenario: Range field with no end
- **WHEN** a range field is seeded with a start and no end
- **THEN** the start segments SHALL be filled, the end segments SHALL show placeholders, and the model SHALL report the end as `null`

#### Scenario: Incomplete side reports null
- **WHEN** the user clears the minute segment of a filled field
- **THEN** the model for that side SHALL be `null` and any dependent action (save, submit, patch) SHALL be blocked by the owner's existing inline handling rather than acting on a partial time

### Requirement: REQ-430 Clock-time field shows a timezone only on offset transitions
For a zoned value, the field SHALL hide the timezone abbreviation unless either bound's calendar date has an offset transition in that bound's timezone, including when a range spans two dates. Hiding it SHALL NOT drop the timezone or change conversion back to an instant. Plain times and unzoned date-times SHALL NOT get a timezone label.

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

### Requirement: REQ-431 Clock-time field commit styles
The field SHALL support a live binding that updates the owner on every segment change (forms with a submit action), and an inline contract that commits only when focus leaves the whole field or on Enter, and restores the last committed value on Escape. Moving between the field's own segments, including between range groups, SHALL NOT count as leaving it. An inline commit equal to the last committed value SHALL be reported as unchanged, and an incomplete range SHALL NOT trigger an update.

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

### Requirement: REQ-432 Optional same-minute inversion clamp
A range field MAY enable clamping, off by default. When enabled and a commit would leave start and end in the same calendar minute with the start's seconds later than the end's, the field SHALL copy the seconds and milliseconds of the other bound onto the bound the user edited before committing, so the pair is ordered (zero length) and matches what the segments show.

#### Scenario: Same-minute inversion is clamped
- **WHEN** clamping is enabled, the range is `10:42:50 – 10:43:10`, and the user changes the start minute to `43`
- **THEN** the committed start SHALL be `10:43:10` (the end's seconds), the pair SHALL be ordered with zero length, and the segments SHALL still display `10:43 – 10:43`

#### Scenario: Clamping is off by default
- **WHEN** clamping is not enabled and the same edit is committed
- **THEN** the field SHALL emit the inverted pair unchanged and leave validation to the owner

### Requirement: REQ-362 Shared duration input component
Every typed duration SHALL use one shared input with a nullable `HH:MM:SS` model (wall-clock times use REQ-361). Input SHALL be normalized deterministically: one to three colon-separated numbers read as `H:MM:SS`, `H:MM` or bare minutes; parts zero-padded on output (`1:5` → `01:05:00`); minutes or seconds above `59` (including a bare number above `59`) invalid; hours unbounded, so a duration MAY exceed 24 hours; surrounding whitespace ignored; anything else invalid.

#### Scenario: Bare minutes normalized on commit
- **WHEN** the user types `45` and blurs the field or presses Enter
- **THEN** the model SHALL update to `00:45:00`

#### Scenario: Hours are unbounded
- **WHEN** the user types `26:15` and commits
- **THEN** the model SHALL update to `26:15:00`

### Requirement: REQ-433 Duration input commits, reverts and fits compact slots
The duration input SHALL take its accessible label and `data-testid` from its owner, commit the normalized value on blur or Enter, and cancel on Escape. Input that cannot be normalized SHALL silently revert to the previous value, with no model update and no request. In a compact inline context a committed value SHALL be fully visible: the control SHALL reserve room for eight `HH:MM:SS` characters plus its own padding and border.

#### Scenario: Invalid input silently reverts
- **WHEN** the user types `1:75` or `abc` and commits
- **THEN** the field SHALL revert to the previous value, the model SHALL NOT update, and no request SHALL be sent

#### Scenario: Escape cancels the edit
- **WHEN** the user presses Escape while editing
- **THEN** the field SHALL revert to the previous value and the model SHALL NOT update

#### Scenario: Compact presentation shows a full HH:MM:SS
- **WHEN** the compact duration input displays a committed value such as `01:30:00`
- **THEN** all eight characters SHALL be visible without clipping

### Requirement: REQ-178 Inline-edit affordance uses a Nuxt UI input
Timer group and entry titles and the Remote Sync title-to-send SHALL share one inline editor that reads as plain text until activated. It SHALL commit the normalized value on blur or Enter and revert on Escape or invalid input without a model update or request. Its width SHALL come from the layout slot, not the text length; overflow SHALL be truncated; activating the editor SHALL fill the same slot without shifting neighbors. It SHALL keep its accessible label and `data-testid`.

#### Scenario: Text field reads as plain text until edited

- **WHEN** an inline-editable title field is displayed without focus
- **THEN** it SHALL render as seamless plain text with no border, ring, or button chrome

#### Scenario: Field becomes editable on activation and commits

- **WHEN** the user focuses a title field, edits the value, and blurs or presses Enter
- **THEN** the field SHALL present an editable input and SHALL commit the normalized value

#### Scenario: Invalid input or Escape reverts without side effects

- **WHEN** the user presses Escape or enters a value that cannot be normalized
- **THEN** the field SHALL revert to the previous value, SHALL NOT emit a model update, and SHALL NOT send a request

#### Scenario: Display width is not content-sized

- **WHEN** an inline-editable title or project field is displayed
- **THEN** its reserved width SHALL come from the surrounding layout slot and SHALL NOT be derived from the current string length

#### Scenario: Activating the editor keeps the same slot

- **WHEN** the user activates an inline-editable title or project field
- **THEN** the editor SHALL occupy the same reserved width as the display state and neighboring controls SHALL NOT shift

### Requirement: REQ-434 Inline pickers, compact duration slot and permanent time fields
The timer group's project control and the Remote Sync activity control SHALL open a non-modal listbox popover on a single activation, committing on option activation. The Remote Sync to-send duration SHALL sit in a compact slot that reads as text and becomes the compact outlined duration input (REQ-433) on activation. Timer entry start/stop times SHALL be the segmented time field (REQ-361) shown permanently as plain text, with segments highlighted only on focus, not a display/editor swap.

#### Scenario: Project listbox opens on one click

- **WHEN** the user activates a group's project control
- **THEN** a non-modal popover listbox SHALL open on that activation and SHALL NOT require a second click

#### Scenario: Remote Sync activity opens like project

- **WHEN** the user activates a Ready row's activity control
- **THEN** a non-modal popover listbox SHALL open on that activation and SHALL NOT require a second click

#### Scenario: Compact time editor is an outlined input

- **WHEN** the compact duration input is shown in the Remote Sync to-send slot
- **THEN** it SHALL render as an outlined input that still fits the reserved slot

#### Scenario: Remote Sync duration uses the compact time-slot pattern

- **WHEN** a Ready Remote Sync row's to-send value is displayed without focus
- **THEN** it SHALL read as plain text in its slot and SHALL become the compact outlined duration input on activation

#### Scenario: Entry time field needs no activation step

- **WHEN** an expanded entry row is displayed
- **THEN** its start/stop control SHALL already be the segmented time field, reading as plain text until a segment is focused, and a single click on a segment SHALL make that segment editable

### Requirement: REQ-359 Nuxt UI date components are the single date-entry mechanism
Every date input SHALL use the shared segmented date field, never a native date input; its range variant for inclusive ranges (one control, one label), and the bare calendar grid for a "jump to a date" picker. Each field SHALL have a labelled calendar button; picking a day fills the field. Segment order follows the locale; the year has four digits. Replacing a native input SHALL keep its height, label, `id`, `data-testid` and `aria-*` wiring. Calendar labels SHALL have `en`/`pl` parity.

#### Scenario: Locale changes segment order, not the value
- **WHEN** the same date is shown while the active locale is `en`
- **THEN** the segments SHALL be presented in that locale's order (month before day) while the model stays `2026-09-07`

#### Scenario: Calendar affordance fills the field
- **WHEN** the user activates the field's calendar button and chooses a day in the calendar grid
- **THEN** the popover SHALL close, the field's segments SHALL show that day, and the model SHALL update to it

#### Scenario: Swap preserves layout and selectors
- **WHEN** a native date input in a dialog form is replaced by the segmented field
- **THEN** the control's rendered height and the form's grid SHALL be unchanged, and the pre-existing `data-testid`, `id`, and `<label for>` wiring SHALL still resolve to the new control

#### Scenario: Keyboard-only operation
- **WHEN** a keyboard user tabs into a date field
- **THEN** each segment SHALL be reachable, arrow keys SHALL step the focused segment, and the calendar button and its grid SHALL be reachable and operable without a pointer

### Requirement: REQ-435 Date field value and typing
A date field SHALL give its owner a local calendar day as `YYYY-MM-DD`, or `null` when incomplete, never a time of day or timezone. Typing digits fills a segment and advances; arrow keys step and Backspace clears it. The field SHALL never hold an invalid date, and a partially filled field SHALL report `null`. Optional minimum and maximum bounds SHALL prevent both typing and picking a day outside them.

#### Scenario: Digits fill segments in locale order
- **WHEN** the active locale is `pl` and the user focuses an empty date field and types `0` `7` `0` `9` `2` `0` `2` `6`
- **THEN** the field SHALL show `07.09.2026`, the model SHALL be `2026-09-07`, and no separate commit action SHALL be required

#### Scenario: Incomplete date reports null
- **WHEN** the user clears the year segment of a filled date field
- **THEN** the model SHALL be `null` and any dependent action (save, navigate, scan) SHALL be blocked with its existing inline validation rather than acting on a partial date

#### Scenario: Out-of-range segment value is constrained
- **WHEN** the user types `3` `5` into the day segment
- **THEN** the field SHALL NOT produce day `35`; it SHALL keep a valid day and the model SHALL never contain an invalid calendar date

#### Scenario: Range field reports both ends
- **WHEN** the user fills both the start and end segments of a date-range field
- **THEN** the model SHALL expose `{ start, end }` as two `YYYY-MM-DD` values; an inverted pair (start after end) SHALL still be representable so the owning feature can show its own inline error

### Requirement: REQ-403 Full-width form controls in dialogs and the profile page
Form controls in overlay dialogs that collect structured input (including the project and tracker create/edit dialogs) and on `/profile` SHALL span the full width of their form column, with a consistent vertical gap between fields. The project and tracker dialogs SHALL share one form-dialog maximum width. This does not apply to dense inline editors outside dialogs and the profile form.

#### Scenario: Project dialog controls span the form width
- **WHEN** the project create/edit dialog is open
- **THEN** its name input and tracker select SHALL stretch to the full width of the form column

#### Scenario: Tracker dialog controls span the form width
- **WHEN** the tracker create/edit dialog is open
- **THEN** its text inputs and selects SHALL stretch to the full width of the form column

#### Scenario: Profile controls span the form width
- **WHEN** an authenticated user views `/profile`
- **THEN** the display name input, the timezone and language selects, and equivalent field controls SHALL stretch to the full width of the profile form column

#### Scenario: Inline dense editors are out of scope
- **WHEN** a timer entry title or similar inline editor is shown outside a dialog or profile form
- **THEN** this requirement SHALL NOT force that control to full page width

### Requirement: REQ-496 Shared column-aligned expandable list
The Timer view and the Remote Sync day page SHALL each render their rows as one column-aligned expandable list. The list SHALL define its columns once, and every row in it (headings, expandable rows, their detail rows and status rows) SHALL place each value in its column, so a column's start and end edges are the same in every row. The list SHALL expose table semantics: rows, cells and column headers. An expansion control SHALL expose its state and the region it controls.

#### Scenario: Values line up across rows
- **WHEN** the list shows several rows in its column layout
- **THEN** each column's content SHALL start at the same horizontal position in every row, and durations SHALL share one end edge

#### Scenario: Expanded rows use the parent's columns
- **WHEN** a row is expanded and shows detail rows
- **THEN** each detail value SHALL sit in one of the list's columns, sharing that column's edges with the collapsed rows

#### Scenario: Empty action cell keeps its width
- **WHEN** one row renders an icon button in its action cell and another row renders none
- **THEN** every other column SHALL keep the same edges in both rows

#### Scenario: Expansion is labelled for assistive technology
- **WHEN** assistive technology inspects an expansion control
- **THEN** it SHALL expose whether the row is expanded and which region it controls

#### Scenario: Assistive technology reads a table
- **WHEN** assistive technology inspects the list
- **THEN** it SHALL be exposed as a table whose rows contain cells and whose columns have headers

### Requirement: REQ-497 Column widths follow only the list width
Column widths SHALL depend only on the list's own width, never on row content. Columns for predictable content (icons, counts, issue numbers, times, durations, actions) SHALL keep a fixed width; text columns SHALL share the remaining width in fixed proportions, each above a minimum. Text longer than its column SHALL be truncated with an ellipsis, with the full text on hover and focus.

#### Scenario: Editing does not resize columns
- **WHEN** the user activates or types in an inline editor, or a row gains a longer value such as a five-digit issue number
- **THEN** no column of the list SHALL change its width

#### Scenario: More rows do not resize columns
- **WHEN** more rows load, including rows whose text is longer than any shown before
- **THEN** no column of the list SHALL change its width

#### Scenario: A state change does not resize columns
- **WHEN** a row changes state, for example from loading to ready
- **THEN** no column of the list SHALL change its width

#### Scenario: A width change rescales text columns only
- **WHEN** the list's own width changes, for example because the sidebar is collapsed or resized
- **THEN** text columns SHALL resize in their fixed proportions, not below their minimum, and fixed-width columns SHALL keep their width

#### Scenario: Long text is truncated
- **WHEN** a cell's text is longer than its column
- **THEN** it SHALL end with an ellipsis and its full text SHALL be available on hover and focus

### Requirement: REQ-498 Cell content starts on its column edge
In every cell the first character or icon of the content SHALL sit on the column's start edge, level with that column's header label, whether the cell holds plain text, an inline editor, a picker button or an icon control. A control's padding, hover fill and edit-mode frame MAY extend into the gap before the column. Activating or editing a control SHALL NOT move its text.

#### Scenario: Editable text lines up with the header
- **WHEN** a column holds an inline editor or a picker button that reads as plain text
- **THEN** its first character SHALL be level with the column header's first character

#### Scenario: Icon control lines up with the header
- **WHEN** a cell holds only an icon control, such as an unlinked-issue icon
- **THEN** the icon's left edge SHALL be level with the column header's first character

#### Scenario: Editing keeps the text in place
- **WHEN** the user activates an inline editor in a cell
- **THEN** the text SHALL stay at the same position and neighboring cells SHALL NOT shift

### Requirement: REQ-499 Column headers stay visible
In the column layout, a header row SHALL label the list's columns and SHALL stay visible at the top of the scrolling area while the list scrolls. A column whose content is only an icon MAY have a header that only assistive technology reads. In the narrow layout (REQ-500) the headers SHALL be available to assistive technology only.

#### Scenario: Headers label the columns
- **WHEN** the list is shown in its column layout
- **THEN** a header row SHALL name each text and duration column above its content

#### Scenario: Headers stay visible while scrolling
- **WHEN** the user scrolls the page so that the list's first rows leave the viewport
- **THEN** the header row SHALL remain visible at the top of the scrolling area

#### Scenario: Narrow list keeps headers for assistive technology
- **WHEN** the list uses the narrow layout
- **THEN** no header row SHALL be visible and assistive technology SHALL still read the column headers

### Requirement: REQ-500 Narrow list layout
When the list itself is narrower than 40rem (640 CSS pixels at the default font size), each row SHALL wrap onto several lines without horizontal overflow. Durations and actions SHALL keep a fixed right edge shared by all rows, and every line after the first SHALL start at the title's edge. The layout SHALL follow the list's own width, not the viewport's.

#### Scenario: Phone uses the narrow layout
- **WHEN** the list is shown on a phone-sized viewport
- **THEN** rows SHALL wrap onto several lines without horizontal overflow

#### Scenario: A narrow list on a wide screen wraps
- **WHEN** the viewport is wide but the list is narrower than 40rem, for example because the sidebar is widened
- **THEN** the list SHALL use the narrow layout

#### Scenario: A wide list on a small screen keeps its columns
- **WHEN** the viewport is tablet-sized and the list is at least 40rem wide
- **THEN** the list SHALL keep its column layout

#### Scenario: Narrow rows share the right edge
- **WHEN** several rows are shown in the narrow layout
- **THEN** their durations SHALL share one end edge and their action controls one column
