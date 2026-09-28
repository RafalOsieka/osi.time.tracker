# platform-toolchain Specification

## Purpose
Define the baseline the repository builds and runs on: the supported Nuxt/Vite/unhead versions, the single zod 4 validation baseline, the independently consumable tracker package, the unified Vite+ (`vp`) toolchain, and the pnpm workspace workflows it orchestrates — together with the quality gates that must stay green so toolchain changes preserve behavior, contracts, schema, and i18n without duplicate major dependency versions.

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

### Requirement: REQ-370 Unified Vite+ toolchain

The repository SHALL run its build, test, lint and format tooling through Vite+ (`vp`). A single `vite-plus` version SHALL be pinned in the pnpm workspace catalog. The catalog SHALL also pin `vite` (to the Vite+ core distribution), `vitest` and `@vitest/coverage-v8` at the versions that `vite-plus` release supports. Workspace overrides SHALL resolve every `vite` and `vitest` dependency to those catalog entries, so the dependency tree contains exactly one Vite and one Vitest. Root orchestration scripts SHALL drive workspace packages with `vp run`, which runs package scripts in workspace-dependency order. The shared library build (`build:packages`) SHALL be cached, so an unchanged library is not rebuilt. CI jobs and the Docker build stage SHALL execute the workspace-pinned `vite-plus` version, and the Docker build image tag SHALL match the catalog version. Node.js and pnpm versions SHALL be resolved from the root `devEngines`, not pinned separately in CI. `vp check` SHALL NOT substitute for the quality gates: it does not run ESLint or type checking, so the gates remain `pnpm lint`, `pnpm format:check` and `pnpm type-check`.

#### Scenario: Single Vite and Vitest in the tree
- **WHEN** the lockfile is inspected
- **THEN** every `vite` and `vitest` dependency, including transitive ones pulled in by Nuxt and test utilities, SHALL resolve to its catalog-pinned version

#### Scenario: Libraries build before consumers
- **WHEN** a root script that needs the workspace libraries runs from a clean checkout
- **THEN** `build:packages` SHALL build each library after the libraries it depends on, before any consuming app script runs

#### Scenario: Unchanged libraries are not rebuilt
- **WHEN** `build:packages` runs a second time with no library source or dependency change
- **THEN** it SHALL reuse the cached result instead of rebuilding

#### Scenario: Library build failure stops the aggregate
- **WHEN** a library build fails inside a root script
- **THEN** the root script SHALL exit non-zero, and dependent package scripts SHALL NOT run against stale output

#### Scenario: Docker image tag drifts from the catalog
- **WHEN** the `vite-plus` catalog version is bumped without updating the Docker build image tag, or the tag is bumped without the catalog
- **THEN** the mismatch SHALL be treated as a defect, and both SHALL be updated together in the same change

#### Scenario: vp check is not accepted as a gate
- **WHEN** a contributor or CI job validates a change
- **THEN** a passing `vp check` alone SHALL NOT count as passing lint, format and type-check; the documented `pnpm lint`, `pnpm format:check` and `pnpm type-check` gates SHALL run
