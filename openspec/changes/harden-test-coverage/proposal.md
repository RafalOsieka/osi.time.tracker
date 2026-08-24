## Why

Combined Codecov is 88.46% after e2e-api joined the report, but a large slice of the remaining misses is measurement noise (Drizzle JSON snapshots) or modules tests mock away. Playwright already walks `/settings` and form journeys, and we will **not** count UI coverage. We should raise the number only where it means more logic is actually executed in unit, nuxt, or API e2e.

## What Changes

- Exclude non-executable and never-run files from **Vitest** coverage: `server/db/migrations/**`, `**/*.{sql,json}`, and the bundler-only warmup plugin. Nitro `c8` keeps default filters so compiled `.output` chunks can remap to sources.
- Unit-test `useRemoteSyncClient` (and cheap siblings like `useActiveTrackers`) at their own boundary without mocking the SUT.
- Add a nuxt mount of `/settings` covering timezone persist failure (toast + control restore). Playwright stays the journey owner; this is in-process coverage only.
- Add API e2e for remaining handler error arms: project/tracker PATCH duplicate names, and remote time-log / time-entry proxy auth/connection failures.
- Coverage stays informational. No Playwright/client coverage flag.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `coverage-reporting`: unit-nuxt coverage SHALL omit migrations, SQL/JSON, and the never-run warmup plugin; e2e-api `c8` SHALL NOT reuse those Vitest globs; UI e2e SHALL remain uncounted.
- `sync-day-composables`: capability composable tests SHALL exercise the module under test (no self-mock), including the browser-orchestrated remote client.

## Non-goals

- Playwright/Istanbul client coverage or a third Codecov flag.
- Merge-blocking coverage thresholds.
- Exhaustive branch hunting on `sync/[date].vue` or form-dialog permutations.
- Covering `migrate.ts` CLI `process.exit` / bootstrap-user, or the reports placeholder.
- Live OpenProject/Redmine integration tests.

## Impact

- `vitest.config.ts` coverage `exclude`; `test/e2e/harness/report-e2e-coverage.ts` (`c8` include/exclude).
- New/extended tests under `test/unit`, `test/nuxt`, `test/e2e/api`.
- Docs (`docs/e2e-guideline.md`, maybe `AGENTS.md`) for the ignore list.
- No product API or UI behavior changes.
