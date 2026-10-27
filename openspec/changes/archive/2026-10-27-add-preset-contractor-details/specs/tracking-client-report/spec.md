## ADDED Requirements

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
- **THEN** the export action SHALL read "save and export"

#### Scenario: Tooltip from the keyboard
- **WHEN** the user moves keyboard focus to the help control next to the contractor details label
- **THEN** the translated tooltip SHALL be shown and the control SHALL have a translated accessible name

#### Scenario: Input stops at the limit
- **WHEN** the user pastes 600 characters into the contractor details field
- **THEN** the field SHALL hold only the first 500 characters

### Requirement: REQ-513 Contractor details on the title page
When the exported preset has contractor details, the title page (REQ-388) SHALL print them directly below the contractor's email, in the same column and left-aligned with it, keeping their line breaks and wrapping long lines within the column. Without details nothing SHALL be added. The details SHALL NOT appear on table pages, in their running header or footer (REQ-474), or anywhere else in the PDF.

#### Scenario: Details below the email
- **WHEN** a preset with contractor details `NIP: 123-456-78-90` is exported
- **THEN** the title page SHALL show `NIP: 123-456-78-90` below the contractor's email

#### Scenario: Line breaks are kept
- **WHEN** the contractor details hold a tax ID line and an address line
- **THEN** the title page SHALL show them as two separate lines, both starting at the left edge of the contractor column

#### Scenario: No details
- **WHEN** a preset without contractor details is exported
- **THEN** the contractor block SHALL show only the contractor's name and email

#### Scenario: Table pages stay without details
- **WHEN** a preset with contractor details is exported and the report has table pages
- **THEN** no table page, running header or footer SHALL contain the details

## MODIFIED Requirements

### Requirement: REQ-386 Export assembles the report only from remote time logs
Export SHALL save the form (REQ-382), then fetch each preset tracker's own-account logs for the month with the browser secret, directly or via the extension. The report SHALL use only those logs, tracker name, type and URL, the preset, and the user's name and email — never OSI entries, tasks or provenance. While exporting, the action SHALL show a busy state and SHALL NOT start a second export.

#### Scenario: Two trackers are combined
- **WHEN** the preset has an OpenProject and a Redmine tracker with logs in the month
- **THEN** the PDF SHALL contain the logs of both trackers in one table

#### Scenario: Logs logged directly in the tracker are included
- **WHEN** a remote log was created in the tracker's own UI and never exported from OSI
- **THEN** it SHALL appear in the PDF like any other log
