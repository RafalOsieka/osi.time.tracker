## ADDED Requirements

### Requirement: REQ-TTR-034 Client-side validation of the project form
The project create/edit form SHALL validate input client-side using the shared `createProjectSchema` from `shared/types/project.ts` (via a PrimeVue Forms resolver) before any request is sent, replacing the manual pre-submit client check with the same `error.projectClientRequired` messageKey. Validation failures SHALL render the schema's messageKey translated via `t()` as an inline field error and SHALL prevent the request. Server-side validation SHALL remain unchanged and authoritative; server-only field errors (e.g. `error.projectNameDuplicate`) SHALL still render inline under the field after submission.

#### Scenario: Empty name blocked client-side
- **WHEN** the user submits the project form with an empty or whitespace-only name
- **THEN** the form SHALL show the `error.projectNameRequired` message inline and SHALL NOT send a request

#### Scenario: Missing client blocked client-side
- **WHEN** the user submits the project form without selecting a client
- **THEN** the form SHALL show the `error.projectClientRequired` message inline under the client select and SHALL NOT send a request

#### Scenario: Server-only duplicate error still shown inline
- **WHEN** the submitted values pass client-side validation but the server rejects the name as a duplicate for that client
- **THEN** the `error.projectNameDuplicate` message SHALL render inline under the name field
