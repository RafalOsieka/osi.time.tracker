## ADDED Requirements

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

## REMOVED Requirements

### Requirement: REQ-303 Shared compact expandable-row shell
**Reason**: The per-row shell sized each row's slots on its own, so columns did not line up across rows, days or expanded entries, and it switched layout on the viewport breakpoint instead of the list's width.
**Migration**: REQ-496 (column-aligned list and its semantics), REQ-497 (column widths), REQ-498 (cell edges), REQ-499 (headers) and REQ-500 (narrow layout).
