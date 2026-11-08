## ADDED Requirements

### Requirement: REQ-515 The login password can be revealed
The login form's password field SHALL carry a toggle button that shows the typed password as plain text and masks it again. The toggle SHALL have a translated accessible name, expose its state through `aria-pressed`, and SHALL NOT submit the form or change the field's value.

#### Scenario: Password shown and hidden again
- **WHEN** the user activates the toggle in the password field and later activates it again
- **THEN** the password SHALL show as plain text after the first activation and be masked after the second, with `aria-pressed` following that state

#### Scenario: Toggle does not submit
- **WHEN** the user activates the toggle with empty or filled credentials
- **THEN** no login request SHALL be sent and the field's value SHALL stay as typed
