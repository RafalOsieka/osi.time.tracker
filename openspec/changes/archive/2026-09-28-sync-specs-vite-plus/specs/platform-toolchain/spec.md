# Spec Delta

## ADDED Requirements

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
