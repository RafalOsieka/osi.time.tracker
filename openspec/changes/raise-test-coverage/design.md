# Design

## Context

See proposal.md (Why). Relevant current state:

- `apps/web/vitest.config.ts` defines coverage once at the root (`include: app/**, server/**, shared/**` plus the REQ-279 excludes). Every project in the file inherits it, so the `e2e-db` project can be measured with `--coverage` and a different `reportsDirectory`, with no new config.
- The CI `db` job already runs `vp run test:e2e:db` with Postgres. It uploads nothing.
- `useExtensionReadiness` already accepts `{ isClient, probe }` options. Tests can drive it without module mocks. Its only Nuxt dependency is the auto-imported `useActiveTrackers`.
- `pages/reports/monthly.vue` mixes data loading, routing and about 200 lines of pure computation (`rows`, `remoteHoursSummary`, warning rules inside `durationCell`). The existing nuxt spec only covers loading/empty/error states.
- Nuxt component tests follow a set pattern: `mountSuspended`, `mockNuxtImport` for composables, a `vue-i18n` mock that returns keys, and light stubs for Nuxt UI.

## Goals / Non-Goals

**Goals:**
- Every new test asserts behavior a user or the security model relies on (secret cleanup, redirect sanitizing, error-to-field mapping), not just executed lines.
- Pure logic lives where unit tests can reach it without a Nuxt runtime.

**Non-Goals:**
- Refactoring other pages "while we're there". Only `monthly.vue` is restructured.
- New test helpers or shared harness abstractions. Each spec stays self-contained, like its siblings.

## Decisions

### Extract monthly timesheet logic instead of testing it through the page
`app/utils/monthly-timesheet.ts` exports three pure functions:
- `buildTimesheetRows(report, remoteByTracker, remotesReady)`;
- `summarizeRemoteHours(report, remoteByTracker, remotesReady)`;
- `cellWarning(row, cell, kind)`.

Their types (`TrackerRemoteState`, `TrackerCell`, `TimesheetRow`, `RemoteHoursSummary`) move with them. The page keeps `useAsyncData`, `loadRemoteHours`, routing and the `h()` cell renderers, which call `cellWarning`.

*Alternative:* test the computations through `mountSuspended` with a stubbed `UTable` that renders cells. Rejected because it ties logic tests to table rendering and stub fidelity, and every case would need a full mount. The extraction also matches the existing pattern: `shared/utils/monthly-report-split.ts` and `monthly-report-attention.ts` already hold sibling logic.

*Placement:* `app/utils`, not `shared/utils`. The shapes depend on the client-side remote fetch state, and the server never needs them.

### Test `useExtensionReadiness` in the nuxt project through a host component
Use the `use-timer.spec.ts` pattern: mount a throwaway component, mock `useActiveTrackers` with a controllable `trackersById` ref and `ensureAllLoaded`, and inject `probe`. This exercises the real `watch` and `onMounted`/`onUnmounted` listeners.

*Alternative:* a unit-project test with a module mock of `useActiveTrackers`. Rejected because lifecycle hooks need a component instance, and auto-imports would need `vi.mock` (anti-slop `no-module-mocking`).

### Measure e2e-db with Vitest's own coverage, not c8
A new `test:coverage:e2e-db` script runs `vp test run --coverage --project e2e-db --coverage.reportsDirectory=coverage-e2e-db`. The `db` CI job calls it instead of `test:e2e:db`, then uploads `apps/web/coverage-e2e-db/lcov.info` with flag `e2e-db`. Unlike e2e-api, the code runs in the Vitest worker, so the `c8`/sourcemap converter is unnecessary.

*Alternative:* fold db into `test:coverage`. Rejected by REQ-024/REQ-025: the `coverage` job must stay Docker-free.

### Fill server gaps only after merging the three flags
Generate `e2e-api` lcov locally (`NODE_V8_COVERAGE` plus `report-e2e-coverage.ts`) and `e2e-db` lcov, then compare against unit-nuxt per file. Write tests only for lines missing in all three. A query branch goes into the matching `test/e2e/db` spec, and a route contract branch into `test/e2e/api`.

### No new UI e2e for these tasks
Project rules ask for an E2E task for form and flow work. This change adds no new form or flow. It only tests existing ones, and the journeys involved (tracker CRUD, login, monthly report) already have Playwright specs. Component tests cover the branches those journeys skip.

## Risks / Trade-offs

- [Refactor changes monthly report output] → Pure move with unchanged inputs. The existing nuxt spec and the `reports-monthly` UI e2e must stay green. Extract in its own commit before adding tests.
- [Coverage on the db job slows it down] → v8 instrumentation overhead is small next to container startup. Acceptable for an informational metric.
- [Codecov double counts a file across flags] → Codecov merges per line, so a line hit by several flags counts once.
- [Nuxt UI stubs drift from the real components] → Assert on `data-testid` and emitted calls only, never on stub markup.

## Migration Plan

One PR (`test: …`), with one commit per logical step so each can be reverted on its own:
1. The monthly extraction (refactor only).
2. One commit each for the monthly, readiness, and forms/pages/login tests.
3. The e2e-db coverage script, `db` job upload, `codecov.yml` flag and docs.
4. Any gap tests from the merged-flag analysis.

The first upload of a new flag has no base, so Codecov shows `e2e-db` as new on that PR.
