## MODIFIED Requirements

### Requirement: REQ-033 Accessible, tokenized Clients UI
The Clients page SHALL meet WCAG 2.1 AA: form fields SHALL be labelled, the create/edit modal and confirm modal SHALL be accessible and keyboard operable, and invalid fields SHALL expose `aria-invalid` with an associated described error (mirroring `login.vue`). Styling SHALL derive from Tailwind utilities and Nuxt UI `--ui-*` design tokens with no ad-hoc inline colors, and all user-facing strings SHALL exist in `en` and `pl` in parity.

#### Scenario: Inline field error is accessible
- **WHEN** a field validation error is shown
- **THEN** the field SHALL expose `aria-invalid` and reference the error via `aria-describedby`

#### Scenario: Strings localized in parity
- **WHEN** new user-facing strings are added
- **THEN** they SHALL exist in both `en.json` and `pl.json` with matching keys

### Requirement: REQ-034 Client-side validation of the client form
The client create/edit form SHALL validate input client-side using the shared `createClientSchema` from `shared/types/client.ts` (bound directly to Nuxt UI's `UForm` `:schema`) before any request is sent. Validation failures SHALL render the schema's messageKey translated via `t()` as an inline field error and SHALL prevent the request. Server-side validation SHALL remain unchanged and authoritative; server-only field errors (e.g. `error.clientNameDuplicate`) SHALL still render inline under the field after submission.

#### Scenario: Empty name blocked client-side
- **WHEN** the user submits the client form with an empty or whitespace-only name
- **THEN** the form SHALL show the `error.clientNameRequired` message inline and SHALL NOT send a request

#### Scenario: Server-only duplicate error still shown inline
- **WHEN** the submitted name passes client-side validation but the server rejects it as a duplicate
- **THEN** the `error.clientNameDuplicate` message SHALL render inline under the name field
