## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: REQ-178 Inline-edit affordance uses a Nuxt UI input

Click-to-edit **text** fields (timer group and entry titles, Remote Sync title-to-send) SHALL express their editable affordance with a shared Nuxt UI `UInput` pattern — a seamless display state (`variant="none"`, styled like plain text) that becomes an editable state (`variant="ghost"`) on focus/activation — rather than a native `<button>` or a `UButton` styled with custom CSS to look like editable text. The group **project** control and Remote Sync **activity** control SHALL occupy a stable slot-owned `UButton` that opens a non-modal `UPopover` listbox on a single activation (not a `USelect`, whose dismiss overlay swallows the first click). Remote Sync **to-send duration** SHALL use the same compact time-slot pattern as timer entry start/stop: a none-variant `UInput` in the reserved slot that becomes the compact outlined `TimeInput` on activation. The affordance SHALL commit the normalized value on blur or Enter (text and duration) or on option activate (project/activity) and revert on Escape or invalid input (no model update, no request), preserving the existing behavior. It SHALL retain its accessible label and `data-testid`. The control SHALL occupy a stable layout slot whose width is determined by the surrounding layout, not by the current string length: dynamic `ch`-based sizing that grows or shrinks the control with the text SHALL NOT be used. When the display value exceeds the slot, the visible text SHALL be truncated. Activating the editor SHALL fill that same slot and SHALL NOT shift neighboring controls. No `<style scoped>` block SHALL be added to reset button chrome for this pattern.

Timer group and entry titles and Remote Sync title-to-send SHALL use the same shared inline-edit control. Project and activity remain the slot-owned button + popover. To-send duration shares the entry start/stop time slot.

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

- **WHEN** the compact time input is shown in an entry start/stop slot
- **THEN** it SHALL render as an outlined `UInput` that still fits the reserved slot

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
- **THEN** it SHALL use the same none-variant `UInput` slot as a timer entry start/stop control and SHALL become the compact outlined `TimeInput` on activation

#### Scenario: Remote Sync activity opens like project

- **WHEN** the user activates a Ready row's activity control
- **THEN** a non-modal popover listbox SHALL open on that activation and SHALL NOT require a second click
