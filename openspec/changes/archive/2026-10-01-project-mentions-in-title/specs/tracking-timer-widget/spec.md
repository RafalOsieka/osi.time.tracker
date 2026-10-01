# Spec Delta

## MODIFIED Requirements

### Requirement: REQ-180 Top-bar suggestion binding, labels, and popover anchoring

The top-bar timer widget's title autocomplete SHALL present each suggestion as a single object-based item resolved from `GET /api/tasks?search=`, using exactly one selection handler; it SHALL NOT nest an independently clickable control inside a menu item nor cast object items to strings. Selecting a suggestion by mouse or keyboard SHALL fire a single selection and SHALL NOT issue duplicate requests nor set a stringified-object (`[object Object]`) title. While the project chip (REQ-374, tracking-project-mentions) holds a project, suggestions SHALL be requested for that project only.

Each suggestion label SHALL show the task name with its project/client context when present, and SHALL additionally append the remote issue id (from the task's remote issue reference) when the task has one.

When the user selects an existing suggestion, the widget SHALL capture that task's identity and send it to the server so the started/updated entry binds to that exact task (its project and remote reference), rather than reconstructing project/reference from front-end state. When the user commits a free-form title that matches no suggestion, the widget SHALL fall back to the title-based create path (REQ-142) in the project held by the project chip, or in the project-less scope when the chip is empty (REQ-376).

The suggestion overlay SHALL additionally offer, whenever the typed text is non-empty, a distinct **create-new-task option** labelled with the title to be committed and a localized "(new task)" marker, which reads "(new task in {project})" when the commit would carry a project (the chip's project, or a typed mention resolved per REQ-375). It SHALL be rendered separately from the task suggestions and shown even when one or more suggestions match the typed text exactly. That option SHALL be the **first** item in the overlay. The overlay's initial keyboard highlight SHALL land on it. Activating it (by mouse or by overlay-open Enter while it is highlighted) SHALL commit the typed text as a free-form title with **no task binding** — the widget SHALL clear any captured task identity and send `title` together with the chip's `projectId` (null when the chip is empty) — so the entry resolves through the title path (REQ-142) in that scope instead of binding to a matching suggestion. Activating it SHALL close the overlay so a subsequent Enter starts the timer per REQ-146. The option SHALL be keyboard reachable, SHALL expose an accessible name including the typed text, and its strings SHALL exist in `en` and `pl` in parity. While the overlay is in project mode (REQ-372) neither suggestions nor the create-new-task option SHALL be shown.

The same suggestion binding, create-new-task ordering, labelling, free-form commit contract, and project chip SHALL apply to the add-entry dialog title autocomplete: picking a suggestion there SHALL bind the created entry to that exact task by identity (`taskId`) as long as the title text is not edited afterwards.

The elapsed-time start-edit popover SHALL be anchored to the elapsed-time control that opens it, so it appears adjacent to that control rather than to an unrelated element.

#### Scenario: Single selection, no duplicate requests
- **WHEN** the user selects a suggestion with the mouse
- **THEN** exactly one selection SHALL be handled, no duplicate requests SHALL be sent, and the title SHALL be the task name (never `[object Object]`)

#### Scenario: Suggestion label shows the remote issue id
- **WHEN** a suggested task has a remote issue reference
- **THEN** its label SHALL include the remote issue id alongside the name and project/client context

#### Scenario: Picking a suggestion binds to that exact task
- **WHEN** the user picks an existing suggestion and starts the timer
- **THEN** the entry SHALL bind to that task's identity (its project and remote reference), not a newly created project-less task

#### Scenario: Create option is offered alongside exact matches
- **WHEN** the typed text exactly matches one or more existing task suggestions
- **THEN** the overlay SHALL still offer the create-new-task option labelled with the typed text and a localized "(new task)" marker

#### Scenario: Create option is first
- **WHEN** the typed text is non-empty and the overlay lists one or more task suggestions
- **THEN** the create-new-task option SHALL appear before every suggestion

#### Scenario: Create option names the chip's project
- **WHEN** the project chip shows "Helios" and the user types `fix login`
- **THEN** the create-new-task option SHALL read "fix login (new task in Helios)"

#### Scenario: Overlay Enter on the highlighted create option commits freeform
- **WHEN** the overlay is open, the create-new-task option is highlighted, and the user presses Enter
- **THEN** the typed text SHALL be committed as a free-form title with no task binding and the overlay SHALL close

#### Scenario: Create option sends the title without a task binding
- **WHEN** the project chip is empty and the user activates the create-new-task option and starts the timer
- **THEN** the request SHALL carry the typed `title` with no `taskId` and the entry SHALL resolve in the project-less scope per REQ-142

#### Scenario: Create option sends the chip's project
- **WHEN** the project chip shows "Helios" and the user activates the create-new-task option and starts the timer
- **THEN** the request SHALL carry the typed `title` and Helios's `projectId` with no `taskId`, and the entry SHALL resolve in "Helios" per REQ-142

#### Scenario: Create option clears a previously captured suggestion
- **WHEN** the user first selects a suggestion, edits the text, and then activates the create-new-task option
- **THEN** the previously captured task identity SHALL be discarded and SHALL NOT be sent

#### Scenario: Create option is keyboard operable
- **WHEN** the user navigates the overlay with the keyboard to the create-new-task option and activates it
- **THEN** the typed text SHALL be committed as a free-form title, the overlay SHALL close, and a subsequent Enter SHALL start the timer

#### Scenario: No create option for empty text
- **WHEN** the title input is empty or whitespace-only
- **THEN** the overlay SHALL NOT offer a create-new-task option

#### Scenario: Add-entry dialog shares create-option order
- **WHEN** the user types a non-empty title in the add-entry dialog autocomplete
- **THEN** the create-new-task option SHALL be first in that overlay and SHALL commit the typed text as a free-form title

#### Scenario: Add-entry dialog binds a picked suggestion
- **WHEN** the user picks the suggestion "fix login · Nordwind #412" in the add-entry dialog and saves without editing the title
- **THEN** the request SHALL carry that task's `taskId` and the created entry SHALL bind to that task, including its remote reference

#### Scenario: Add-entry dialog edit after pick falls back to title
- **WHEN** the user picks a suggestion in the add-entry dialog, then edits the title text, and saves
- **THEN** the request SHALL carry the edited `title` with the chip's `projectId` and no `taskId`

#### Scenario: Popover anchored to the elapsed control
- **WHEN** the user activates the elapsed-time control to edit the start
- **THEN** the popover SHALL open anchored to that control rather than misaligned to an unrelated element
