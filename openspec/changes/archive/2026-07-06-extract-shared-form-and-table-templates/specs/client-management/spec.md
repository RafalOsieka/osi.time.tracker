## ADDED Requirements

### Requirement: REQ-TTR-033 Client-side validation of the client form
The client create/edit form SHALL validate input client-side using the shared `createClientSchema` from `shared/types/client.ts` (via a PrimeVue Forms resolver) before any request is sent. Validation failures SHALL render the schema's messageKey translated via `t()` as an inline field error and SHALL prevent the request. Server-side validation SHALL remain unchanged and authoritative; server-only field errors (e.g. `error.clientNameDuplicate`) SHALL still render inline under the field after submission.

#### Scenario: Empty name blocked client-side
- **WHEN** the user submits the client form with an empty or whitespace-only name
- **THEN** the form SHALL show the `error.clientNameRequired` message inline and SHALL NOT send a request

#### Scenario: Server-only duplicate error still shown inline
- **WHEN** the submitted name passes client-side validation but the server rejects it as a duplicate
- **THEN** the `error.clientNameDuplicate` message SHALL render inline under the name field
