## ADDED Requirements

### Requirement: REQ-NFR-010 Boundary shapes have a single source of truth
Every shape exchanged across the client/server boundary SHALL be defined exactly once in a `shared/types/<entity>.ts` module that both the Nuxt app and the Nitro server import. Boundary types SHALL be decoupled from Drizzle table definitions (intentionally authored fields, not DB column mirrors). Inline/anonymous re-declaration of a boundary shape SHALL NOT be used.

#### Scenario: Client consumes the shared contract
- **WHEN** `pages/clients.vue` types a fetch response or edit payload
- **THEN** it imports the type from `shared/types/client` instead of declaring an inline `{ id, name, createdAt }` object

#### Scenario: Server returns the shared contract
- **WHEN** a client API handler returns data
- **THEN** the returned value conforms to the shared boundary type for that entity

### Requirement: REQ-NFR-011 Request bodies are validated and typed from one zod schema
Request bodies SHALL be defined as a `zod` schema in the entity's `shared/types` module, and the request type SHALL be derived via `z.infer`. Handlers SHALL parse the incoming body through this schema, which MUST normalize input (e.g. trim strings) and strip unknown keys. Only `zod` SHALL be used; `drizzle-zod` SHALL NOT be introduced by this change.

#### Scenario: Valid body is parsed, normalized, and stripped
- **WHEN** a handler parses a body containing a padded `name` and an extra unexpected key
- **THEN** the parsed result has the trimmed `name`, is typed as the inferred request type, and the unexpected key is removed

#### Scenario: Invalid body is rejected
- **WHEN** a body fails schema validation (missing or over-length `name`)
- **THEN** the handler does not perform the database operation and responds with a validation error

### Requirement: REQ-NFR-012 Response DTOs are plain inferred types
Response DTOs SHALL be plain TypeScript types (inferred or explicit) and SHALL NOT be validated at runtime, as the server is trusted. Fields that serialize differently over JSON SHALL be typed as their serialized form (e.g. timestamps as `string`, never `Date`).

#### Scenario: Timestamp typed as serialized form
- **WHEN** the `ClientDto` exposes a creation timestamp
- **THEN** the field is typed as `string`, matching the JSON the client actually receives

### Requirement: REQ-NFR-013 ZodError maps to the locale-agnostic messageKey contract
Validation failures SHALL be translated into the existing `{ messageKey, params }` server contract via a shared, generic translator that maps a Zod issue's `path` and `code` to a stable message key. Raw Zod (English) messages SHALL NOT be returned to the client.

#### Scenario: Missing name maps to a message key
- **WHEN** body validation fails because `name` is absent
- **THEN** the response contains `{ messageKey: 'error.clientNameRequired' }` and no human-readable English text from Zod

#### Scenario: Over-length name maps to a parameterized key
- **WHEN** body validation fails because `name` exceeds the maximum length
- **THEN** the response contains `{ messageKey: 'error.clientNameTooLong', params: { max: <limit> } }`

### Requirement: REQ-NFR-014 Explicit any is a lint error
The lint configuration SHALL set `@typescript-eslint/no-explicit-any` to `error`, enforced by the existing `pnpm lint` gate. Use of `any` SHALL be permitted only via an explicit `// eslint-disable-next-line @typescript-eslint/no-explicit-any` annotation carrying a justification. The `no-unsafe-*` rule family is out of scope for this change.

#### Scenario: Explicit any fails lint
- **WHEN** code declares a value typed `any` without a disable annotation
- **THEN** `pnpm lint` reports an error and fails

#### Scenario: Justified exception passes lint
- **WHEN** `any` is unavoidable and annotated with an eslint-disable comment and reason
- **THEN** `pnpm lint` passes for that line

## Open Questions

- None.
