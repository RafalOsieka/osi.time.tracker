# tracking-project-mentions Specification

## Purpose
Lets the user target a project while typing a time-entry title, by writing `@` followed by part of a project's name, in both the top-bar timer widget and the add-entry dialog.

## Requirements

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

### Requirement: REQ-373 Mention matching and ranking
Matching SHALL compare **normalized** forms. To normalize a string, the system SHALL lowercase it, remove diacritics (including Polish letters, so `ł` becomes `l`), and remove whitespace, `-` and `_`. A project SHALL match a query when the project's normalized name contains the normalized query. An empty query (bare `@`) SHALL match every project.

Matching projects SHALL be ordered by:
1. Match tier: normalized name starts with the query, then a word of the name starts with the query (words split on whitespace, `-`, `_`), then any other containment.
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
Picking a project in project mode (click or Enter) SHALL remove the mention token (the `@` and its query) from the input text, collapse the whitespace left behind, and set the input's **project chip** to that project. The chip SHALL render inside the input before the text, show the project name, and offer a remove control. The chip SHALL hold at most one project. Picking another project SHALL replace it. Activating the remove control SHALL clear the chip.

While the chip holds a project, the overlay's task suggestions SHALL be requested for that project only (`GET /api/tasks?projectId=`) and the create-new-task option SHALL read "{title} (new task in {project})". Picking a task suggestion SHALL set the chip to that task's project, or clear the chip when the task is project-less. Editing the title text afterwards SHALL keep the chip.

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
When the user starts, retitles or saves without having picked from project mode, the system SHALL try to resolve the **last** mention token in the text. It SHALL consider the word-prefixes of the text after `@`, longest first (for `@helios fix login`: `helios fix login`, `helios fix`, `helios`). It SHALL choose the first prefix whose normalized form (REQ-373) **equals** the normalized name of exactly one of the user's projects. When a prefix resolves, that `@` and prefix SHALL be removed from the title and the project SHALL be used as if picked. When none resolves, including when two projects share the same normalized name, the text SHALL be committed literally and the chip SHALL be unchanged. A resolved typed mention SHALL replace a chip that was already set. Partial matches (`@hel`) SHALL NEVER resolve without an explicit pick.

The create-new-task option SHALL preview this resolution, so its label shows the title and project that committing would produce.

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
When the top-bar widget starts a timer from a free-form title, it SHALL send `title` with `projectId` set to the chip's project, or `null` when the chip is empty (REQ-140). When a picked suggestion is still bound, it SHALL send `taskId` only, as today. When the add-entry dialog saves, it SHALL apply the same rule to `POST /api/time-entries` with the manual pair.

While a timer is running, the chip SHALL show the running entry's project (`projectName`) and SHALL follow it whenever the running state is refreshed. Picking a project or removing the chip while running SHALL immediately send `PATCH /api/time-entries/[id]` with the current title and the explicit `projectId` (or `null`). This is a discrete selection, like picking a suggestion, and is not a per-keystroke edit. Committing a retitle on blur or Enter SHALL send the chip's `projectId` explicitly.

Because a project belongs to a task, an empty title cannot carry a project. Starting or saving with an empty title and a set chip SHALL create an untitled entry and SHALL clear the chip. Picking a project for an untitled running entry SHALL keep the chip locally and SHALL send no request until a non-empty title is committed.

#### Scenario: Start in a picked project
- **WHEN** the chip shows "Helios", the text is `fix login`, and the user starts the timer
- **THEN** the request SHALL carry `title: "fix login"` and Helios's `projectId`, and the running entry SHALL be in "Helios"

#### Scenario: Start without a chip
- **WHEN** the chip is empty and the user starts with a free-form title
- **THEN** the request SHALL carry the title with `projectId` null or omitted, resolving project-less per REQ-142

#### Scenario: Re-project the running entry
- **WHEN** a timer is running in "Helios" and the user mentions and picks "Nordwind"
- **THEN** the widget SHALL immediately send a PATCH with the current title and Nordwind's `projectId`, and the chip SHALL show "Nordwind"

#### Scenario: Remove the project of the running entry
- **WHEN** a timer is running in "Helios" and the user removes the chip
- **THEN** the widget SHALL send a PATCH with the current title and `projectId: null`

#### Scenario: Running entry shows its project
- **WHEN** a running entry belongs to "Helios", including after a reload
- **THEN** the chip SHALL show "Helios"

#### Scenario: Empty title drops the chip
- **WHEN** the chip shows "Helios", the title is empty, and the user starts the timer
- **THEN** an untitled entry SHALL start and the chip SHALL be cleared

#### Scenario: Dialog saves in a project
- **WHEN** in the add-entry dialog the chip shows "Helios", the title is `review`, and the user saves
- **THEN** the created entry SHALL carry title `review` in "Helios"

### Requirement: REQ-377 Accessible, localized mentions
The project chip's remove control SHALL be keyboard operable and SHALL have an accessible name that includes the project name (for example "Remove project Helios"). The project-mode group label, the "(new task in {project})" option label, and the title placeholders mentioning `@` (top bar and add-entry dialog) SHALL come from the i18n catalogs, with `en`/`pl` parity. The chip SHALL use Nuxt UI components and `--ui-*` tokens and SHALL meet WCAG 2.1 AA contrast.

#### Scenario: Remove control is labelled
- **WHEN** the chip shows "Helios"
- **THEN** its remove control SHALL expose an accessible name containing "Helios" and SHALL be reachable and operable by keyboard

#### Scenario: Placeholder hints at mentions
- **WHEN** the top-bar title input is empty and idle, or the add-entry dialog opens
- **THEN** the placeholder SHALL mention that `@` selects a project, in the active locale

#### Scenario: Strings in parity
- **WHEN** the mention strings are added
- **THEN** they SHALL exist in both `en.json` and `pl.json` with matching keys
