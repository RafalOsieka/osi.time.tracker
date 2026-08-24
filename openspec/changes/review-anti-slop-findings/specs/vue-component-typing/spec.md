## MODIFIED Requirements

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
