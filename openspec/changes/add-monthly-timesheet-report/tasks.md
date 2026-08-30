## 1. Boundary types

- [ ] 1.1 Backend: Add `shared/types` monthly-report query schema (`month` optional `YYYY-MM` calendar month), response DTO, and proxied range time-logs body (`trackerId`, `from`, `to`, optional `userId`). Add `fetchTimeLogsInRange` to `RemoteTrackerAdapter`. Verify `pnpm type-check` accepts the new types.
- [ ] 1.2 Backend tests: Unit-test the month query schema (valid `2026-08`, omitted month, `2026-13`, `2026-00`, garbage) and the range body schema in `test/unit/` (e.g. `monthly-report-schema.spec.ts`). Verify `pnpm test:unit` covers happy path and 422-style invalid months.

## 2. Monthly aggregation API

- [ ] 2.1 Backend: Implement month-bound + local-day bucketing (reuse timer-feed `localDayKey`; stopped entries only; whole duration on `startedAt` day) and `GET /api/reports/monthly` (`requireAuth`, `getDb()`, `getZodQuery`, 422 via `mapZodError`). Return `month`, `timezone`, active `trackers`, local `days` with `localSeconds` > 0, and month `exports`. Verify the handler compiles and is reachable in type-check.
- [ ] 2.2 Backend tests: Unit-test the aggregator — midnight-spanning entry on start day, running timer excluded, empty month, timezone bucket — in `test/unit/` (e.g. `monthly-report-aggregate.spec.ts`). Verify `pnpm test:unit -t` those cases pass.
- [ ] 2.3 Backend tests: E2E API `test/e2e/api/reports-monthly.spec.ts` — 401 unauthenticated; 422 invalid month; isolated user data; happy path with seeded stopped entries, running timer ignored, active tracker listed, export rows returned, soft-deleted tracker omitted. Verify `pnpm test:e2e:api` for this file.

## 3. Date-range adapter operation

- [ ] 3.1 Backend: OpenProject client/adapter `fetchTimeLogsInRange` — `spent_on` `<>d` `[from,to]`, current user, no `entity_id`, same page cap as same-day. Verify existing same-day `fetchTimeLogs` tests still pass.
- [ ] 3.2 Backend tests: Extend `test/unit/openproject-client.spec.ts` (or adapter spec) — range query has no work-package filter, includes unlinked entity logs, bounded pagination, upstream error maps to `RemoteAdapterError`. Verify `pnpm test:unit` for those cases.
- [ ] 3.3 Backend: Redmine client/adapter `fetchTimeLogsInRange` — `from`/`to`, current user, no issue filter, same offset/limit cap. Verify same-day fetch tests still pass.
- [ ] 3.4 Backend tests: Extend `test/unit/redmine-client.spec.ts` — range query has no issue filter, includes unlinked issues, bounded pagination, upstream error mapping. Verify `pnpm test:unit` for those cases.
- [ ] 3.5 Backend: `POST /api/remote/time-logs-range` (auth, CSRF, secret header, owned tracker, adapter range fetch, no persisted secret). Verify the route is registered.
- [ ] 3.6 Backend tests: E2E API for the proxy — 401; 422 missing secret; happy path with fake upstream returning logs. Verify `pnpm test:e2e:api` for this file.
- [ ] 3.7 Frontend: Wire `fetchTimeLogsInRange` on client-execution and server-execution adapters and `useRemoteSyncClient` (or a reports-specific wrapper sharing adapter construction). Verify `pnpm type-check`.
- [ ] 3.8 Frontend tests: Unit-test the client wrapper — one range call, cache key is from/to not per-day, errors map to the time-logs fetch key. Verify `pnpm test:unit` for those cases.

## 4. Report helpers

- [ ] 4.1 Frontend: Pure `shared/utils` (or `app/utils`) helpers — App/Direct by `remoteLogId`; attention reasons (Direct, unexported, remote-only, fetch-failed; rounding-only is not attention); `formatReportDuration` unpadded `H:MM` with seconds floored. Verify the modules export the functions used by the page.
- [ ] 4.2 Frontend tests: Unit-test App/Direct, each attention case including fetch-failure not counting as unexported, `8:00` / `0:00` / `10:05` / `7:50:59` → `7:50`. Verify `pnpm test:unit` for those files.

## 5. Reports hub

- [ ] 5.1 Frontend: Replace `app/pages/reports.vue` with `app/pages/reports/index.vue` hub (card to `/reports/monthly`); `en`/`pl` strings in parity. Verify the coming-soon placeholder is gone and `data-testid` hooks exist for the hub and card.
- [ ] 5.2 Frontend e2e: Update `test/e2e/ui/shell.spec.ts` (and nuxt shell if it assumes the placeholder) so Reports opens the hub, not `placeholder-page-reports`. Verify `pnpm test:e2e:ui` / `pnpm test:nuxt` for those specs.

## 6. Monthly timesheet page

- [ ] 6.1 Frontend: `/reports/monthly` — month query default/prev/next, SSR `useAsyncData` of `GET /api/reports/monthly`, table of local days + empty tracker columns as `0:00`, totals, empty state, 422/error. Verify the page renders with seeded local data in isolation (nuxt or manual).
- [ ] 6.2 Frontend e2e: `test/e2e/ui/reports-monthly.spec.ts` — default current month writes `month=`; `?month=` honored; empty month empty-state; days with local hours listed and zero-hour days omitted; unused active tracker columns show `0:00`. Verify `pnpm test:e2e:ui` for this file.
- [ ] 6.3 Frontend: Hydrate per-tracker range logs, union remote-only days, App/Direct/Total, attention icon+tooltip+color, fetch-failure not `0:00`. Verify keyboard-focus tooltip and accessible name on the attention control.
- [ ] 6.4 Frontend e2e: Extend the monthly UI spec with `page.route` fakes — matched `remoteLogId` counts as App; unmatched as Direct; failed range shows error not zeros; Direct flags attention. Verify `pnpm test:e2e:ui` for those cases.

## 7. Verification

- [ ] 7.1 Frontend: `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:nuxt` stay green.
- [ ] 7.2 Backend tests: `pnpm test:e2e` (or `test:e2e:api` + `test:e2e:ui`) for reports monthly, range proxy, and updated shell stay green.
