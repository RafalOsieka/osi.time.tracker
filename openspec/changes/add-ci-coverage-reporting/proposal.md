# Proposal: add-ci-coverage-reporting

## Why

CI runs lint, type-check, unit, nuxt, e2e, and build (see `ci-pipeline` spec), but nothing measures or reports test coverage. As the domain model grows (`docs/wbs.md`), maintainers and PR reviewers have no visibility into which code paths tests actually exercise. This change adds coverage measurement and rich per-PR reporting in GitHub so coverage becomes a visible, reviewable signal.

## What Changes

- Add Vitest coverage support via `@vitest/coverage-v8` (Vitest 4), configured in `vitest.config.ts` with the `v8` provider, `lcov` + `json-summary` + `text` reporters, `app/`, `server/`, and `shared/` as coverage sources, and test/config/generated files excluded.
- Measure coverage from the **unit + nuxt** projects together in a single Vitest run (deterministic, fast). The **e2e** suite is intentionally excluded from coverage (built child process + Postgres makes instrumentation noisy and slow).
- Add a `test:coverage` script and a new **`coverage`** CI job that runs the two projects with coverage and produces an `lcov` report.
- Upload the report to **Codecov** (free for OSS) via the pinned `codecov/codecov-action`, giving PR comments, diff coverage, trend graphs, and a README badge.
- Configure Codecov as **report-only** (`informational: true` in `codecov.yml`) — no threshold gate yet; establish a baseline first.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ci-pipeline`: add a coverage-measurement job (unit + nuxt), Codecov upload/reporting, and the report-only (non-gating) policy, honoring the existing pinned-actions and least-privilege requirements.

## Non-goals

- No coverage threshold / merge gating (deferred; report-only for now).
- No e2e or server-route coverage instrumentation.
- No changes to the existing verify jobs, application logic, or test behavior.

## Manual Setup Notes

- Link the repository on [codecov.io](https://codecov.io) (sign in with GitHub, add the org/repo).
- For a public repository, uploads can typically be tokenless via the GitHub OIDC/Actions integration; only add a `CODECOV_TOKEN` repository secret if tokenless upload is unavailable or fails.
- No other manual configuration is required — `codecov.yml` in the repo controls the report-only status policy.

## Impact

- **New**: `codecov.yml`, `coverage` CI job in `.github/workflows/ci.yml`, `test:coverage` script, `@vitest/coverage-v8` devDependency, README coverage badge.
- **Changed**: `vitest.config.ts` (coverage block), `package.json`, `.gitignore` (ignore `coverage/`).
- **External**: repo must be linked to Codecov; tokenless upload for public repo (or `CODECOV_TOKEN` secret).
