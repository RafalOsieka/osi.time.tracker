## MODIFIED Requirements

### Requirement: REQ-158 ZodError maps to the locale-agnostic messageKey contract
Validation failures SHALL be translated into the existing `{ messageKey, params }` server
contract via a shared translator (`mapZodError`). Message keys SHALL be authored directly in
the schema's Zod messages using the unified `error` option (a string key, or a function
returning one) and the per-check `error` option; the removed v3 options `required_error` and
`invalid_type_error` SHALL NOT be used. The translator SHALL read the first issue, detect a
dot-notation message key, and return it together with any extracted parameters (`min`, `max`,
`expected`, and custom `params`). The `received` parameter SHALL NOT be emitted. Issues whose
message is not a recognizable message key SHALL fall back to a safe `errors.unexpected` key.
Raw Zod (English) messages SHALL NOT be returned to the client.

#### Scenario: Missing name maps to a message key
- **WHEN** body validation fails because `name` is absent
- **THEN** the response contains `{ messageKey: 'error.clientNameRequired', params: { expected: 'string' } }` and no human-readable English text from Zod

#### Scenario: Received is not emitted
- **WHEN** an `invalid_type` issue is mapped
- **THEN** the emitted `params` object SHALL NOT contain a `received` key

#### Scenario: Over-length name maps to a parameterized key
- **WHEN** body validation fails because `name` exceeds the maximum length
- **THEN** the response contains `{ messageKey: 'error.clientNameTooLong', params: { max: <limit> } }`

#### Scenario: Unmapped issue falls back to a safe key
- **WHEN** a validation issue carries a message that is not a dot-notation message key
- **THEN** the translator returns `{ messageKey: 'errors.unexpected' }`

## ADDED Requirements

### Requirement: REQ-234 Boundary schemas use the zod 4 idiom
Schemas in `shared/types` SHALL express validation errors through the unified `error` option
rather than the deprecated `message` option, and SHALL use the top-level string-format
constructors `z.uuid()`, `z.url()`, and `z.iso.datetime()` rather than the deprecated
`z.string().uuid()`, `.url()`, and `.datetime()` method forms. Identifier fields SHALL use
`z.uuid()` (RFC-strict), not the permissive `z.guid()`.

#### Scenario: Identifier field rejects a non-RFC UUID
- **WHEN** a request body supplies a syntactically UUID-shaped identifier whose version or variant nibbles are invalid (e.g. `00000000-0000-0000-0000-000000000001`; note: the RFC nil/max sentinels are accepted by `z.uuid()`)
- **THEN** the schema SHALL reject it as a validation failure

#### Scenario: Identifier field accepts a UUIDv7
- **WHEN** a request body supplies an identifier produced by the database's `uuidv7()`
- **THEN** the schema SHALL accept it

#### Scenario: No deprecated zod options remain
- **WHEN** the `shared/types` modules are inspected after the migration
- **THEN** no occurrence of `required_error`, `invalid_type_error`, or the `message` option SHALL remain
