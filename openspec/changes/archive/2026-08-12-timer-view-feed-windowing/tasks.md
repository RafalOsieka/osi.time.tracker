## 1. Shared types and date helpers

- [x] 1.1 Backend/shared: Add `TimerViewFeedDto` / query schema (`before?`) and remove `LatestTimeEntryDto` / weekStart from `shared/types` (`time-entry`, `user-settings`, auth user settings shape)
- [x] 1.2 Frontend util: Strip `weekStart` from `DateTimeSettings` / `browserDateTimeSettings`; replace or slim `computeWindowRange` for any remaining client needs (day keys only); update unit tests in `test/unit/date-time.spec.ts` and `test/unit/timer-view-grouping.spec.ts`

## 2. Drop weekStart (DB + API)

- [x] 2.1 Backend: Remove `weekStart` from Drizzle `users` schema; generate and commit migration dropping `week_start`
- [x] 2.2 Backend: Update `GET`/`PATCH /api/user/settings`, login session payload, and any mappers to timezone-only settings
- [x] 2.3 Backend tests: Update unit/e2e user-settings tests (`user-settings-schema`, `user-settings` e2e) for no `weekStart` and rejection/absence of week-start field

## 3. Timer feed API

- [x] 3.1 Backend: Implement `GET /api/time-entries/feed` (30-day window, newest-day fallback, load-more 7 activity days, `hasMore`/`nextBefore`, feed TZ = stored or UTC)
- [x] 3.2 Backend: Delete `GET /api/time-entries/latest` route and dead references
- [x] 3.3 Backend tests: Integration/e2e coverage for feed — never tracked, 30-day hit, empty-30 fallback to newest day, load more across gaps, `hasMore` false at end, unauthenticated/invalid `before` error

## 4. Settings UI

- [x] 4.1 Frontend: Remove week-start control and related state from `app/pages/settings.vue` and `useUserSettings`; clean i18n keys for week start
- [x] 4.2 Frontend tests: Update `test/nuxt/use-user-settings.spec.ts` and e2e `user-settings-ui` / settings flows (no week-start interaction)

## 5. Timer view page + add entry

- [x] 5.1 Frontend: Rework `app/pages/index.vue` — SSR feed via `useRequestFetch`, drop anchor/banner/empty-window/per-day add, page header `TableHeader` + load more when `hasMore`, merge running entry, smart-include after add
- [x] 5.2 Frontend: Extend `TimerAddEntryDialog` with date field (default today in effective TZ); wire open from page header
- [x] 5.3 Frontend unit/nuxt: Update `test/nuxt/timer-view.spec.ts` (and dialog tests if any) for new feed/header/no-banner behavior
- [x] 5.4 Frontend e2e: Update `test/e2e/timer-view-ui.spec.ts` — never-tracked CTA, 30-day vs newest-day fallback, load more hide, page-level add entry with date, smart include; remove anchored-week cases

## 6. Cleanup and verification

- [x] 6.1 Grep-remove stale `weekStart` / `latest` / anchored-banner testids and i18n; fix type-check fallout
- [x] 6.2 Run relevant suites: `pnpm test:unit`, `pnpm test:nuxt`, `pnpm test:e2e` (timer + settings), `pnpm type-check`, `pnpm lint`
