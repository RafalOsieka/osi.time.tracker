## MODIFIED Requirements

### Requirement: REQ-013 Client-side validation of the login form
The login form SHALL validate credentials client-side using the shared `loginSchema` from `shared/types/auth.ts` (bound directly to Nuxt UI's `UForm` `:schema`) before submitting, so empty email or password is caught without a request using the same `errors.auth.credentialsRequired` messageKey the server returns. Server-side verification SHALL remain unchanged and authoritative; a failed server login SHALL render the translated form-level error announced to assistive technology, with both inputs marked `aria-invalid` and associated via `aria-describedby`.

#### Scenario: Empty credentials blocked client-side
- **WHEN** the user submits the login form with an empty email or password
- **THEN** the form SHALL show the `errors.auth.credentialsRequired` message and SHALL NOT send a request

#### Scenario: Failed server login shown as form-level error
- **WHEN** submitted credentials pass client-side validation but the server rejects them
- **THEN** the translated server error SHALL render as an announced form-level error and no session SHALL be established
