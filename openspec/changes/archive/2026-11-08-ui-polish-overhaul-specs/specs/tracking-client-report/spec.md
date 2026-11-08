## MODIFIED Requirements

### Requirement: REQ-384 Client report page and month selection
The private `/reports/client` page SHALL use the shared page header with month controls. The month SHALL default to the current one in the user's timezone, live in the `month=YYYY-MM` query and change with previous/next. An invalid `month` SHALL show a translated error and disable export. A summary SHALL show the form's facts live, without a request. The global guard SHALL redirect unauthenticated visitors.

#### Scenario: Default month
- **WHEN** an authenticated user opens `/reports/client` without a `month` query
- **THEN** the page SHALL select the current month in the effective timezone and write it to the URL

#### Scenario: Next month
- **WHEN** the user activates next month while viewing `2026-09`
- **THEN** the URL SHALL become `month=2026-10`

#### Scenario: Invalid month
- **WHEN** the query is `month=2026-13`
- **THEN** the page SHALL show a translated error and the export action SHALL be disabled

#### Scenario: Unauthenticated access
- **WHEN** an unauthenticated visitor requests `/reports/client`
- **THEN** the guard SHALL redirect to `/login` with that path as the redirect target

#### Scenario: Summary follows the form
- **WHEN** the user types a client name and checks a Tracker
- **THEN** the summary SHALL show that client name, the selected month, the checked Trackers, the hours format and the PDF language without any request

#### Scenario: Empty facts read as not set
- **WHEN** the client name is empty or no Tracker is checked
- **THEN** the summary SHALL show that fact as not set

### Requirement: REQ-385 Preset selection and inline preset form
The page SHALL load the user's presets (REQ-381), preselecting the most recently used, with a selector whose last option, "new preset", switches to an unsaved one. The inline form SHALL hold the client name, a checkbox list of active trackers, hours format (`H:MM` or decimal) and PDF language (`en` or `pl`); a new preset starts empty with `decimal` and the UI locale. A preset with inactive trackers SHALL warn how many were removed. The selected preset SHALL be deletable after confirmation.

#### Scenario: Last used preset is preselected
- **WHEN** the user has presets A and B and B was used last
- **THEN** the page SHALL open with B selected and its values in the form

#### Scenario: First visit
- **WHEN** the user has no presets and the UI locale is `en`
- **THEN** the selector SHALL show "new preset", the form SHALL be empty with hours format `decimal` and PDF language `en`, and the export action SHALL read "save preset and download PDF"

#### Scenario: New preset from the selector
- **WHEN** the user picks "new preset" in the selector
- **THEN** the form SHALL reset to the first-visit defaults without any request

#### Scenario: Removed tracker warning
- **WHEN** the selected preset reports one inactive tracker
- **THEN** the page SHALL show a translated warning and the form SHALL list only active trackers

#### Scenario: Trackers show their type
- **WHEN** the checkbox list of trackers or the summary's trackers are shown
- **THEN** each tracker SHALL show its system type with its name, as on the Projects and Trackers pages

### Requirement: REQ-473 Export label and form validation
As export saves the preset first (REQ-386), the export action SHALL read "save preset and download PDF" while the form holds a new or changed preset, and "download PDF" otherwise. The form SHALL validate as REQ-380 does, with translated field errors before any request.

#### Scenario: Export label follows unsaved changes
- **WHEN** a saved preset is selected unchanged, and the user then edits its client name
- **THEN** the export action SHALL read "download PDF" before the edit and "save preset and download PDF" after it

#### Scenario: Invalid form blocks export
- **WHEN** the client name is empty or no tracker is checked
- **THEN** the export action SHALL show translated field errors and SHALL NOT call any API or tracker

### Requirement: REQ-512 Contractor details field in the preset form
The inline preset form (REQ-385) SHALL hold a multiline contractor details field directly below the client name, where Enter inserts a line break and the input stops at 500 characters. Next to its label a keyboard-operable help control SHALL show a translated tooltip saying the text appears on the PDF title page below the contractor's name and email. A new preset starts with empty details; editing them counts as an unsaved change (REQ-473).

#### Scenario: Saved preset shows its details
- **WHEN** the user selects a preset whose contractor details are `NIP: 123-456-78-90`
- **THEN** the field SHALL show `NIP: 123-456-78-90`

#### Scenario: New preset starts empty
- **WHEN** the user picks "new preset" in the selector after viewing a preset with contractor details
- **THEN** the contractor details field SHALL be empty

#### Scenario: Editing details changes the export label
- **WHEN** a saved preset is selected unchanged and the user adds a line to its contractor details
- **THEN** the export action SHALL read "save preset and download PDF"

#### Scenario: Tooltip from the keyboard
- **WHEN** the user moves keyboard focus to the help control next to the contractor details label
- **THEN** the translated tooltip SHALL be shown and the control SHALL have a translated accessible name

#### Scenario: Input stops at the limit
- **WHEN** the user pastes 600 characters into the contractor details field
- **THEN** the field SHALL hold only the first 500 characters

#### Scenario: Label says the field is optional
- **WHEN** the preset form is shown
- **THEN** the contractor details label SHALL carry a translated "optional" hint, unlike the required client name
