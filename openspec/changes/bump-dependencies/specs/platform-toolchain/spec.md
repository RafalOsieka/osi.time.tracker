## RENAMED Requirements

- FROM: `### Requirement: REQ-083 Application runs on Nuxt 4.5 with all quality gates green`
- TO: `### Requirement: REQ-083 Application runs on Nuxt 4.6 with all quality gates green`

## MODIFIED Requirements

### Requirement: REQ-083 Application runs on Nuxt 4.6 with all quality gates green
The application SHALL build and run on Nuxt `^4.6.0` (with `@nuxt/schema` at the matching version), using the default Vite builder on Vite 8 and unhead v3. Nuxt upgrades SHALL go through Nuxt's own upgrade command with deduplication (`nuxt upgrade --dedupe`), so Nuxt's transitive dependencies move with it. The upgrade SHALL NOT change any user-facing behavior, API contract, database schema, or i18n catalog. All quality gates — `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:nuxt`, and `pnpm test:e2e` — SHALL pass on the upgraded dependency tree, and the dependency tree SHALL NOT contain duplicate major versions of unhead or unctx.

#### Scenario: Production build succeeds on Vite 8
- **WHEN** `pnpm build` is executed after the upgrade
- **THEN** the production build SHALL complete without errors and the e2e suite (which runs against the production build) SHALL pass

#### Scenario: Type-check passes under unhead v3
- **WHEN** `pnpm type-check` is executed after the upgrade
- **THEN** it SHALL pass, including the `useHead` call site in `app.vue` under the stricter unhead v3 types

#### Scenario: Deduped unjs dependency tree
- **WHEN** the lockfile is inspected after the upgrade
- **THEN** only a single major version of `unhead` and `unctx` SHALL be resolved, and no unrelated dependency SHALL have received an unintended major bump

#### Scenario: Existing server handlers keep their contract
- **WHEN** the upgraded application serves an API route whose handler still uses the auto-imported server helpers
- **THEN** the response status, body shape and `{ messageKey, params }` error contract SHALL be identical to the pre-upgrade behavior

#### Scenario: Incompatible Nuxt module blocks the upgrade
- **WHEN** a configured Nuxt module (`@nuxtjs/i18n`, `nuxt-security`, `nuxt-auth-utils`, `@primevue/nuxt-module`, `@nuxt/test-utils`) fails against Vite 8 or unhead v3 and no compatible module release exists
- **THEN** the upgrade SHALL be reverted (dependency bump and lockfile) rather than worked around with forced resolutions or patches

### Requirement: REQ-370 Unified Vite+ toolchain

The repository SHALL run its build, test, lint and format tooling through Vite+ (`vp`). A single `vite-plus` version SHALL be pinned in the pnpm workspace catalog. The catalog SHALL also pin `vite` (to the Vite+ core distribution), `vitest` and `@vitest/coverage-v8` at the versions that `vite-plus` release supports. Workspace overrides SHALL resolve every `vite` and `vitest` dependency to those catalog entries, so the dependency tree contains exactly one Vite and one Vitest. A `vite-plus` upgrade SHALL be applied with `vp migrate`, which re-pins those catalog entries and overrides together. Root orchestration scripts SHALL drive workspace packages with `vp run`, which runs package scripts in workspace-dependency order. The shared library build (`build:packages`) SHALL be cached, so an unchanged library is not rebuilt. CI jobs and the Docker build stage SHALL execute the workspace-pinned `vite-plus` version, and the Docker build image tag SHALL match the catalog version. Node.js and pnpm versions SHALL be resolved from the root `devEngines`, not pinned separately in CI. `vp check` SHALL NOT substitute for the quality gates: it does not run ESLint or type checking, so the gates remain `pnpm lint`, `pnpm format:check` and `pnpm type-check`.

#### Scenario: Single Vite and Vitest in the tree
- **WHEN** the lockfile is inspected
- **THEN** every `vite` and `vitest` dependency, including transitive ones pulled in by Nuxt and test utilities, SHALL resolve to its catalog-pinned version

#### Scenario: Vite+ upgrade moves the whole toolchain
- **WHEN** `vite-plus` is upgraded to a new release
- **THEN** the catalog `vite`, `vitest` and `@vitest/coverage-v8` entries SHALL match the versions that release bundles, and `vp toolchain` SHALL report the same Vitest version the catalog pins

#### Scenario: Partial toolchain bump
- **WHEN** `vitest` or `@vitest/coverage-v8` is bumped on its own, without the `vite-plus` release that bundles that version
- **THEN** the mismatch SHALL be treated as a defect and the bump SHALL NOT be merged

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
