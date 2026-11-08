## MODIFIED Requirements

### Requirement: REQ-374 Picking a project sets the project chip
Picking a project SHALL remove the `@` and query from the text, collapse leftover whitespace, and set the input's **project chip**: one project, named inside the field beside the text, with a remove control; a new pick replaces it. A set chip SHALL limit suggestions to its project (`GET /api/tasks?projectId=`) and make the create option read "{title} (new task in {project})". Picking a task suggestion SHALL set the chip to its project, or clear it. Editing the text SHALL keep the chip.

#### Scenario: Picked token is removed
- **WHEN** the user types `fix login @hel` and picks "Helios"
- **THEN** the input text SHALL be `fix login` and the chip SHALL show "Helios"

#### Scenario: Mention at the start
- **WHEN** the user types `@hel`, picks "Helios", then types `fix login`
- **THEN** the input text SHALL be `fix login` and the chip SHALL show "Helios"

#### Scenario: Picking again replaces the chip
- **WHEN** the chip shows "Helios" and the user mentions and picks "Nordwind"
- **THEN** the chip SHALL show only "Nordwind"

#### Scenario: Suggestions follow the chip
- **WHEN** the chip shows "Helios" and the user types `fix`
- **THEN** only tasks in "Helios" SHALL be suggested and the create option SHALL read "fix (new task in Helios)"

#### Scenario: Suggestion brings its project
- **WHEN** the user picks the suggestion "fix login · Nordwind #412"
- **THEN** the chip SHALL show "Nordwind"

#### Scenario: Removing the chip
- **WHEN** the user activates the chip's remove control
- **THEN** the chip SHALL be empty and suggestions SHALL no longer be filtered by project

#### Scenario: Chip placement per field
- **WHEN** a chip is set in the top-bar timer and in the add-entry dialog
- **THEN** the top-bar chip SHALL follow the title text, and the dialog chip SHALL precede it

#### Scenario: Remove control on a touch screen
- **WHEN** a chip is set on a device whose pointer cannot hover, such as a touch screen
- **THEN** its remove control SHALL be shown and tappable without a hover or a keyboard
