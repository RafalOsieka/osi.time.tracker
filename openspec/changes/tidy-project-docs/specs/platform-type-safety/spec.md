## MODIFIED Requirements

### Requirement: REQ-243 Coding standards document Vue typing conventions
`docs/coding-standards.md` SHALL document the type-assertion ladder, the UForm vs primitive-ref state split, the task-title menu adapter rule (no double cast), and the parallel named-map convention for task-keyed UI state, consistent with this capability.

#### Scenario: Standards mention forbidden double assertion
- **WHEN** a contributor reads the Vue component conventions in `docs/coding-standards.md`
- **THEN** the document states that `as unknown as` is forbidden in `app/` components and that library gaps belong in a single adapter

#### Scenario: Standards mention form state typing
- **WHEN** a contributor implements a new UForm dialog
- **THEN** the standards direct them to type `reactive` state from the schema input (or form-state alias) and to avoid value-level casts on submit fields
