## MODIFIED Requirements

### Requirement: REQ-091 Accessible, tokenized Projects UI
The Projects page SHALL meet WCAG 2.1 AA: form fields including the Client select SHALL be labelled, the create/edit modal and confirm modal SHALL be accessible and keyboard operable, and invalid fields SHALL expose `aria-invalid` with an associated described error (mirroring `login.vue`). Styling SHALL derive from Tailwind utilities and Nuxt UI `--ui-*` design tokens with no ad-hoc inline colors, and all user-facing strings SHALL exist in `en` and `pl` in parity.

#### Scenario: Inline field error is accessible
- **WHEN** a field validation error is shown
- **THEN** the field SHALL expose `aria-invalid` and reference the error via `aria-describedby`

#### Scenario: Client select is labelled
- **WHEN** the create/edit modal renders the Client select
- **THEN** the select SHALL have an associated label and be keyboard operable

#### Scenario: Strings localized in parity
- **WHEN** new user-facing strings are added
- **THEN** they SHALL exist in both `en.json` and `pl.json` with matching keys

### Requirement: REQ-092 Client-side validation of the project form
The project create/edit form SHALL validate input client-side using the shared `createProjectSchema` from `shared/types/project.ts` (bound directly to Nuxt UI's `UForm` `:schema`) before any request is sent, replacing the manual pre-submit client check with the same `error.projectClientRequired` messageKey. Validation failures SHALL render the schema's messageKey translated via `t()` as an inline field error and SHALL prevent the request. Server-side validation SHALL remain unchanged and authoritative; server-only field errors (e.g. `error.projectNameDuplicate`) SHALL still render inline under the field after submission.

#### Scenario: Empty name blocked client-side
- **WHEN** the user submits the project form with an empty or whitespace-only name
- **THEN** the form SHALL show the `error.projectNameRequired` message inline and SHALL NOT send a request

#### Scenario: Missing client blocked client-side
- **WHEN** the user submits the project form without selecting a client
- **THEN** the form SHALL show the `error.projectClientRequired` message inline under the client select and SHALL NOT send a request

#### Scenario: Server-only duplicate error still shown inline
- **WHEN** the submitted values pass client-side validation but the server rejects the name as a duplicate for that client
- **THEN** the `error.projectNameDuplicate` message SHALL render inline under the name field
