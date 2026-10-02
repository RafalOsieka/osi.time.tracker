# Tasks

## 1. Backend: feed initial page = 7 activity days (REQ-395, D3)

- [x] 1.1 Make the activity-day walk in `feed.get.ts` accept an optional upper cursor and build the initial page from it (7 activity days). Remove `rollingWindowBounds`, `fetchNewestStartedAt`, the newest-day fallback, and `TIMER_VIEW_FEED_INITIAL_DAYS`, plus their now-unused helpers in `server/utils/timer-view-feed.ts`. Verify that `pnpm type-check` passes.
- [x] 1.2 Update `test/unit/timer-view-feed.spec.ts` for the removed and changed helpers. Verify with `pnpm test:unit`.
- [x] 1.3 Rewrite the e2e-api feed cases in `test/e2e/api/timer-view-feed.spec.ts`. Cover these cases: newest seven activity days from ten, gap skipping when history is 60 days old, fewer than seven days with `hasMore` false, never-tracked, and other users excluded. Replace the "last-30-day" and "falls back to newest day" cases. Verify with `pnpm test:e2e:api`.

## 2. Backend: feed `from` range-refresh mode (REQ-395, D4)

- [x] 2.1 Add `from` to `timerViewFeedQuerySchema` (ISO with offset) and add a refine that rejects `before` together with `from` using a new `messageKey`. Add that key to the `en` and `pl` catalogs. Verify with `pnpm test:unit` (`i18n-catalog-parity`) and a schema unit test covering valid `from`, malformed `from`, and both cursors.
- [x] 2.2 Implement the `from` branch in `feed.get.ts`: all entries with `startedAt >= from` (optional upper bound in `fetchEntriesInRange`), then `hasMore` / `nextBefore` from the oldest returned day, with the empty-result fallback to `from`. Verify with `pnpm type-check`.
- [x] 2.3 Add e2e-api cases: whole loaded window in one response, empty range with older history (`hasMore` true, `nextBefore` = `from`'s day start), `422` for both cursors, `422` for malformed `from`. Verify with `pnpm test:e2e:api`.

## 3. Frontend: shell progress indicator and non-blocking navigation (REQ-059, REQ-391, D1, D1a, D2)

- [x] 3.1 Add `<NuxtLoadingIndicator color="var(--ui-primary)" />` inside `UApp` in `app/app.vue`. Verify with a nuxt spec (extend `shell.spec.ts` or `page-render.spec.ts`) that asserts the indicator renders.
- [x] 3.2 `reports/monthly.vue`: switch both `useAsyncData` calls to non-blocking `lazy`. Make sure loading and error states come from `pending` and `error`, and that the empty state is shown only once the data has resolved. Verify with a nuxt spec that mounts the page with a pending report and asserts that the loading state shows and the empty state does not.
- [x] 3.3 `reports/client.vue`: switch presets and trackers to `lazy`. Move `selectFirstPreset()` into a one-shot watcher that runs when presets first resolve, and skip it if the user has already edited the form. Show an error alert when the presets load fails. Verify with `client-report-page.spec.ts` cases for pending presets, late-arriving presets selecting the first one, and the load error.
- [x] 3.4 E2E: add a UI journey that navigates client-side from `/projects` to `/reports/monthly` and to `/` with the API response delayed via `page.route`. Assert that the destination page (skeleton or loading state) is visible before the response is released. Verify with `pnpm test:e2e:ui`.

## 4. Frontend: timer view lazy load, skeleton, single-request refresh (REQ-396, REQ-393, D1, D4)

- [x] 4.1 `pages/index.vue`: make the feed `useAsyncData` `lazy` and add a day-list skeleton (Nuxt UI `USkeleton`, `aria-busy` on the list, localized `aria-label` in `en` and `pl`) shown while the feed is pending and no entries are held. Verify with `timer-view.spec.ts`: pending feed shows the skeleton and not the never-tracked state, and the resolved feed shows the days.
- [x] 4.2 Replace the page-walking `refreshLoadedRange()` with one `from = loadedFrom` request that replaces entries and takes `hasMore` / `nextBefore` from the response. Keep the current list on failure. Verify with `timer-view.spec.ts` cases: after load-more plus an edit, exactly one feed call with `from`; a failed refresh keeps the entries.
- [x] 4.3 Update e2e-ui timer cases to the 7-activity-day initial window: rework "falls back to the newest activity day…" and the load-more journeys (seed more than 7 activity days). Verify with `pnpm test:e2e:ui`.

## 5. Frontend: automatic load more (REQ-392, D5)

- [x] 5.1 Add a sentinel after the last day in `index.vue` with a native `IntersectionObserver` (guarded, `rootMargin` ~600px, disconnected on unmount) that calls `loadMore()`. Add a `loadMoreFailed` flag that stops auto-triggering until a manual click, and a polite `aria-live` loading indicator at the list end. The button stays as the fallback. Verify with `timer-view.spec.ts` (stubbed observer): intersection loads once, no second request while in flight, no request when `hasMore` is false, and after a failure no auto retry while the button still works.
- [x] 5.2 E2E: seed more than 14 activity days, scroll to the bottom without clicking, and assert that older days appear. Verify with `pnpm test:e2e:ui`.

## 6. Frontend: tick isolation (REQ-394, D6)

- [x] 6.1 Change `groupTimeEntriesByDay` to stop taking `now`: the running entry contributes 0 seconds and the group and day get `liveStartedAt`. Add a small `liveSeconds(startedAt, now)` helper. Verify with unit tests in `test/unit` for totals with and without a running entry and for stability of the result across `now` values.
- [x] 6.2 `index.vue`, `TimerTaskGroup.vue`, `TimerEntryRow.vue`: display totals as stored seconds plus live seconds. Pass the ticking `now` only to the live group and running row, and give everything else a stable value. Memoize `scopeForGroup` per project id. Verify with `timer-task-group.spec.ts` and `timer-view.spec.ts`: the running group and day totals advance each second, a stopped group's render count does not change across ticks, and final totals are correct after stop.

## 7. Integration check

- [x] 7.0 Update code comments that cite the superseded REQ-150 / REQ-264 to REQ-396 / REQ-395 (`TimerEntryRow.vue`, `timer-view-ui.spec.ts`, and any added during this change). Verify that `grep -rnwE "REQ-(150|264)" apps packages` returns nothing.

- [x] 7.1 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:nuxt`, and `pnpm test:e2e`. Then manually check with the `trackers:seed` fixture (3 months of logs) that navigating to `/` switches instantly and that scrolling loads older days smoothly.
