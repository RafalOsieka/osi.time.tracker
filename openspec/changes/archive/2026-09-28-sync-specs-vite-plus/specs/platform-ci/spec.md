# Spec Delta

## MODIFIED Requirements

### Requirement: REQ-016 Lockfile-integrity install with caching
Each job SHALL set up the toolchain with the pinned Vite+ setup action, and SHALL install dependencies from the repository root with `vp install --frozen-lockfile`. Node.js and pnpm SHALL be resolved from the root `devEngines`, not pinned separately in the workflow. The setup step SHALL enable dependency caching keyed on the lockfile. Jobs that need only a subset of the workspace MAY install with a workspace filter and `--ignore-scripts`, provided the install remains frozen.

#### Scenario: Install succeeds with an in-sync lockfile
- **WHEN** `pnpm-lock.yaml` is in sync with `package.json`
- **THEN** `vp install --frozen-lockfile` SHALL succeed, restoring cached dependencies when available

#### Scenario: Out-of-sync lockfile fails fast
- **WHEN** `pnpm-lock.yaml` is out of sync with `package.json`
- **THEN** `vp install --frozen-lockfile` SHALL fail and the job SHALL report red

#### Scenario: Runtime follows devEngines
- **WHEN** the root `devEngines` Node.js or pnpm range changes
- **THEN** CI jobs SHALL run on a version in the new range without a separate workflow edit

### Requirement: REQ-021 Automated dependency and action updates
The system SHALL provide a Dependabot configuration covering the `npm`, `github-actions` and `docker` ecosystems, so dependencies, pinned actions and Dockerfile base images (including the Vite+ build image) are kept current automatically.

#### Scenario: Dependabot opens update PRs
- **WHEN** a tracked npm dependency, pinned GitHub Action, or Dockerfile base image has a newer version
- **THEN** Dependabot SHALL open a pull request that is itself verified by the CI workflow

#### Scenario: Vite+ bumps are split across ecosystems
- **WHEN** Dependabot bumps the `vite-plus` catalog version and the Vite+ Docker image in separate pull requests
- **THEN** neither pull request SHALL be merged on its own while the versions disagree (platform-toolchain REQ-370)
