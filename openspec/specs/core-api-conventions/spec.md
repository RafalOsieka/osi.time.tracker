# core-api-conventions Specification

## Purpose

Define the single, shared boundary contract every OSI server API route honors —
authentication, CSRF protection, the translated error contract, strict per-user
isolation, and boundary validation with ISO serialization — so domain specs can
reference these conventions instead of restating them per capability.

## Requirements

### Requirement: REQ-169 Authenticated server routes
Every server API route that reads or mutates user-scoped data SHALL resolve the
authenticated user before performing any other work. A request without a valid
session SHALL be rejected with HTTP 401 and SHALL NOT read or mutate any data.

#### Scenario: Unauthenticated request rejected
- **WHEN** any server API route is called without a valid session
- **THEN** the system SHALL respond with HTTP 401 and perform no data access

#### Scenario: Authenticated access is allowed
- **WHEN** a request with a valid session targets a protected endpoint
- **THEN** the server SHALL allow the action to proceed for that user

### Requirement: REQ-170 CSRF-guarded mutating endpoints
Mutating endpoints (`POST`, `PUT`, `PATCH`, `DELETE`) SHALL be CSRF-protected
using the mechanism defined in `core-authentication` REQ-011, and the client SHALL
send a valid CSRF token with every mutating request.

#### Scenario: Missing CSRF token rejected
- **WHEN** a mutating request is made without a valid CSRF token
- **THEN** the system SHALL reject the request without performing the mutation

#### Scenario: Client mutation carries the token
- **WHEN** the client issues a mutating request
- **THEN** the request SHALL carry a valid CSRF token

### Requirement: REQ-171 Translation-key error contract
API errors SHALL use the `{ messageKey, params }` contract and SHALL NOT return
rendered, human-readable text; clients translate `messageKey`. `params`, when
present, SHALL hold only `string`, `number` or `boolean` values. A body that fails
validation SHALL be rejected with HTTP 422. Server or network failures SHALL
surface client-side as a Toast.

#### Scenario: Validation failure returns 422 with a messageKey
- **WHEN** a request body fails the route's zod schema
- **THEN** the system SHALL respond with HTTP 422 and a `{ messageKey, params }` body, and SHALL NOT return rendered text

#### Scenario: Server failure surfaced as Toast
- **WHEN** a mutation fails with an API error
- **THEN** the client SHALL show a Toast translated from the returned `messageKey`

#### Scenario: Params values are primitives
- **WHEN** a 422 body includes `params`
- **THEN** every `params` value SHALL be a `string`, `number`, or `boolean` (no nested objects, no `unknown`)

### Requirement: REQ-158 ZodError maps to the locale-agnostic messageKey contract
A validation failure SHALL be translated into `{ messageKey, params }` from its first issue: a dot-notation message key authored in the schema, with `params` carrying `min`, `max`, `expected` and custom schema params when present. `received` SHALL NOT be emitted. An issue whose message is not a recognizable key SHALL fall back to `errors.unexpected`. Raw (English) validation messages SHALL NOT be returned to the client.

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

### Requirement: REQ-156 Request bodies are validated and typed from one zod schema
Each route SHALL parse its request body through one schema shared with the client. Parsing SHALL normalize input (e.g. trim strings) and strip unknown keys. An invalid body SHALL be rejected before any database operation.

#### Scenario: Valid body is parsed, normalized, and stripped
- **WHEN** a handler parses a body containing a padded `name` and an extra unexpected key
- **THEN** the parsed result has the trimmed `name`, is typed as the inferred request type, and the unexpected key is removed

#### Scenario: Invalid body is rejected
- **WHEN** a body fails schema validation (missing or over-length `name`)
- **THEN** the handler does not perform the database operation and responds with a validation error

### Requirement: REQ-172 Strict per-user isolation
Every read and write SHALL be scoped to the authenticated user's id. A **well-formed**
resource id (project, task, tracker, entry or any other) belonging to another user, or
a well-formed id that is unknown, SHALL resolve to HTTP 404 without confirming the
resource's existence. A **malformed** identifier in a request body — one that is not an
RFC-strict UUID — SHALL be rejected with HTTP 422 and the `{ messageKey, params }`
contract before any data access occurs.

#### Scenario: Foreign or unknown id
- **WHEN** an authenticated user references a well-formed resource id owned by another user or one that does not exist
- **THEN** the system SHALL respond with HTTP 404 and SHALL NOT reveal whether the resource exists

#### Scenario: Malformed id in a request body
- **WHEN** an authenticated user submits a body whose identifier field is not a valid RFC UUID (e.g. an invalid version/variant nibble such as `00000000-0000-0000-0000-000000000001`, or arbitrary text)
- **THEN** the system SHALL respond with HTTP 422 with a `{ messageKey, params }` body and SHALL perform no data access

#### Scenario: Identifier field rejects a non-RFC UUID
- **WHEN** a request body supplies a UUID-shaped identifier whose version or variant nibbles are invalid (e.g. `00000000-0000-0000-0000-000000000001`; the RFC nil and max sentinels are accepted)
- **THEN** the schema SHALL reject it as a validation failure

#### Scenario: Identifier field accepts a UUIDv7
- **WHEN** a request body supplies an identifier produced by the database's `uuidv7()`
- **THEN** the schema SHALL accept it

### Requirement: REQ-173 Boundary validation and ISO serialization
Each route SHALL validate its request body and, when it reads them, its query
parameters through one schema defined once and shared with the client, and SHALL
emit all timestamps as ISO 8601 strings.

#### Scenario: Timestamps serialized as ISO strings
- **WHEN** a route returns a payload containing timestamps
- **THEN** each timestamp SHALL be an ISO 8601 string

#### Scenario: Timestamp typed as serialized form
- **WHEN** a response DTO exposes a timestamp
- **THEN** the field is typed as `string`, matching the JSON the client actually receives

#### Scenario: Single schema per route
- **WHEN** a route validates a request body
- **THEN** it SHALL use one zod schema shared with the client

#### Scenario: Query string uses a zod schema
- **WHEN** a GET route reads query parameters
- **THEN** it SHALL validate them with a shared zod schema rather than reading them untyped

### Requirement: REQ-353 Free-text fields accept any characters
Free-text request fields (entry and task titles, remote-log comments, remote issue and project titles, project and tracker names) SHALL accept any Unicode text, including `<`, `>`, `&`, quotes and HTML-like sequences, and SHALL store and return it verbatim. No request-level filter SHALL reject or rewrite a body or query string because of its characters; XSS protection comes from output escaping and the Content-Security-Policy (REQ-011). Per-field length bounds and validation still apply.

#### Scenario: Angle brackets in a title round-trip
- **WHEN** a user starts a timer with the title `Fix List<string> serialization > 0`
- **THEN** the system SHALL respond with HTTP 201 and the returned `TimeEntryDto` and subsequent reads SHALL carry that exact title

#### Scenario: Imported remote comment with markup-like text is accepted
- **WHEN** an import batch contains a log whose `comment` is `<review> a > b`
- **THEN** the import SHALL be accepted and the created task name SHALL be derived from that comment unchanged

#### Scenario: Script-like text is stored and rendered inert
- **WHEN** a user saves a project name containing `<script>alert(1)</script>`
- **THEN** the name SHALL be stored verbatim and every page rendering it SHALL show it as literal text without executing it
