## MODIFIED Requirements

### Requirement: REQ-021 Automated dependency and action updates
The system SHALL provide a Dependabot configuration covering the `npm`, `github-actions` and `docker` ecosystems, so dependencies, pinned actions and Dockerfile base images are kept current automatically. Dependabot SHALL NOT propose updates to the Vite+-managed toolchain (`vite-plus`, `vite`, `vitest`, `@vitest/*`, `@voidzero-dev/*` and the Vite+ Docker build image), which move together through the Vite+ upgrade path (platform-toolchain REQ-370). Dependabot SHALL group `nuxt` and `@nuxt/*` updates into a single pull request.

#### Scenario: Dependabot opens update PRs
- **WHEN** a tracked npm dependency, pinned GitHub Action, or Dockerfile base image has a newer version
- **THEN** Dependabot SHALL open a pull request that is itself verified by the CI workflow

#### Scenario: Vite+-managed packages are left to the Vite+ upgrade
- **WHEN** a newer `vite-plus`, `vitest`, `@vitest/*` or `@voidzero-dev/*` package, or a newer Vite+ Docker build image, is published
- **THEN** Dependabot SHALL NOT open a pull request for it

#### Scenario: Vite+ bumps are split across ecosystems
- **WHEN** a pull request changes the `vite-plus` catalog version but not the Vite+ Docker build image tag, or the tag but not the catalog
- **THEN** that pull request SHALL NOT be merged while the versions disagree (platform-toolchain REQ-370)

#### Scenario: Non-Vite+ Docker base images stay tracked
- **WHEN** a newer `node` base image used by the Dockerfile is published
- **THEN** Dependabot SHALL still open a pull request for it

#### Scenario: Nuxt packages update together
- **WHEN** `nuxt` and one or more `@nuxt/*` packages have newer versions in the same Dependabot run
- **THEN** Dependabot SHALL open one grouped pull request for them rather than one pull request per package
