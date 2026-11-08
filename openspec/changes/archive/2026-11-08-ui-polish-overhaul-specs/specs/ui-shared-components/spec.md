## MODIFIED Requirements

### Requirement: REQ-178 Inline-edit affordance uses a Nuxt UI input
Timer group and entry titles and the Remote Sync title-to-send SHALL share one inline editor: plain text at rest on the Timer, a field at rest on Remote Sync. It SHALL commit the normalized value on blur or Enter and revert on Escape or invalid input without a model update or request. Its width SHALL come from the layout slot; overflow SHALL be truncated; activating it SHALL fill the same slot without shifting neighbors. It SHALL keep its accessible label and `data-testid`.

#### Scenario: Text field reads as plain text until edited

- **WHEN** a Timer group or entry title is displayed without focus
- **THEN** it SHALL render as seamless plain text with no border, ring, or button chrome

#### Scenario: Title to send reads as a field at rest

- **WHEN** a Ready row's title-to-send is displayed on Remote Sync without focus
- **THEN** it SHALL show a field frame that fills its column, and activating it SHALL keep the value in the same place

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
