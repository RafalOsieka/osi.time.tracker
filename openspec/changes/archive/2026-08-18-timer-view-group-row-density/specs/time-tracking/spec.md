## ADDED Requirements

### Requirement: REQ-265 Timer view group and entry row density
On the timer view, each task group header and each expanded entry row SHALL keep its primary text inside a stable layout slot so long names do not overflow the row and so activating an inline editor does not shift neighboring controls.

When a group's task name, project context (including the localized "(no project)" placeholder), or an entry's title exceeds the space allocated to its slot, the visible text SHALL be truncated with an ellipsis. The complete string SHALL be available on pointer hover and on keyboard focus (a tooltip) and SHALL remain the control's accessible name. A value that already fits the slot SHALL omit the tooltip so the tip is not anchored to empty space in the slot. Activating a truncated title SHALL show the complete value in the editor.

On viewports at or above the authenticated shell's desktop rail breakpoint (frontend-shell REQ-066), a task group header SHALL occupy a single row. Below that breakpoint the header SHALL use two rows: expand control, entry-count indicator, title, group duration, and continue on the first row; project context and remote-issue chrome on the second. Entry rows SHALL remain a single row at both tiers. A group that contains the running entry SHALL NOT show a separate live-status phrase. That group SHALL show the same animated stop control as the shell timer widget; activating it SHALL stop the running entry. Idle groups keep the continue play control. The untitled "(no task)" group SHALL use the same title, project, and continue/stop controls as a named group; assigning a title SHALL reassign that day's untitled entries via the day-scoped reassignment operation. It SHALL NOT offer a separate bulk-assign button.

The group's entry count SHALL be shown as a compact numeric indicator immediately to the left of the task title, with a fixed width that does not grow with the count. Visible text SHALL be the integer when the count is 1–9 and a capped `9+` marker when the count is greater than 9. The localized count phrase (one vs many, using the actual count) SHALL remain the indicator's accessible name and SHALL NOT be required as visible text. A group with one entry SHALL still show the numeric indicator.

Group and entry duration values SHALL use the same monospace, tabular-numeral presentation as the shell running-timer elapsed display. Those totals SHALL NOT be activating controls.

Inline start and stop editors on an expanded entry SHALL display a complete `HH:mm` value without clipping. They SHALL continue to edit wall-clock time on the entry's existing local calendar day only; this requirement does not add a date control.

Typing into a title, project, or time editor SHALL NOT grow or shrink the reserved slot or the surrounding row.

#### Scenario: Long task name truncates with a full-name tooltip
- **WHEN** a task group's name is longer than the title slot
- **THEN** the visible title SHALL end with an ellipsis, and hover or keyboard focus SHALL expose the complete name

#### Scenario: Fitting task name has no tooltip
- **WHEN** a task group's name fits entirely in the title slot
- **THEN** the group SHALL NOT show a title tooltip

#### Scenario: Long project context truncates
- **WHEN** a group's project name or "(no project)" placeholder is longer than the project slot
- **THEN** the visible project text SHALL be truncated and the complete string SHALL be available on hover or focus

#### Scenario: Long entry title truncates
- **WHEN** an expanded entry's title is longer than its title slot
- **THEN** the visible title SHALL be truncated and the complete string SHALL be available on hover or focus

#### Scenario: Activating a truncated title shows the full value
- **WHEN** the user activates a truncated group or entry title
- **THEN** the editor SHALL contain the complete current value

#### Scenario: Wide viewport keeps a single-row group header
- **WHEN** the timer view is shown at or above the shell desktop rail breakpoint
- **THEN** the group header SHALL keep expand, count, title, project, duration, remote-issue chrome, and continue on one row without horizontal overflow

#### Scenario: Narrow viewport uses a two-line group header
- **WHEN** the timer view is shown below the shell desktop rail breakpoint
- **THEN** the group header SHALL place count, title, duration, and continue on the first row and project and remote-issue chrome on the second, without horizontal overflow

#### Scenario: Entry count is a numeric indicator
- **WHEN** a group contains two or more entries and at most nine
- **THEN** the header SHALL show a compact numeric indicator to the left of the title whose visible text is that integer and whose accessible name is the localized many-count phrase

#### Scenario: Single-entry group still shows the count indicator
- **WHEN** a group contains exactly one entry
- **THEN** the header SHALL still show the numeric indicator `1` to the left of the title with the localized singular count phrase as its accessible name

#### Scenario: Entry count above nine is capped
- **WHEN** a group contains more than nine entries
- **THEN** the indicator's visible text SHALL be `9+` and its accessible name SHALL still use the actual count

#### Scenario: Durations match the shell elapsed presentation
- **WHEN** a group total, entry duration, or day-heading total is rendered
- **THEN** it SHALL use the same monospace tabular-numeral presentation as the shell running-timer elapsed display and SHALL NOT be an activating control

#### Scenario: Live group uses the shell stop control
- **WHEN** a group contains the running entry
- **THEN** the group SHALL NOT show a separate live-status phrase, and the group action SHALL be the same animated stop control as the shell timer widget

#### Scenario: Live group stop stops the running entry
- **WHEN** the user activates the stop control on a live group
- **THEN** the running entry SHALL stop through the shared timer stop operation

#### Scenario: Untitled group uses the same chrome as a named group
- **WHEN** a day's untitled entries are grouped
- **THEN** the group SHALL show the same title, project, and continue/stop controls as a named group and SHALL NOT offer a separate bulk-assign button

#### Scenario: Untitled title assign is day-scoped reassign
- **WHEN** the user commits a title on the untitled group
- **THEN** that day's untitled entry ids SHALL be sent to the day-scoped reassignment operation with the new name

#### Scenario: Project assign is disabled without a title
- **WHEN** a group has no task name
- **THEN** the project control SHALL be disabled and its accessible name SHALL explain that a title is required first

#### Scenario: Inline time editor shows a full HH:mm
- **WHEN** the user activates an entry's start or stop time
- **THEN** the swapped-in time editor SHALL show the complete `HH:mm` value without clipping

#### Scenario: Inline time edit stays on the same local day
- **WHEN** the user commits a new start or stop time from the expanded row
- **THEN** the entry SHALL keep its previous local calendar day and only the wall-clock time SHALL change

#### Scenario: Activating an editor does not jump the layout
- **WHEN** the user activates a group title, group project, entry title, or entry time control
- **THEN** the reserved width of that control SHALL stay the same and neighboring controls SHALL NOT shift

#### Scenario: Typing does not resize the slot
- **WHEN** the user types a longer or shorter value in an active title, project, or time editor
- **THEN** the reserved slot and surrounding row SHALL NOT grow or shrink with the typed text
