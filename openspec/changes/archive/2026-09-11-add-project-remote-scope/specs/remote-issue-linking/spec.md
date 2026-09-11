## ADDED Requirements

### Requirement: REQ-328 Picker applies the project's remote scope by default
When the Task's Project carries a remote project scope (REQ-325), the remote issue picker SHALL apply that scope to every search by default and SHALL show a labelled, keyboard-operable toggle whose text names the scoped remote project title (e.g. "Only in <title>"). The toggle SHALL be on each time the popover opens; turning it off SHALL search the whole tracker for subsequent submits in that open. When the Project has no scope, the toggle SHALL NOT be rendered and search SHALL be tracker-wide. Scope SHALL be forwarded to the adapter as a search parameter (REQ-319); the picker SHALL NOT filter results client-side. Scope SHALL apply equally under `client` and `extension` execution. The Remote Sync inline picker SHALL apply the same rules using the row's Project scope.

#### Scenario: Scoped title search
- **WHEN** the user submits a title search in the picker for a Task whose Project is scoped and the toggle is on
- **THEN** only issues from the scoped remote project and its descendants SHALL be listed

#### Scenario: Widen to the whole tracker
- **WHEN** the user turns the toggle off and submits a title search
- **THEN** the picker SHALL search the whole tracker and list results from any remote project

#### Scenario: Toggle resets on reopen
- **WHEN** the user turned the toggle off, closed the popover, and opens it again
- **THEN** the toggle SHALL be on

#### Scenario: Unscoped project shows no toggle
- **WHEN** the Task's Project has no remote project scope
- **THEN** the picker SHALL NOT render the toggle and SHALL search tracker-wide

#### Scenario: Scoped project no longer exists remotely
- **WHEN** a scoped search fails because the remote project is gone
- **THEN** the picker SHALL show the translated search error and the toggle SHALL remain available to widen the search

### Requirement: REQ-329 Issue-ID search marks results outside the scope
In issue-ID mode with the scope toggle on, the picker SHALL request the exact lookup with the scope (REQ-320). A found issue with `inScope: false` SHALL still be listed and selectable, and SHALL carry a visible, translated "outside this project's scope" hint that is also part of the result's accessible name and is announced with the result status. A found issue with `inScope: true` SHALL show no hint. Not-found SHALL keep the existing not-found state. With the toggle off, or when the Project has no scope, no hint SHALL be shown.

#### Scenario: ID inside the scope
- **WHEN** the user looks up an issue id that belongs to the scoped subtree
- **THEN** the result SHALL be listed without an outside-scope hint

#### Scenario: ID outside the scope
- **WHEN** the user looks up an existing issue id from an unrelated remote project
- **THEN** the result SHALL be listed with the outside-scope hint and SHALL remain selectable for linking

#### Scenario: Linking an outside-scope issue
- **WHEN** the user selects a result marked outside the scope
- **THEN** the day-scoped link (REQ-179) SHALL proceed exactly as for any other result and SHALL NOT persist a remote project id

#### Scenario: ID not found
- **WHEN** the lookup resolves to not-found under either step
- **THEN** the picker SHALL show the existing translated not-found state

#### Scenario: Hint is accessible
- **WHEN** an outside-scope result is rendered
- **THEN** the hint SHALL be readable by assistive technology through the result's accessible name and the live status region
