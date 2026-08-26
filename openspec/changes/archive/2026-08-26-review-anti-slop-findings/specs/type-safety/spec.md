## ADDED Requirements

### Requirement: REQ-284 Catch bindings are unannotated
`catch` bindings SHALL omit an explicit type annotation. Under TypeScript `strict`, the binding is already `unknown`. Function parameters, return types, and type aliases SHALL NOT use `unknown` except inside a named type-predicate (`isX`) that immediately narrows to a domain type.

#### Scenario: Catch has no unknown annotation
- **WHEN** a `try/catch` handles a thrown value
- **THEN** the clause SHALL be `catch (err)` (or equivalent) without `: unknown`

#### Scenario: Extractor does not take unknown
- **WHEN** a helper such as `extractMessageKey` or `toAdapterError` is declared
- **THEN** its input SHALL be a named domain or error type (or a type-predicate parameter), not `unknown`

#### Scenario: Explicit unknown on catch fails lint
- **WHEN** a file contains `catch (err: unknown)`
- **THEN** `pnpm lint` SHALL report an anti-slop `no-unknown-parameters` diagnostic (or equivalent) and fail

### Requirement: REQ-285 Runtime typeof narrowing is forbidden
Application, server, and shared code SHALL NOT use `typeof` checks to narrow values. Narrowing SHALL use `instanceof`, `'key' in` after a named type, schema parse, or a named `isX` / `hasX` type predicate. Ad hoc `typeof err === 'object'` ladders SHALL NOT be used.

#### Scenario: Error mapper uses instanceof or a named guard
- **WHEN** `extractMessageKey` or an adapter error mapper classifies a caught value
- **THEN** it SHALL NOT use `typeof` to decide the shape

#### Scenario: Ad hoc typeof fails lint
- **WHEN** a non-predicate function contains `typeof x === 'string'` (or `'object'` / `'number'`)
- **THEN** `pnpm lint` SHALL fail with `anti-slop/no-runtime-typeof`

### Requirement: REQ-286 Message params are a named primitive map
The `{ messageKey, params }` contract SHALL type `params` as a named `MessageParams` type whose values are `string | number | boolean` (optional keys). `Record<string, unknown>` SHALL NOT appear on that contract, on `mapZodError` output, or on client `t()` interpolation objects for API errors. JSON keys already in use (`min`, `max`, `expected`, custom schema params) SHALL remain; `received` SHALL still be omitted.

#### Scenario: Zod mapper emits primitive params
- **WHEN** `mapZodError` maps a length or type issue
- **THEN** `params` SHALL be typed as `MessageParams` and SHALL contain only `string | number | boolean` values

#### Scenario: Record unknown on the error contract fails lint
- **WHEN** `ApiMessage.params` or an equivalent is declared as `Record<string, unknown>`
- **THEN** `pnpm lint` SHALL fail with `anti-slop/no-unsafe-dictionary-type`
