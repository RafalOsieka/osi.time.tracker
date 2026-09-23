## Why

The workspace uses older releases of Oxfmt, concurrently, and Vitest. Updating the development toolchain keeps formatter and test infrastructure current while preserving existing quality gates and avoiding regressions from Vitest 5's breaking changes.

## What Changes

- Upgrade `oxfmt` to the latest compatible release and confirm existing root formatting configuration still produces a clean check.
- Upgrade `concurrently` to the latest compatible release and verify the existing named, colored development processes start and stop correctly.
- **BREAKING (test tooling):** Upgrade every workspace's `vitest` declaration and the matching `@vitest/coverage-v8` version to Vitest 5; replace removed `it.sequential` usage and adapt tests/configuration only where the migration requires it.
- Verify lint, formatting, types, unit/Nuxt/E2E tests, coverage file selection, and development-process behavior. If an integration cannot support Vitest 5 without invasive workarounds, retain Vitest 4 and report the blocker rather than compromising the test suite.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. Existing platform quality and coverage requirements stay unchanged; this is a dependency and test-infrastructure update, so specs are skipped.

## Non-goals

- No product behavior, API, database, or deployment change.
- No unrelated dependency upgrades or broad repository-wide reformatting.

## Impact

Root and workspace manifests, `pnpm-lock.yaml`, Vitest configs and affected UI test; existing `platform-toolchain`, `platform-coverage`, and `platform-lint-format` gates remain authoritative. Development and CI use the existing pnpm scripts and a supported Node runtime (Node 24 matches the repository's runtime declaration); reconcile the stale Node ≥25 OpenSpec context separately rather than changing runtime scope here.