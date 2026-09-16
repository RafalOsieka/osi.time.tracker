# platform-toolchain Specification

## Purpose
Define the baseline the repository builds and runs on: the supported Nuxt/Vite/unhead versions, the single zod 4 validation baseline, the independently consumable tracker package, and the pnpm workspace workflows — together with the quality gates that must stay green so toolchain changes preserve behavior, contracts, schema, and i18n without duplicate major dependency versions.

## Requirements

### Requirement: REQ-083 Application runs on Nuxt 4.5 with all quality gates green
The application SHALL build and run on Nuxt `^4.5.0` (with `@nuxt/schema` at the matching version), using the default Vite builder on Vite 8 and unhead v3. The upgrade SHALL NOT change any user-facing behavior, API contract, database schema, or i18n catalog. All quality gates — `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:nuxt`, and `pnpm test:e2e` — SHALL pass on the upgraded dependency tree, and the dependency tree SHALL NOT contain duplicate major versions of unhead or unctx.

#### Scenario: Production build succeeds on Vite 8
- **WHEN** `pnpm build` is executed after the upgrade
- **THEN** the production build SHALL complete without errors and the e2e suite (which runs against the production build) SHALL pass

#### Scenario: Type-check passes under unhead v3
- **WHEN** `pnpm type-check` is executed after the upgrade
- **THEN** it SHALL pass, including the `useHead` call site in `app.vue` under the stricter unhead v3 types

#### Scenario: Deduped unjs dependency tree
- **WHEN** the lockfile is inspected after the upgrade
- **THEN** only a single major version of `unhead` and `unctx` SHALL be resolved, and no unrelated dependency SHALL have received an unintended major bump

#### Scenario: Incompatible Nuxt module blocks the upgrade
- **WHEN** a configured Nuxt module (`@nuxtjs/i18n`, `nuxt-security`, `nuxt-auth-utils`, `@primevue/nuxt-module`, `@nuxt/test-utils`) fails against Vite 8 or unhead v3 and no compatible module release exists
- **THEN** the upgrade SHALL be reverted (dependency bump and lockfile) rather than worked around with forced resolutions or patches

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

### Requirement: REQ-305 Tracker package is independently consumable

The tracker package SHALL expose its neutral contracts and provider implementations through explicit public exports with executable JavaScript and TypeScript declarations. It SHALL build, type-check, and run its provider tests without preparing or building the web application. Consumers SHALL NOT need Nuxt-generated types, server globals, or browser-extension globals to use the package.

#### Scenario: Independent clean package build
- **WHEN** declared package dependencies are installed and no generated Nuxt artifacts exist
- **THEN** the package build, type-check, and provider tests SHALL succeed

#### Scenario: Downstream runtime compatibility
- **WHEN** a server runtime or browser bundler consumes the package's public exports
- **THEN** it SHALL resolve executable code and declarations without importing web application source or requiring Node-only globals in browser execution

#### Scenario: Undeclared deep import
- **WHEN** a consumer imports a non-exported package-internal module
- **THEN** package resolution SHALL reject that import rather than relying on application source aliases

### Requirement: REQ-306 Workspace workflows preserve web behavior

The repository SHALL offer root commands for development, production build, type-checking, lint, formatting, tests, and migrations that resolve workspace dependencies in the required order. A clean frozen-lockfile install and build SHALL produce a deployable web application with existing client/server behavior, APIs, and database contents unchanged. Repository quality gates SHALL include extracted package tests without silently losing existing coverage.

#### Scenario: Clean build and deployment
- **WHEN** the workspace is built from a clean checkout using documented root commands
- **THEN** package dependencies SHALL build before the web application and the production output SHALL start with the existing runtime configuration contract

#### Scenario: Migration ordering retained
- **WHEN** an isolated standalone deployment starts
- **THEN** its migrator SHALL complete before the web service serves traffic, using the unchanged migration history

#### Scenario: Package failure blocks consumers
- **WHEN** a required package build or type-check fails
- **THEN** the corresponding aggregate command SHALL fail rather than succeeding against stale generated output

#### Scenario: Existing quality coverage retained
- **WHEN** root test and coverage commands run
- **THEN** web suites, extracted provider suites, and repository tooling suites SHALL remain included in their documented gates

