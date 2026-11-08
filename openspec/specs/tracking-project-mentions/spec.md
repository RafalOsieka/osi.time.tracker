# tracking-project-mentions Specification

## Purpose
Lets the user target a project while typing a time-entry title, by writing `@` followed by part of a project's name, in both the top-bar timer widget and the add-entry dialog.

## Requirements

### Requirement: REQ-372 Mention trigger switches the title overlay into project mode
In the top-bar and add-entry title, an `@` at the start or after whitespace plus text to the caret (spaces allowed) SHALL be a **mention**; an `@` inside a word (`jan@firma.pl`) SHALL NOT. While it matches a project (REQ-373), the title overlay itself (no second popup or caret tooltip) SHALL enter **project mode**: under "Projects", up to 5 projects with tracker names, the first highlighted, instead of tasks and the create option. Escape keeps the text; Enter picks and SHALL NOT start the timer.

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

### Requirement: REQ-470 Mention project list
Mentions SHALL offer only the user's own non-deleted projects (REQ-084), loaded when the top-bar title input gains focus or the add-entry dialog opens. A failed load SHALL turn project mode off without an error toast, so every `@` stays literal text.

#### Scenario: Project load failure
- **WHEN** loading the project list fails
- **THEN** no error toast SHALL appear, the overlay SHALL never enter project mode, and typed `@` text SHALL be treated as literal title text

#### Scenario: Deleted projects are not offered
- **WHEN** the user has a soft-deleted project matching the query
- **THEN** that project SHALL NOT be listed and SHALL NOT be resolved from typed text

### Requirement: REQ-373 Mention matching and ranking
Matching SHALL compare **normalized** forms: lowercased, without diacritics (Polish `ł` becomes `l`), whitespace, `-` or `_`. A project SHALL match when its normalized name contains the normalized query; a bare `@` matches all. Matches SHALL be ordered by:
1. Match tier: the name starts with the query, then a word of it does (words split on whitespace, `-`, `_`), then any other containment.
2. Tracked seconds over the last 30 days (REQ-371), descending.
3. Name, ascending.

#### Scenario: Case and diacritics are ignored
- **WHEN** the user types `@zolc` and owns "Żółć Sp. z o.o."
- **THEN** that project SHALL be listed

#### Scenario: Separators are interchangeable
- **WHEN** the user owns "Project Example" and types `@project-example`, `@project_example`, `@project example` or `@projectexample`
- **THEN** "Project Example" SHALL be listed in each case

#### Scenario: Bare @ ranks by recent use
- **WHEN** the user types a bare `@` and has tracked 10 h in "Nordwind" and 2 h in "Helios" over the last 30 days
- **THEN** "Nordwind" SHALL be listed before "Helios"

#### Scenario: Prefix beats usage
- **WHEN** the user types `@hel`, owns "Helios" with no recent time and "Shell Migration" with recent time
- **THEN** "Helios" SHALL be listed before "Shell Migration"

#### Scenario: Ties fall back to name
- **WHEN** two projects share a match tier and have equal recent tracked time
- **THEN** they SHALL be ordered by name ascending

### Requirement: REQ-374 Picking a project sets the project chip
Picking a project SHALL remove the `@` and query from the text, collapse leftover whitespace, and set the input's **project chip**: one project, named inside the input before the text, with a remove control; a new pick replaces it. A set chip SHALL limit suggestions to its project (`GET /api/tasks?projectId=`) and make the create option read "{title} (new task in {project})". Picking a task suggestion SHALL set the chip to its project, or clear it. Editing the text SHALL keep the chip.

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

### Requirement: REQ-375 Typed mentions resolve only on an exact normalized name
On start, retitle or save without a pick, the system SHALL try the **last** mention's word-prefixes, longest first (`@helios fix login`: `helios fix login`, `helios fix`, `helios`), taking the first whose normalized form **equals** exactly one project's. That prefix and `@` SHALL leave the title, its project used as if picked, replacing any chip. Otherwise, ambiguity included, the text SHALL be kept literally, chip unchanged; a partial name never resolves. The create option SHALL preview this.

#### Scenario: Full name resolves without picking
- **WHEN** the user types `fix login @helios` and presses Start without picking, owning "Helios" and "Helios Mobile"
- **THEN** the entry SHALL start with title `fix login` in project "Helios"

#### Scenario: Leading mention with title resolves
- **WHEN** the user types `@project-example fix login` and presses Start, owning "Project Example"
- **THEN** the entry SHALL start with title `fix login` in project "Project Example"

#### Scenario: Partial name stays literal
- **WHEN** the user types `fix login @hel` and presses Start without picking
- **THEN** the entry SHALL start with title `fix login @hel` and no project from the mention

#### Scenario: Ambiguous name stays literal
- **WHEN** the user owns a local "Helios" and a tracker-bound "Helios" and types `fix @helios`
- **THEN** the text SHALL be committed literally and no project SHALL be chosen

#### Scenario: Create row previews resolution
- **WHEN** the user types `fix login @helios`
- **THEN** the create-new-task option SHALL read "fix login (new task in Helios)"

### Requirement: REQ-376 Committing sends the chip's project
Starting the timer from a free-form title SHALL send `title` with the chip's `projectId`, or `null` when empty (REQ-140); with a picked suggestion still bound it SHALL send only `taskId`. The add-entry dialog SHALL do the same with its manual pair. A project belongs to a task, so starting or saving with an empty title SHALL create an untitled entry and clear the chip.

#### Scenario: Start in a picked project
- **WHEN** the chip shows "Helios", the text is `fix login`, and the user starts the timer
- **THEN** the request SHALL carry `title: "fix login"` and Helios's `projectId`, and the running entry SHALL be in "Helios"

#### Scenario: Start without a chip
- **WHEN** the chip is empty and the user starts with a free-form title
- **THEN** the request SHALL carry the title with `projectId` null or omitted, resolving project-less per REQ-142

#### Scenario: Empty title drops the chip
- **WHEN** the chip shows "Helios", the title is empty, and the user starts the timer
- **THEN** an untitled entry SHALL start and the chip SHALL be cleared

#### Scenario: Dialog saves in a project
- **WHEN** in the add-entry dialog the chip shows "Helios", the title is `review`, and the user saves
- **THEN** the created entry SHALL carry title `review` in "Helios"

### Requirement: REQ-471 The chip follows the running entry
While a timer runs, the chip SHALL show the running entry's project and follow it on every refresh. Picking or removing a project SHALL immediately PATCH the entry with the current title and the explicit `projectId` (or `null`) — a discrete selection, not a per-keystroke edit — and a retitle on blur or Enter SHALL send the chip's `projectId` explicitly. For an untitled running entry the chip SHALL stay local, sending nothing until a non-empty title is committed.

#### Scenario: Re-project the running entry
- **WHEN** a timer is running in "Helios" and the user mentions and picks "Nordwind"
- **THEN** the widget SHALL immediately send a PATCH with the current title and Nordwind's `projectId`, and the chip SHALL show "Nordwind"

#### Scenario: Remove the project of the running entry
- **WHEN** a timer is running in "Helios" and the user removes the chip
- **THEN** the widget SHALL send a PATCH with the current title and `projectId: null`

#### Scenario: Running entry shows its project
- **WHEN** a running entry belongs to "Helios", including after a reload
- **THEN** the chip SHALL show "Helios"

### Requirement: REQ-377 Accessible, localized mentions
The project chip's remove control SHALL be keyboard operable and SHALL have an accessible name that includes the project name (for example "Remove project Helios"). The project-mode group label, the "(new task in {project})" option label, and the title placeholders mentioning `@` (top bar and add-entry dialog) SHALL come from the i18n catalogs, with `en`/`pl` parity. The chip SHALL meet WCAG 2.1 AA contrast.

#### Scenario: Remove control is labelled
- **WHEN** the chip shows "Helios"
- **THEN** its remove control SHALL expose an accessible name containing "Helios" and SHALL be reachable and operable by keyboard

#### Scenario: Placeholder hints at mentions
- **WHEN** the top-bar title input is empty and idle, or the add-entry dialog opens
- **THEN** the placeholder SHALL mention that `@` selects a project, in the active locale

#### Scenario: Strings in parity
- **WHEN** the mention strings are added
- **THEN** they SHALL exist in both `en.json` and `pl.json` with matching keys
