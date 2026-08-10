## Purpose

Define client/Vue typing discipline for type assertions, form and keyed UI state, and freeform task-title autocomplete adapters so components stop lying to TypeScript while preserving existing product behavior.

## ADDED Requirements

### Requirement: REQ-238 Double type assertions are forbidden in app components
Application Vue components, pages, layouts, composables, and client utilities under `app/` SHALL NOT use `as unknown as` (or equivalent double assertions that erase then reassert a type). When a third-party component forces a type mismatch, the project SHALL isolate a single typed adapter (composable or util) rather than casting at call sites or in templates.

#### Scenario: Task title autocomplete does not double-cast
- **WHEN** a freeform task-title menu binds suggestions from task DTOs
- **THEN** neither the items list nor the selection handler uses `as unknown as` to treat task DTOs as strings or strings as task DTOs

#### Scenario: New library friction uses one adapter
- **WHEN** a Nuxt UI or DOM typing gap cannot be expressed without an assertion
- **THEN** the assertion lives in one documented adapter returning the component’s or DOM’s intended type, and consuming components import that adapter instead of casting inline

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
