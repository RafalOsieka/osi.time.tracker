## ADDED Requirements

### Requirement: REQ-TTR-035 Client-side validation of the task form
The task create/edit form SHALL validate input client-side using the shared `createTaskSchema` from `shared/types/task.ts` (via a PrimeVue Forms resolver) before any request is sent. Validation failures SHALL render the schema's messageKey translated via `t()` as an inline field error and SHALL prevent the request. A cleared (null) project selection SHALL pass validation, since tasks MAY be project-less. Server-side validation SHALL remain unchanged and authoritative.

#### Scenario: Empty name blocked client-side
- **WHEN** the user submits the task form with an empty or whitespace-only name
- **THEN** the form SHALL show the `error.taskNameRequired` message inline and SHALL NOT send a request

#### Scenario: Project-less task passes validation
- **WHEN** the user submits the task form with a valid name and no project selected
- **THEN** client-side validation SHALL pass and the request SHALL be sent with a null `projectId`
