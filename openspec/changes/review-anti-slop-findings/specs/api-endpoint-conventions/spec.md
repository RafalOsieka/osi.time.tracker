## MODIFIED Requirements

### Requirement: REQ-171 Translation-key error contract
API errors SHALL use the `{ messageKey, params }` contract and SHALL NOT return
rendered, human-readable text; clients translate `messageKey` via `t()`. `params`,
when present, SHALL conform to `MessageParams` (optional keys whose values are
`string | number | boolean`) and SHALL NOT use `Record<string, unknown>`. Body
validation SHALL use a single zod schema per route, and a `ZodError` SHALL map to
HTTP 422. Server or network failures SHALL surface client-side as a Toast.

#### Scenario: Validation failure returns 422 with a messageKey
- **WHEN** a request body fails the route's zod schema
- **THEN** the system SHALL respond with HTTP 422 and a `{ messageKey, params }` body, and SHALL NOT return rendered text

#### Scenario: Server failure surfaced as Toast
- **WHEN** a mutation fails with an API error
- **THEN** the client SHALL show a Toast translated from the returned `messageKey`

#### Scenario: Params values are primitives
- **WHEN** a 422 body includes `params`
- **THEN** every `params` value SHALL be a `string`, `number`, or `boolean` (no nested objects, no `unknown`)
