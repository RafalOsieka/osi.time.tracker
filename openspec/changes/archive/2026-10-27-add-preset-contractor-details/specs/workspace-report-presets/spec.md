## ADDED Requirements

### Requirement: REQ-511 Report preset contractor details
A report preset SHALL hold optional contractor details: free text of at most 500 characters after trimming leading and trailing whitespace, keeping inner line breaks and indentation. Blank or omitted details SHALL be stored as none. Create and update (REQ-382) SHALL store them, update replacing them like every other field, and the preset list (REQ-381) SHALL return them, or `null` when there are none. Oversized details SHALL be rejected per REQ-380.

#### Scenario: Multiline details are stored
- **WHEN** the user saves a preset with contractor details `NIP: 123-456-78-90` and `ul. Długa 1` on two lines
- **THEN** the preset list SHALL return exactly those two lines for that preset

#### Scenario: Surrounding whitespace is trimmed
- **WHEN** the user saves contractor details with leading spaces and trailing blank lines
- **THEN** the stored details SHALL start and end with their first and last visible characters

#### Scenario: Blank details mean none
- **WHEN** the user saves a preset with contractor details made only of spaces and line breaks
- **THEN** the preset list SHALL return `null` details for that preset

#### Scenario: Update without details clears them
- **WHEN** a preset has contractor details and the user patches it without the field
- **THEN** the preset list SHALL return `null` details for that preset

#### Scenario: Oversized details
- **WHEN** the contractor details are longer than 500 characters after trimming
- **THEN** the request SHALL be rejected with 422 and a translated `messageKey`, and nothing SHALL be stored
