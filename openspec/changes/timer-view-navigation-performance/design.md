# Design

## Context

See proposal.md (Why). Current state relevant to the approach:

- `pages/index.vue`, `reports/monthly.vue` and `reports/client.vue` call `await useAsyncData(...)`. In Nuxt this blocks client navigation until the promise settles. `projects.vue`, `trackers.vue` and `sync/[date].vue` already call `useAsyncData` without `await` and do not block.
- `feed.get.ts` builds the initial page from `rollingWindowBounds(30)` with a newest-day fallback. The load-more path already walks N activity days backwards (`findLoadMoreRangeStart`, one indexed `LIMIT 1` query per day).
- `refreshLoadedRange()` in `index.vue` re-walks feed pages one at a time (up to 50) until it reaches the previously loaded depth.
- `days` in `index.vue` is a computed over `groupTimeEntriesByDay(entries, now, …)`. `now` advances every second while a timer runs, so every group object is recreated and every `TimerTaskGroup` re-renders. `TimerEntryRow` also receives `now`.
- `app.vue` has no route-change progress indicator.

## Goals / Non-Goals

**Goals:**
- Client route changes complete without waiting on page data, using the same pattern on every page.
- Fewer mounted task groups on timer-view entry, and no per-second re-render of groups that are not running.

**Non-Goals:**
- Changing the per-row component structure (see proposal Non-goals). Server-side caching.

## Decisions

### D1. Non-blocking pages: drop `await` and use `lazy: true`, keep SSR
Pages call `useAsyncData(key, fn, { lazy: true })` (or drop `await` where the result is consumed only reactively). On the server Nuxt still awaits the data for SSR, so first paint and REQ-150's SSR guarantee are unchanged. On the client the route resolves at once and `pending` drives a skeleton.
- Any setup-time read of `data.value` moves into a `watch(..., { immediate: true })`. Known case: `reports/client.vue` calls `selectFirstPreset()` at setup, so it must run once when presets first arrive and must not overwrite a form the user is already editing.
- Each page decides between "loading" and "empty" from `pending` plus `data == null`, never from an empty array alone (`isNeverTracked` already includes `feedPending`).
- **Alternative:** a global `experimental` / router option, or a route-level `<Suspense>` timeout. Rejected: Nuxt has no switch that makes every `await useAsyncData` non-blocking, and suspense fallbacks show the previous page or a generic spinner, not a page-shaped skeleton.
- **Alternative:** `<NuxtPage keepalive>`. Rejected for this change: it only helps return visits and needs stale-data refresh on activation.

### D1a. Delayed loading state: one shared composable
A small composable, e.g. `useDelayedPending(pending, 150)`, returns a ref that turns true only after `pending` has stayed true for 150 ms and resets immediately when it settles. Every page uses it for its skeleton or loading state, so fast responses never flash a skeleton (REQ-391). While the delay runs, the page body shows nothing data-dependent: neither the skeleton nor the empty state.
- **Alternative:** a CSS `animation-delay` fade-in on the skeleton. Rejected: the skeleton still mounts and is announced by `aria-busy`, and "not rendered" cannot be asserted in tests.

### D7. Spec renumbering instead of MODIFIED
REQ-264 and REQ-150 are superseded by REQ-395 and REQ-396 (REMOVED + ADDED), because OpenSpec deltas cannot drop individual scenarios from a MODIFIED requirement and the 30-day and fallback scenarios must go. Requirements that only cite the old numbers (`ui-routing` REQ-061, `workspace-settings` REQ-165 / REQ-168, `tracking-project-mentions` REQ-372) are MODIFIED with the new numbers. Code comments citing REQ-150 / REQ-264 are updated alongside.

### D2. Progress bar: `<NuxtLoadingIndicator color="var(--ui-primary)" />` in `app.vue`
It is built into Nuxt and hooks into page-load events, so no custom code is needed. It sits inside `UApp` next to `NuxtRouteAnnouncer`.

### D3. Initial feed is "load more from the top"
The initial page reuses `findLoadMoreRangeStart(userId, +∞, tz, 7)`: start the walk with no upper cursor, take 7 activity days, then run one range query. `rollingWindowBounds`, `fetchNewestStartedAt`, `TIMER_VIEW_FEED_INITIAL_DAYS` and the fallback branch are removed. Initial and load-more paging then share one rule, and future-dated entries are covered naturally.
- Implementation shape: make the cursor optional (`before?: Date`) in the walk, or pass a far-future instant. Prefer the optional cursor because it is explicit.
- **Alternative:** keep a calendar window (e.g. 14 days) plus the fallback. Rejected: two semantics for "a page", and the fallback branch stays.

### D4. Range refresh via feed `from` mode
`timerViewFeedQuerySchema` gains `from` (same ISO-with-offset validation) and a refine that rejects `before` together with `from` (`messageKey` e.g. `error.timeEntryFeedCursorConflict`, added to both catalogs). The handler runs `fetchEntriesInRange(user, from, +∞)` (a new optional upper bound) and computes `hasMore` / `nextBefore` like the other modes. When the result is empty, it falls back to `from` itself for the `hasMore` check. The client's `refreshLoadedRange()` becomes a single call with `from = loadedFrom` (the local start of the oldest loaded day), followed by `replace`. The `loadedFrom` bookkeeping stays and the 50-page loop is deleted.
- **Alternative:** reuse `GET /api/time-entries?from&to` (REQ-148). Rejected: it selects by interval *overlap*, so a cross-midnight entry started before `loadedFrom` would pull in a partial older day, and it has no `hasMore` / `nextBefore`.

### D5. Automatic load more with an IntersectionObserver sentinel
A sentinel element after the last day, observed with `useIntersectionObserver` from VueUse if it is already a dependency, otherwise a small native observer in `onMounted` with `rootMargin: '600px 0px'` so loading starts before the user hits the bottom. The callback calls the existing `loadMore()`, which already guards `loadingMore` / `hasMore`. A `loadMoreFailed` flag stops auto-triggering after an error until a manual button click succeeds. The button stays rendered while `hasMore`, using the same handler. The `root` is the default viewport. `UDashboardPanel`'s scroll body is a descendant, and intersection against the viewport still works for nested scroll containers.

### D6. Tick isolation: group without `now`, add live seconds at the leaves
`groupTimeEntriesByDay` stops taking `now`. A running entry contributes 0 seconds to `totalSeconds`, and the group and day get a `liveStartedAt: string | null` (the running entry's `startedAt`, at most one per page). `days` then depends only on `entries`, `running` and settings, not on `now`.
- Display: `group.totalSeconds + liveSeconds(liveStartedAt, now)`. Only the live group receives `now` (pass `now` only when `isLive`, otherwise a constant `0`, so the prop is stable). The same applies to the day total in `index.vue` and to `TimerEntryRow` (only the running row needs `now`).
- `scopeForGroup()` returns a fresh object each render. Memoize it per project id in a computed map so a parent re-render does not re-render pickers.
- **Alternative:** keep `now` in grouping and rely on `v-memo`. Rejected: `v-memo` keys would have to replicate the same dependency analysis, and it is easier to get wrong silently.

## Risks / Trade-offs

- [`from` refresh returns a large payload after deep scrolling] → still one request instead of N sequential ones. The payload equals what the client already holds, so there is no regression.
- [Setup-time logic in report pages assumes data exists] → covered by D1 (move to watchers) and by nuxt specs that mount the page with pending data.
- [Users used to seeing a full month on open] → auto load more makes older days arrive on scroll, so the visible behavior is "keeps going" rather than "cut off".
- [Intersection observer not supported in a test env] → guard `'IntersectionObserver' in globalThis` (same pattern as `OverflowTooltip`'s `ResizeObserver` guard). The button path keeps e2e deterministic.

## Migration Plan

No data migration. The feed API change is additive (`from`) plus a narrower initial page. The only caller is the web app, deployed together with it. Rollback means reverting the commit.
