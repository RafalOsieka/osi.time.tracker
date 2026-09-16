# shared-ui-components Specification

## Purpose
Define the reusable, presentational UI building blocks shared across list/detail pages (table header, empty state, row actions, app-level confirm dialog, and locale-aware date formatting) so pages stay consistent, accessible, and free of duplicated markup/CSS.

## Requirements

### Requirement: REQ-127 Shared table template components
The application SHALL provide reusable presentational components for the recurring list-page sections: a table header (page title plus "New" button), an empty state (message plus create call-to-action), and row actions (edit and delete icon buttons). Each component SHALL receive all user-facing labels and `data-testid` values via props so pages keep their existing test and i18n contracts, and SHALL emit events (`create`, `edit`, `delete`) rather than performing any data access itself. Pages SHALL keep full ownership of their `UTable` markup and column definitions; the components SHALL NOT wrap `UTable`.

#### Scenario: Header rendered from props
- **WHEN** a page renders the table header component above its `UTable` with a title, button label, and testid
- **THEN** the header SHALL render the title and the "New" button with the supplied `data-testid`, and activating the button SHALL emit `create`

#### Scenario: Empty state rendered from props
- **WHEN** a list is empty and the empty-state component is rendered in the `UTable` empty slot
- **THEN** it SHALL render the supplied message and a CTA button with the supplied `data-testid`, and activating the CTA SHALL emit `create`

#### Scenario: Row actions are accessible
- **WHEN** the row-actions component renders for a row
- **THEN** the edit and delete buttons SHALL expose the supplied accessible names via `aria-label` and the supplied per-row `data-testid` values, and activating them SHALL emit `edit` / `delete`

#### Scenario: Row actions show matching tooltips
- **WHEN** the row-actions component renders for a row
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
The application SHALL provide a single shared confirmation pattern built on Nuxt UI's `useOverlay()` and a small in-house `ConfirmModal` component; pages SHALL NOT mount their own per-page confirm instances and SHALL trigger confirmation via the shared overlay with page-specific copy, receiving the user's accept/reject decision as a resolved promise.

#### Scenario: Page delete uses the shared confirm
- **WHEN** a user activates a delete action on any list page
- **THEN** the shared `ConfirmModal` SHALL open via `useOverlay()` with that page's header, message, and accept/reject labels, and deletion SHALL proceed only when the returned promise resolves as confirmed

### Requirement: REQ-130 Locale-aware shared date formatting
The application SHALL provide a single shared date-formatting utility for rendering ISO timestamp strings in tables, formatted according to the active i18n locale rather than only the browser default.

#### Scenario: Date cell follows active locale
- **WHEN** a `createdAt` value is rendered in a table with the active locale set to `pl`
- **THEN** the date SHALL be formatted using the `pl` locale conventions

#### Scenario: Invalid date input handled
- **WHEN** the utility receives an empty or unparsable string
- **THEN** it SHALL return an empty string rather than rendering "Invalid Date"

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

### Requirement: REQ-174 Nuxt UI components for overlay dialog forms and interactive items
Overlay dialogs (Nuxt UI `UModal` / `UPopover` bodies) that collect user input SHALL express their form using Nuxt UI's `UForm` bound to a Standard Schema (zod) `:schema`, consistent with the list/detail and settings pages, rather than a native `<form @submit.prevent>` element. Interactive result/list items rendered inside these dialogs (search-result rows, autocomplete suggestion labels) SHALL be Nuxt UI button components (e.g. `UButton variant="ghost"`) rather than native `<button>` elements. All existing `data-testid`, `id`, `<label for>`, `aria-*`, and `role="alert"` error wiring SHALL be preserved so current tests and accessibility contracts remain intact.

#### Scenario: Dialog form uses UForm with a schema
- **WHEN** a user opens the add-entry, bulk-assign, or remote-issue-picker dialog and submits it
- **THEN** submission SHALL be handled by a `UForm` bound to a zod schema, validation errors SHALL surface through the form's field/error mechanism, and no native `<form>` element SHALL own the submit handler

#### Scenario: Result and suggestion items are Nuxt UI buttons
- **WHEN** the remote-issue-picker renders search results, or a timer dialog renders autocomplete suggestions
- **THEN** each selectable item SHALL be a Nuxt UI button component exposing its existing per-item `data-testid`, and activating it SHALL emit the same selection behavior as before

#### Scenario: Invalid dialog input is reported through the form
- **WHEN** a required field (e.g. bulk-assign name) is empty or a value is invalid (e.g. add-entry end time before start time) on submit
- **THEN** the dialog SHALL block submission and surface the localized error via the form's error affordance, preserving the existing `role="alert"` announcement and `aria-describedby` association

#### Scenario: Test and a11y hooks unchanged
- **WHEN** the dialogs are normalized to `UForm` and `UButton`
- **THEN** every existing `data-testid`, field `id`, associated `<label>`, and error-announcement wiring SHALL remain unchanged

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

### Requirement: REQ-303 Shared compact expandable-row shell

The application SHALL provide a reusable compact expandable-row shell used by the timer view group header and by each Remote Sync day row. The shell SHALL own the two-tier layout: a single row at or above the authenticated shell desktop rail breakpoint, and two rows below it, with named regions for expansion control, primary title, secondary context, meta, duration, actions, and an indented expanded region. Call sites SHALL fill those regions via slots (or equivalent composition) and SHALL keep their own labels, `data-testid` values, and domain events. The shell SHALL NOT fetch data, SHALL NOT know about trackers or export, and SHALL NOT render a data table.

The expansion control SHALL be a compact icon button that exposes `aria-expanded` and `aria-controls` for the expanded region. The actions region SHALL accept an optional control and SHALL keep a stable width when empty so a later icon button can appear without shifting neighbors.

#### Scenario: Wide viewport is a single row

- **WHEN** the shell is rendered at or above the shell desktop rail breakpoint
- **THEN** expansion, title, secondary, meta, duration, and actions SHALL occupy one line without horizontal overflow

#### Scenario: Narrow viewport uses two lines

- **WHEN** the shell is rendered below the shell desktop rail breakpoint
- **THEN** expansion, title, duration, and actions SHALL occupy the first line and secondary plus meta the second, without horizontal overflow

#### Scenario: Empty actions slot keeps width

- **WHEN** the actions region is not given a control
- **THEN** neighboring regions SHALL NOT shift relative to a row that does render an icon button in that region

#### Scenario: Expansion is labelled for assistive technology

- **WHEN** assistive technology inspects the expansion control
- **THEN** it SHALL expose whether the row is expanded and which region it controls

#### Scenario: Timer and Remote Sync share the shell

- **WHEN** a timer group header and a Remote Sync task row are rendered
- **THEN** both SHALL use this shell for their collapsed layout and expanded indent

### Requirement: REQ-263 Full-width form controls in dialogs and settings
Overlay dialog forms (Nuxt UI `UModal` bodies that collect structured input, including project and tracker create/edit dialogs) and the `/settings` preferences surface SHALL render interactive form controls (`UInput`, `USelect`, `USelectMenu`, and equivalent Nuxt UI field controls) at full width of their form column. Form stacks SHALL use a consistent vertical grid gap. Project and tracker create/edit dialogs SHALL use a consistent modal content max-width appropriate for form dialogs (e.g. `sm:max-w-lg`). This requirement does not force full-width styling on dense inline editors (timer row inline edits, compact table cells) outside dialog and settings form contexts.

#### Scenario: Project dialog controls span the form width
- **WHEN** the project create/edit dialog is open
- **THEN** its name input and tracker select SHALL stretch to the full width of the form column

#### Scenario: Tracker dialog controls span the form width
- **WHEN** the tracker create/edit dialog is open
- **THEN** its text inputs and selects SHALL stretch to the full width of the form column

#### Scenario: Settings controls span the form width
- **WHEN** an authenticated user views `/settings`
- **THEN** preference selects and equivalent field controls SHALL stretch to the full width of the settings form column

#### Scenario: Inline dense editors are out of scope
- **WHEN** a timer entry title or similar inline editor is shown outside a dialog or settings form
- **THEN** this requirement SHALL NOT force that control to full page width

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

