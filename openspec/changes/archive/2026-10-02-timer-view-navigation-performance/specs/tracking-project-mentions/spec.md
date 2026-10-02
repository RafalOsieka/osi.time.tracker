## MODIFIED Requirements

### Requirement: REQ-372 Mention trigger switches the title overlay into project mode
The title autocompletes of the top-bar timer widget (REQ-070) and the add-entry dialog (REQ-396) SHALL recognise a **mention token**: an `@` character that is the first character of the input or is immediately preceded by whitespace, followed by the text up to the caret (the **mention query**). An `@` preceded by any non-whitespace character (for example inside `jan@firma.pl`) SHALL NOT start a mention token.

While the caret is inside a mention token and at least one of the user's projects matches its query (REQ-373), the existing title overlay SHALL switch to **project mode**: it SHALL list matching projects instead of task suggestions and the create-new-task option, under a localized "Projects" group label. Each listed project SHALL show its name followed by its tracker name when it has one, so projects with the same name on different trackers can be told apart. It SHALL show at most 5 projects, and the first one SHALL be keyboard-highlighted. The mention query MAY contain spaces. When the query matches no project, the overlay SHALL return to its normal task mode and the text SHALL remain as typed. Project mode SHALL NOT use a second popup or a caret-anchored tooltip. It reuses the title overlay, so keyboard navigation, Enter and Escape keep their autocomplete semantics. Pressing Escape in project mode SHALL close the overlay and keep the typed token as literal text. Pressing Enter while the project-mode overlay is open SHALL pick the highlighted project and SHALL NOT start the timer (REQ-146).

Projects SHALL come from the user's own non-deleted projects (REQ-084). The list SHALL be loaded when the title input gains focus (top bar) or when the dialog opens. A failed load SHALL leave project mode unavailable without an error toast, so every `@` stays literal text.

#### Scenario: @ at the start opens project mode
- **WHEN** the user types `@hel` into an empty title input and owns a project named "Helios"
- **THEN** the overlay SHALL show the "Projects" group listing "Helios" with it highlighted, and SHALL NOT show task suggestions or the create-new-task option

#### Scenario: @ after a space opens project mode
- **WHEN** the user types `fix login @hel`
- **THEN** the overlay SHALL be in project mode for the query `hel`

#### Scenario: @ inside a word is literal
- **WHEN** the user types `reply to jan@firma.pl`
- **THEN** the overlay SHALL stay in task mode and no mention token SHALL be recognised

#### Scenario: Query with spaces keeps matching
- **WHEN** the user types `@project ex` and owns "Project Example"
- **THEN** the overlay SHALL remain in project mode and list "Project Example"

#### Scenario: No match falls back to task mode
- **WHEN** the mention query matches none of the user's projects
- **THEN** the overlay SHALL show task mode for the full typed text and the `@` text SHALL remain unchanged

#### Scenario: At most five projects
- **WHEN** a bare `@` is typed and the user owns twelve projects
- **THEN** the overlay SHALL list exactly 5 projects

#### Scenario: Escape keeps the token literal
- **WHEN** the overlay is in project mode and the user presses Escape
- **THEN** the overlay SHALL close, the typed `@…` text SHALL remain in the input, and no project SHALL be picked

#### Scenario: Enter in project mode picks, not starts
- **WHEN** the project-mode overlay is open in the top-bar widget and the user presses Enter
- **THEN** the highlighted project SHALL be picked and the timer SHALL NOT start

#### Scenario: Project load failure
- **WHEN** loading the project list fails
- **THEN** no error toast SHALL appear, the overlay SHALL never enter project mode, and typed `@` text SHALL be treated as literal title text

#### Scenario: Deleted projects are not offered
- **WHEN** the user has a soft-deleted project matching the query
- **THEN** that project SHALL NOT be listed and SHALL NOT be resolved from typed text
