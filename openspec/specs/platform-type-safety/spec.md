# platform-type-safety Specification

## Purpose
Define the project's typing discipline on both sides of the client/server boundary. Server and shared: boundary shapes kept in a single source of truth decoupled from Drizzle schemas, request bodies validated and normalized through a single `zod` schema, plain inferred response DTOs typed in their JSON-serialized form, `ZodError` mapped to the locale-agnostic `{ messageKey, params }` contract, unannotated catch bindings, and explicit `any` treated as a lint error. Client/Vue: the type-assertion preference ladder, schema-typed `UForm` state, object-item freeform autocompletes, and named aliases for task-keyed UI maps, so components stop lying to TypeScript.

## Requirements

### Requirement: REQ-155 Boundary shapes have a single source of truth
Every shape exchanged across the client/server boundary SHALL be defined exactly once in a `shared/types/<entity>.ts` module that both the Nuxt app and the Nitro server import. Boundary types SHALL be decoupled from Drizzle table definitions (intentionally authored fields, not DB column mirrors). Inline/anonymous re-declaration of a boundary shape SHALL NOT be used.

#### Scenario: Client consumes the shared contract
- **WHEN** `pages/clients.vue` types a fetch response or edit payload
- **THEN** it imports the type from `shared/types/client` instead of declaring an inline `{ id, name, createdAt }` object

#### Scenario: Server returns the shared contract
- **WHEN** a client API handler returns data
- **THEN** the returned value conforms to the shared boundary type for that entity

### Requirement: REQ-156 Request bodies are validated and typed from one zod schema
Request bodies SHALL be defined as a `zod` schema in the entity's `shared/types` module, and the request type SHALL be derived via `z.infer`. Handlers SHALL parse the incoming body through this schema, which MUST normalize input (e.g. trim strings) and strip unknown keys. Only `zod` SHALL be used; `drizzle-zod` SHALL NOT be introduced by this change.

#### Scenario: Valid body is parsed, normalized, and stripped
- **WHEN** a handler parses a body containing a padded `name` and an extra unexpected key
- **THEN** the parsed result has the trimmed `name`, is typed as the inferred request type, and the unexpected key is removed

#### Scenario: Invalid body is rejected
- **WHEN** a body fails schema validation (missing or over-length `name`)
- **THEN** the handler does not perform the database operation and responds with a validation error

### Requirement: REQ-157 Response DTOs are plain inferred types
Response DTOs SHALL be plain TypeScript types (inferred or explicit) and SHALL NOT be validated at runtime, as the server is trusted. Fields that serialize differently over JSON SHALL be typed as their serialized form (e.g. timestamps as `string`, never `Date`).

#### Scenario: Timestamp typed as serialized form
- **WHEN** the `ClientDto` exposes a creation timestamp
- **THEN** the field is typed as `string`, matching the JSON the client actually receives

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

### Requirement: REQ-159 Explicit any is a lint error
The lint configuration SHALL treat explicit `any` as an error, enforced by the existing `pnpm lint` gate (Oxlint `typescript/no-explicit-any` when that rule is enabled there, otherwise `@typescript-eslint/no-explicit-any` on ESLint). Use of `any` SHALL be permitted only via an explicit next-line disable annotation for the engine that reports the rule, carrying a justification. The `no-unsafe-*` rule family is out of scope for this change.

#### Scenario: Explicit any fails lint
- **WHEN** code declares a value typed `any` without a disable annotation
- **THEN** `pnpm lint` reports an error and fails

#### Scenario: Justified exception passes lint
- **WHEN** `any` is unavoidable and annotated with a next-line disable comment and reason for the reporting engine
- **THEN** `pnpm lint` passes for that line

### Requirement: REQ-036 Lint-disable exceptions carry a justification
Every next-line disable annotation for the `no-explicit-any` rule (ESLint `@typescript-eslint/no-explicit-any` or Oxlint `typescript/no-explicit-any`) SHALL be followed on the same line by a trailing comment (` -- <reason>`) explaining why the exception is unavoidable.

#### Scenario: Justification comment is present
- **WHEN** a justified `any` uses a next-line disable for `no-explicit-any`
- **THEN** the annotation includes a trailing `-- <reason>` comment explaining the exception

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
### Requirement: REQ-238 Double type assertions are forbidden in app components
Application Vue components, pages, layouts, composables, and client utilities under `app/` SHALL NOT use `as unknown as` (or equivalent double assertions that erase then reassert a type). Tests SHALL NOT use chained assertions when a typed fake, `satisfies`, or a single documented adapter can express the same setup. When a third-party component forces a type mismatch, the project SHALL isolate a single typed adapter (composable or util) rather than casting at call sites or in templates.

#### Scenario: Task title autocomplete does not double-cast
- **WHEN** a freeform task-title menu binds suggestions from task DTOs
- **THEN** neither the items list nor the selection handler uses `as unknown as` to treat task DTOs as strings or strings as task DTOs

#### Scenario: New library friction uses one adapter
- **WHEN** a Nuxt UI or DOM typing gap cannot be expressed without an assertion
- **THEN** the assertion lives in one documented adapter returning the component’s or DOM’s intended type, and consuming components import that adapter instead of casting inline

#### Scenario: Test chained assertion is reduced
- **WHEN** a unit or nuxt spec previously used `as unknown as` to fake a Vitest or DOM type
- **THEN** it SHALL use a typed stub or a single `as` with a `// SAFETY:` comment, not a chain, unless a justified anti-slop disable remains after review


### Requirement: REQ-239 Type assertions follow the preference ladder
Client TypeScript SHALL prefer, in order: (1) annotating the reactive container or ref generic, (2) `satisfies` for literal structures, (3) `as const` for discriminant/literal narrowing, (4) runtime narrowing or type guards, (5) schema parse at submit/boundary, (6) a single documented adapter cast for library gaps. Value-level `as T` on form fields, union literals, or submit payloads SHALL NOT be used when container annotation or schema typing would remove the need.

#### Scenario: Form optional field initializes without value cast
- **WHEN** a UForm state object includes an optional identifier field
- **THEN** the state is declared with an explicit type (or schema input type) and initialized without `undefined as string | undefined` (or similar value casts)

#### Scenario: Union literal binds without cast
- **WHEN** UI state holds a closed string union (e.g. week start or search mode)
- **THEN** the field is typed as that union and initialized with a plain literal (or `satisfies`), not `value as Union`

#### Scenario: Submit payload does not re-cast schema fields
- **WHEN** a form submit handler receives validated form data for a required field
- **THEN** the handler does not assert individual fields with `as string` (or similar) to satisfy the API DTO


### Requirement: REQ-240 UForm state is schema-typed; non-form editors use primitives
UForm-backed dialogs and pages SHALL hold field state in a `reactive` object typed from the form schema input type (`z.input<typeof schema>`) or a dedicated form-state type when the UI allows looser empties than the API DTO. Inline or non-UForm editors (timer title, row edit, flags) SHALL use separate primitive refs (or shallow refs) rather than an untyped reactive bag. Derived values SHALL use `computed`.

#### Scenario: Login or entity form state matches schema input
- **WHEN** a UForm binds `:state` for create/update/login
- **THEN** the state object’s TypeScript type is the schema input (or documented form-state alias) and empty strings/optionals match what the schema accepts before submit

#### Scenario: Timer-style editor stays on primitive refs
- **WHEN** a non-UForm control edits a single title, flag, or id
- **THEN** that value is stored in a dedicated ref/shallowRef, not forced into a multi-field reactive object solely for typing


### Requirement: REQ-241 Freeform task-title menus use object items with string model
Freeform task-title autocomplete (timer, add entry, bulk assign, and any shared helper) SHALL expose menu items as objects that carry display label, string value key, and an `onSelect` (or equivalent) closure over the real task identity. The input model SHALL remain a string. Selection MUST NOT recover task identity by casting the slot item.

#### Scenario: Selecting a suggestion captures real task fields
- **WHEN** the user picks an existing task suggestion from the title menu
- **THEN** the component records the task’s id and name from the item’s pre-bound handler (or equivalent non-cast resolution), not via `as unknown as` on the slot item

#### Scenario: Freeform create path clears prior task identity
- **WHEN** the user confirms a typed title that is not an existing suggestion selection
- **THEN** any previously captured task id/name is cleared and the string title is used


### Requirement: REQ-242 Task-keyed UI maps use named aliases and stay parallel
Dynamic UI state keyed by task id (activity selection, issue ref, selected entry ids, export comment, dismiss flags, outcomes, progress, and similar) SHALL use separate map refs with named key/value type aliases (documentation aliases such as `type TaskId = string` are allowed; branded nominal types are out of scope). The project SHALL NOT collapse these into one mandatory mega row-state object in this change. Updates SHOULD replace the map root (immutable-style spread) so shallow roots remain correct. Date or scope changes that reset UI MUST clear every related map in one reset path.

#### Scenario: Sync maps are explicitly typed
- **WHEN** the sync day page or export composable holds per-task selections
- **THEN** each map is typed with a named alias (not only anonymous `Record<string, …>` at the declaration site) and missing keys remain distinguishable from explicit null/empty where the product already relies on that

#### Scenario: Scope change resets all parallel maps
- **WHEN** the user changes the sync day (or equivalent scope that owns those maps)
- **THEN** every task-keyed UI map for that view is cleared through the shared reset path so no stale key survives in a forgotten map


### Requirement: REQ-243 Coding standards document Vue typing conventions
`CODING_STANDARDS.md` SHALL document the type-assertion ladder, the UForm vs primitive-ref state split, the task-title menu adapter rule (no double cast), and the parallel named-map convention for task-keyed UI state, consistent with this capability.

#### Scenario: Standards mention forbidden double assertion
- **WHEN** a contributor reads the Vue component conventions in `CODING_STANDARDS.md`
- **THEN** the document states that `as unknown as` is forbidden in `app/` components and that library gaps belong in a single adapter

#### Scenario: Standards mention form state typing
- **WHEN** a contributor implements a new UForm dialog
- **THEN** the standards direct them to type `reactive` state from the schema input (or form-state alias) and to avoid value-level casts on submit fields

