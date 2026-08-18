## MODIFIED Requirements

### Requirement: REQ-131 Shared smart time input component
The application SHALL provide a reusable time-input component with an `HH:mm` string model (nullable) backed by a Nuxt UI `UInput` (numeric input mode) and a pure, unit-testable normalization function that forgivingly parses keyboard input into a valid `HH:mm` value. The parser SHALL apply these deterministic rules:

- one digit `H` → `0H:00` (e.g. `9` → `09:00`);
- two digits forming a valid hour (`00`–`23`) → that hour with `:00` (e.g. `23` → `23:00`);
- two digits `DD` not forming a valid hour, where the second digit is `0`–`5` → `0D:D0` (hour + tens of minutes, e.g. `93` → `09:30`); otherwise invalid (e.g. `59`);
- three digits `HMM` → `0H:MM` (e.g. `900` → `09:00`);
- four digits `HHMM` → `HH:MM` (e.g. `1234` → `12:34`);
- a trailing colon SHALL be ignored, with the preceding digits parsed by the rules above (e.g. `123:` → `01:23`);
- colon-separated parts SHALL be zero-padded (e.g. `9:5` → `09:05`);
- values out of range (hour > 23 or minute > 59, e.g. `25:00`, `12:66`) SHALL be invalid;
- surrounding whitespace SHALL be ignored.

The component SHALL commit the normalized value on blur or Enter and cancel on Escape; input that cannot be normalized SHALL silently revert the field to the previous value without emitting a model update and without sending any request. The component SHALL accept an accessible label and `data-testid` via props, and SHALL be the single time-entry input used wherever the UI accepts an `HH:mm` time typed by the user.

When the component is presented in a compact inline context, a committed `HH:mm` value SHALL be fully visible without clipping. Compact presentation SHALL reserve enough space for that five-character value together with the control's own padding and border.

#### Scenario: Compact digits normalized on commit
- **WHEN** the user types `900` and blurs the field or presses Enter
- **THEN** the model SHALL update to `09:00`

#### Scenario: Two digits prefer a valid hour
- **WHEN** the user types `23` and commits
- **THEN** the model SHALL update to `23:00`

#### Scenario: Two digits fall back to hour plus tens of minutes
- **WHEN** the user types `93` and commits
- **THEN** the model SHALL update to `09:30`

#### Scenario: Invalid input silently reverts
- **WHEN** the user types `59` or `12:66` and commits
- **THEN** the field SHALL revert to the previous value, the model SHALL NOT update, and no request SHALL be sent

#### Scenario: Escape cancels the edit
- **WHEN** the user presses Escape while editing
- **THEN** the field SHALL revert to the previous value and the model SHALL NOT update

#### Scenario: Compact presentation shows a full HH:mm
- **WHEN** the compact time input displays a committed value such as `09:00`
- **THEN** all five characters SHALL be visible without clipping

### Requirement: REQ-178 Inline-edit affordance uses a Nuxt UI input
Click-to-edit **title** fields SHALL express their editable affordance with a Nuxt UI `UInput` — a seamless display state (`variant="none"`, styled like plain text) that becomes an editable state (`variant="ghost"`) on focus/activation — rather than a native `<button>` or a `UButton` styled with custom CSS to look like editable text. The group **project** control SHALL occupy a stable slot-owned `UButton` that opens a non-modal `UPopover` listbox on a single activation (not a `USelect`, whose dismiss overlay swallows the first click). The affordance SHALL commit the normalized value on blur or Enter (titles) or on option activate (project) and revert on Escape or invalid input (no model update, no request), preserving the existing behavior. It SHALL retain its accessible label and `data-testid`. The control SHALL occupy a stable layout slot whose width is determined by the surrounding layout, not by the current string length: dynamic `ch`-based sizing that grows or shrinks the control with the text SHALL NOT be used. When the display value exceeds the slot, the visible text SHALL be truncated. Activating the editor SHALL fill that same slot and SHALL NOT shift neighboring controls. No `<style scoped>` block SHALL be added to reset button chrome for this pattern.

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
