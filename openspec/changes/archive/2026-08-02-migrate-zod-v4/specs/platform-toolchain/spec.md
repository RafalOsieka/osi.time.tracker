## ADDED Requirements

### Requirement: REQ-235 Validation runs on a single zod 4 baseline
The application SHALL depend on `zod` at `^4` as its only runtime validation library, and the
resolved dependency tree SHALL NOT contain a second major version of `zod` reachable from
application code. The upgrade SHALL NOT change any boundary shape, database schema, or i18n
catalog. All quality gates — `pnpm lint`, `pnpm format:check`, `pnpm type-check`,
`pnpm test:unit`, `pnpm test:nuxt`, and `pnpm test:e2e` — SHALL pass on the upgraded tree.

#### Scenario: Single zod major in application code
- **WHEN** the lockfile and imports are inspected after the upgrade
- **THEN** every application and test import SHALL resolve to `zod@4`, and no source file SHALL import the `zod/v3` or `zod/v4` compatibility subpaths

#### Scenario: Quality gates pass
- **WHEN** the full gate set is executed after the upgrade
- **THEN** lint, format check, type-check, and the unit, nuxt, and e2e test projects SHALL all pass

#### Scenario: Incompatible dependency blocks the upgrade
- **WHEN** a dependency that peers on zod (e.g. `@nuxt/ui`) has no release compatible with `zod@^4`
- **THEN** the upgrade SHALL be reverted rather than worked around with forced resolutions or patches
