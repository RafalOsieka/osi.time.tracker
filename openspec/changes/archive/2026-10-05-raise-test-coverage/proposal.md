# Proposal

## Why

Codecov coverage dropped to about 89%. Locally, the `unit-nuxt` flag alone is at 72.5% lines. Most server routes are covered by `e2e-api`, so the real gaps are client logic no other flag reaches: the monthly report page (44%), `useExtensionReadiness` (0%), the tracker form's save path, and the delete and login flows. Separately, the `e2e-db` suite tests server utilities in-process, but nobody measures it, so files like `server/utils/remote-issue-refs.ts` show up as untested when they are tested.

## What Changes

- Add focused nuxt tests for `useExtensionReadiness`: probing, merging approvals, coalescing rechecks, the SSR guard, and focus/visibility listeners.
- Extract the pure timesheet logic from `pages/reports/monthly.vue` (row building, remote-hours summary, cell warnings) into `app/utils/monthly-timesheet.ts`. Unit-test it there, and test the page wiring that stays behind (secret/adapter errors, month navigation). Rendered behavior does not change.
- Add nuxt tests for the `TrackerFormDialog` save path and server-error-to-field mapping; tracker and project delete flows, including that deleting a tracker clears its browser-held secret; and login success, sanitized redirect and error display.
- Collect in-process Vitest coverage from the `e2e-db` project in the `db` CI job and upload it as a third Codecov flag, `e2e-db`.
- After measuring all three flags, add tests only for server utility branches that no flag reaches.
- Delivered as one PR, with one commit per logical step.

## Non-goals

- Collecting Playwright/UI coverage (client or server side). Journey tests touch a lot of code but assert little, and would inflate the metric.
- Coverage thresholds or merge gating. Coverage stays informational (REQ-026).
- Changing any user-visible behavior, API contract or spec'd feature behavior.
- Chasing 100% or adding smoke/snapshot tests for coverage's sake.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platform-coverage`: adds measured `e2e-db` coverage uploaded as a third flag, and makes Codecov combine `unit-nuxt`, `e2e-api` and `e2e-db`.

## Impact

- `apps/web/test/nuxt/*`, `apps/web/test/unit/monthly-timesheet.spec.ts`: new and extended tests.
- `apps/web/app/pages/reports/monthly.vue`, new `apps/web/app/utils/monthly-timesheet.ts`: refactor only.
- `apps/web/package.json` (coverage script for `e2e-db`), `.github/workflows/ci.yml` (`db` job), `codecov.yml` (new flag), `docs/e2e-guideline.md` (Coverage section).
- Possibly `apps/web/test/e2e/db/*` or `apps/web/test/e2e/api/*`, for gaps found after measuring.
- No runtime, API or dependency changes.
