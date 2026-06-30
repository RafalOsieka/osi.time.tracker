## Why

The repository has no `.github/` directory and zero continuous integration, so nothing prevents broken, unformatted, or untested code from landing on `main`. As the solo maintainer adds features, a verify-only Pull Request pipeline plus enforced merge rules is the cheapest way to guarantee `main` always lints, type-checks, tests, and builds.

## What Changes

- Add a GitHub Actions workflow that runs on PRs targeting `main` (and pushes to `main`) with parallel verify jobs: `lint`, `format:check`, `type-check`, `test:unit`, `test:nuxt`, and `build`.
- Add a gated `e2e` job that runs `pnpm test:e2e` only after the cheap jobs pass (`needs:`), self-provisioning `postgres:18-alpine` via the existing Docker harness.
- Cancel superseded runs on the same ref via a `concurrency` group; install with `--frozen-lockfile` and cache the pnpm store keyed on `pnpm-lock.yaml`.
- Enforce Conventional Commits at the PR title (squash-only merges → the PR title becomes the `main` commit) via a PR-title-lint workflow.
- Add Dependabot for the `npm` and `github-actions` ecosystems.
- Document manual GitHub-UI configuration: branch ruleset on `main` (PR-before-merge, required checks, up-to-date branch, conversation resolution), squash-only + linear history, CodeQL default setup, and the `NUXT_SESSION_PASSWORD` secret.

## Capabilities

### New Capabilities
- `ci-pipeline`: Defines requirements for a verify-only Pull Request CI pipeline (triggers, parallel verify jobs, gated e2e, concurrency cancellation, lockfile-integrity install and caching, Conventional-Commit PR-title linting, Dependabot, CodeQL) and the merge-blocking rules that keep unverified PRs out of `main`.

### Modified Capabilities
<!-- None: no existing spec-level behavior changes. -->

## Impact

- **New files**: `.github/workflows/ci.yml`, `.github/workflows/pr-title.yml`, `.github/dependabot.yml`, and a manual GitHub-UI setup guide doc.
- **Runner**: GitHub-hosted `ubuntu-latest` — free/unlimited on a public repo; Docker is preinstalled for the e2e Postgres container.
- **Secrets**: `NUXT_SESSION_PASSWORD` repo secret consumed by the e2e job.
- **Manual steps**: branch ruleset and CodeQL default setup configured in the GitHub UI (not committable to the repo).
- **Dependencies**: no new npm dependencies; relies on GitHub Actions and pinned marketplace actions.

## Non-goals

- Deploy/release, Docker image publishing, registry — separate future proposal.
- Self-hosted runner — revisit with the deploy proposal.
- Required reviews / merge queue — not needed for a solo maintainer.
- `release-please`/changelog automation — future proposal.
