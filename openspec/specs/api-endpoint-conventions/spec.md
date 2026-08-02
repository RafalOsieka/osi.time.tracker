# api-endpoint-conventions Specification

## Purpose

Define the single, shared boundary contract every OSI server API route honors —
authentication, CSRF protection, the translated error contract, strict per-user
isolation, and boundary validation with ISO serialization — so domain specs can
reference these conventions instead of restating them per capability.

## Requirements

### Requirement: REQ-169 Authenticated server routes
Every server API route SHALL resolve the authenticated user via the shared
`requireAuth` helper before performing any other work. A request without a valid
session SHALL be rejected with HTTP 401 and SHALL NOT read or mutate any data.

#### Scenario: Unauthenticated request rejected
- **WHEN** any server API route is called without a valid session
- **THEN** the system SHALL respond with HTTP 401 and perform no data access

### Requirement: REQ-170 CSRF-guarded mutating endpoints
Mutating endpoints (`POST`, `PUT`, `PATCH`, `DELETE`) SHALL be CSRF-protected
using the mechanism defined in `authentication` REQ-011, and client-side
mutations SHALL be issued through `$csrfFetch` / `useCsrfFetch`.

#### Scenario: Missing CSRF token rejected
- **WHEN** a mutating request is made without a valid CSRF token
- **THEN** the system SHALL reject the request without performing the mutation

#### Scenario: Client mutation carries the token
- **WHEN** the client issues a mutating request
- **THEN** it SHALL use `$csrfFetch` / `useCsrfFetch` so a valid CSRF token is sent

### Requirement: REQ-171 Translation-key error contract
API errors SHALL use the `{ messageKey, params }` contract and SHALL NOT return
rendered, human-readable text; clients translate `messageKey` via `t()`. Body
validation SHALL use a single zod schema per route, and a `ZodError` SHALL map to
HTTP 422. Server or network failures SHALL surface client-side as a Toast.

#### Scenario: Validation failure returns 422 with a messageKey
- **WHEN** a request body fails the route's zod schema
- **THEN** the system SHALL respond with HTTP 422 and a `{ messageKey, params }` body, and SHALL NOT return rendered text

#### Scenario: Server failure surfaced as Toast
- **WHEN** a mutation fails with an API error
- **THEN** the client SHALL show a Toast translated from the returned `messageKey`

### Requirement: REQ-172 Strict per-user isolation
Every read and write SHALL be scoped to the authenticated user's id. A **well-formed**
resource id belonging to another user, or a well-formed id that is unknown, SHALL resolve to
HTTP 404 without confirming the resource's existence. A **malformed** identifier supplied in a
request body — one that fails the route's `z.uuid()` boundary validation — SHALL be rejected
with HTTP 422 and the `{ messageKey, params }` contract before any data access occurs.

#### Scenario: Foreign or unknown id
- **WHEN** an authenticated user references a well-formed resource id owned by another user or one that does not exist
- **THEN** the system SHALL respond with HTTP 404 and SHALL NOT reveal whether the resource exists

#### Scenario: Malformed id in a request body
- **WHEN** an authenticated user submits a body whose identifier field is not a valid RFC UUID (e.g. an invalid version/variant nibble such as `00000000-0000-0000-0000-000000000001`, or arbitrary text)
- **THEN** the system SHALL respond with HTTP 422 with a `{ messageKey, params }` body and SHALL perform no data access

### Requirement: REQ-173 Boundary validation and ISO serialization
Each route SHALL validate its input through a single zod schema defined once in
`shared/types`, access the database only through the shared lazy Drizzle client,
and emit all timestamps as ISO 8601 strings.

#### Scenario: Timestamps serialized as ISO strings
- **WHEN** a route returns a payload containing timestamps
- **THEN** each timestamp SHALL be an ISO 8601 string

#### Scenario: Single schema per route
- **WHEN** a route validates a request body
- **THEN** it SHALL use one zod schema sourced from `shared/types`
