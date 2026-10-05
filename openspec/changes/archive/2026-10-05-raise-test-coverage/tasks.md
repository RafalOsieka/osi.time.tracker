# Tasks

All groups ship in one PR (`test: …`), one commit per group; group 7 runs before opening it.

## 1. Frontend: extract monthly timesheet logic (refactor, own commit)

- [x] 1.1 Move `TrackerRemoteState`, `TrackerCell`, `TimesheetRow`, `RemoteHoursSummary` and the `rows` / `remoteHoursSummary` computations from `app/pages/reports/monthly.vue` into `app/utils/monthly-timesheet.ts` as `buildTimesheetRows` and `summarizeRemoteHours`. The page calls them from its `computed`s. Verify `reports-monthly-page.spec.ts` stays green and `pnpm type-check` passes.
- [x] 1.2 Extract the `direct` / `remoteOnly` rule from `durationCell` into `cellWarning(row, cell, kind)` in the same module, used by the page. Verify the same suite stays green and `pnpm lint` reports nothing new.

## 2. Frontend: monthly timesheet tests

- [x] 2.1 Add `test/unit/monthly-timesheet.spec.ts` for `buildTimesheetRows`:
  - dates are the union of local and remote days, sorted;
  - a failed tracker marks its cells `failed` while others still count;
  - the totals row sums app/direct per tracker;
  - `warnUnexported` appears only once remotes are ready;
  - an empty month returns no rows (no lone totals row).

  Verify with `pnpm exec vp test run -t "buildTimesheetRows"` from `apps/web`.
- [x] 2.2 Add unit cases for `summarizeRemoteHours`: pending before ready, `ok` with 0 when there are no trackers, `ok` sum, `partial`, `failed`. Add cases for `cellWarning`: direct > 0, remote-only app time, no warning on the totals row. Verify the spec passes.
- [x] 2.3 Extend `test/nuxt/reports-monthly-page.spec.ts`:
  - a tracker without a secret shows the fetch-failed cell and the `failed` remote summary;
  - an adapter rejection fails only that tracker while the others stay loaded (the mapped error key is not rendered, so the observable effect is tested);
  - prev/next push the adjacent `month` query;
  - a default month from the response is written to the URL with `replace`.

  Verify with `pnpm test:nuxt`.

## 3. Frontend: extension readiness tests

- [x] 3.1 Add `test/nuxt/use-extension-readiness.spec.ts` with a host component, a mocked `useActiveTrackers` and an injected `probe`. Cover:
  - only direct-access trackers → `neutral` / `notRequired` with no probe;
  - an extension-required tracker → probe runs and `onProgress` snapshots apply;
  - `destinationApproved` survives a later `null` result;
  - SSR (`isClient: false`) never probes.

  Verify with `pnpm test:nuxt`.
- [x] 3.2 In the same spec, cover:
  - concurrent `recheck()` calls coalesce into one in-flight run plus one queued run;
  - `focus` and a visible `visibilitychange` trigger a recheck, while `hidden` does not;
  - listeners are removed after unmount;
  - a tracker change (`directBrowserAccess`) triggers a recheck.

  Verify the spec passes and `use-extension-readiness.ts` is at full line coverage in `pnpm test:coverage`.

## 4. Frontend: tracker form, delete flows and login tests

- [x] 4.1 Extend `test/nuxt/tracker-form-dialog.spec.ts`:
  - create POSTs the payload, stores the secret only when one is entered, calls `putTracker`, emits `saved` and closes;
  - edit PATCHes `/api/trackers/:id`.

  Verify with `pnpm test:nuxt`.
- [x] 4.2 In the same spec, cover server errors: `error.trackerName*`, `error.trackerBaseUrl*` and `error.trackerSystemType*` keys render under the matching field, and any other key shows an error toast instead. Verify the spec passes.
- [x] 4.3 Extend `test/nuxt/trackers.spec.ts` with delete:
  - confirm → DELETE, `clearSecret` and `dropTracker` for that id, list refetch, success toast;
  - cancel → no request and the secret is kept;
  - failure → error toast and the secret is kept.

  Verify with `pnpm test:nuxt`.
- [x] 4.4 Extend `test/nuxt/projects.spec.ts` with delete: confirm → DELETE plus refetch, cancel → no request, failure → error toast. Verify the spec passes.
- [x] 4.5 Extend `test/nuxt/login-validation.spec.ts`:
  - success navigates to a same-origin `redirect`;
  - an external `redirect` falls back to the sanitized default;
  - a rejected login shows the translated error with `aria-invalid` and `aria-describedby`;
  - a client validation error shows the first message.

  Verify the spec passes.

## 5. Backend/CI: measure e2e-db coverage

- [x] 5.1 Add `test:coverage:e2e-db` to `apps/web/package.json` (`vp test run --coverage --project e2e-db --coverage.reportsDirectory=coverage-e2e-db`), and add `coverage-e2e-db` to `.gitignore` next to `coverage-e2e-api`. Verify that running it locally writes `apps/web/coverage-e2e-db/lcov.info` listing `server/utils/remote-issue-refs.ts` as covered, with no migration SQL/JSON or test files.
- [x] 5.2 In `.github/workflows/ci.yml`, make the `db` job run the new script and upload `apps/web/coverage-e2e-db/lcov.info` with flag `e2e-db` (pinned `codecov/codecov-action`, `CODECOV_TOKEN`, `if: success()`). Add the `e2e-db` flag with `apps/web/server/` and `apps/web/shared/` paths to `codecov.yml`. Verify the workflow passes `actionlint`, or a local YAML parse, and the PR's Codecov comment lists three flags.
- [x] 5.3 Update the Coverage section of `docs/e2e-guideline.md` (three flags, how e2e-db is measured, UI still excluded and why). Verify the documented command matches the script name.

## 6. Backend: fill gaps no flag reaches

- [x] 6.1 Merge the `unit-nuxt` + `e2e-api` line coverage of the current `main` commit (Codecov API; a local Windows run cannot dump Nitro coverage because the server is killed without a clean exit) with the local e2e-db lcov, and list `server/` lines missing in all three. Record the list in the PR description. Verify the list exists and names files and lines.
  - Outcome: server utilities (`report-presets.ts`, `tasks.ts`, `time-entries.ts`, `users.ts`) were already fully covered by e2e-api, and e2e-db adds no new lines. The 113 remaining lines are in route handlers: deterministic error contracts, plus unreachable `!inserted`/`!updated` 500 guards and unique-violation race fallbacks behind a pre-check.
- [x] 6.2 For each deterministic remaining route branch, add a case to the matching `test/e2e/api` spec asserting status and `messageKey`: export finalization with repeated entry ids, an unknown task and an entry of another task; task patch with an unknown or foreign project; link for a day without completed entries; project list filtered to local projects. Leave unreachable 500 guards and race-only fallbacks untested. Verify with `pnpm test:e2e:api`; the PR's Codecov report confirms the lines.

## 7. Integration checks (before the PR)

- [x] 7.1 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit` and `pnpm test:nuxt`, plus `pnpm test:e2e` (db, api and the monthly refactor's UI journey). All pass.
  - Outcome: all pass; `pnpm test:e2e` 288/289 with one pre-existing time-of-day flake in `timer-view-ui.spec.ts` ("retyping the same minute…": `(minute + 2) % 60` wraps to an earlier time when the seeded stop falls at :58/:59). It passes on rerun and is untouched by this change.
- [x] 7.2 Run `pnpm test:coverage` and report the unit-nuxt line coverage before and after in the PR description. Verify the number went up and no previously covered file dropped.
  - Outcome: unit-nuxt lines 72.45% → 76.83% (branches 66.36% → 70.01%, functions 75.78% → 80.12%); no file lost coverage.
