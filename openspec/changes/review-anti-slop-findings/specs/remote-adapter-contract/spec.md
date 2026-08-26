## ADDED Requirements

### Requirement: REQ-287 Upstream payloads are parsed with zod
Every remote transport `execute` SHALL accept a zod schema for the expected
payload type `T` and SHALL parse the upstream JSON with that schema
(`schema.safeParse`). A parse failure SHALL yield `payload: null` (or the
transport's documented empty result), not an untyped object. Provider adapters
SHALL supply the schema at each call; callers SHALL NOT treat raw upstream JSON
as `T`.

#### Scenario: Transport parse success yields typed payload
- **WHEN** an upstream response body matches the schema passed to `execute`
- **THEN** the transport SHALL return that parsed value as `payload`

#### Scenario: Transport parse failure does not leak raw JSON as T
- **WHEN** an upstream response body fails the schema passed to `execute`
- **THEN** the transport SHALL return `payload: null` (or the operation's empty result) and SHALL NOT cast the raw JSON to `T`
