# Proposal

## Why

Navigating between pages feels slow, worst when opening the timer view (`/`) with a lot of tracked history, even when no timer is running. Three causes compound: the timer page `await`s its feed fetch, so the router freezes on the old page with no feedback; the initial feed covers 30 calendar days, which mounts hundreds of interactive task groups in one pass; and the day/group list is regrouped every second while a timer runs, re-rendering every group. The timer view is the primary working page (WBS 2.10, 🔴), so the cost lands on the most-used navigation.

## What Changes

- **Non-blocking client navigation (all pages):** client-side route changes no longer wait for page data. Pages render immediately with a loading state (skeleton) and fill in when data arrives. SSR first paint still resolves data on the server. Applies to `/`, `/reports/monthly`, and `/reports/client`, which currently block.
- **Route-change progress indicator:** the app shell shows a progress bar during route changes.
- **Smaller initial timer feed:** the initial feed page returns the newest **7 activity days**, matching the load-more step, instead of a 30-calendar-day window. The "empty window, fall back to the newest day" rule disappears because activity days skip gaps by definition.
- **Automatic load more:** the timer view loads the next page when the user scrolls near the end of the list. The "load more" button stays as the accessible fallback.
- **Single-request refresh:** after edits, the timer view re-fetches its whole loaded range in one request (new feed `from` mode) instead of re-walking page by page.
- **Live ticking scoped to the running group:** the one-second tick updates only the running entry's group, day total, and row; other groups do not re-render.

## Non-goals

- Virtualized list rendering.
- Lazy-mounting row controls (remote issue picker, project popover, tooltips). Revisit if render cost is still noticeable afterwards.
- `<KeepAlive>` page caching.
- Server query tuning; the feed queries are already index-backed.
- Changes to Remote Sync, Projects, Trackers, or Settings data loading, which already do not block navigation.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `tracking-api`: REQ-264 is replaced by REQ-395. The initial feed page becomes 7 activity days, the 30-day fallback is removed, and a `from` range mode is added.
- `tracking-timer-view`: REQ-150 is replaced by REQ-396 (non-blocking client load with skeleton). New: automatic load more (REQ-392), single-request refresh (REQ-393), live ticking scoped to the running group (REQ-394).
- `ui-routing`: REQ-059 adds the route-change progress indicator to the shell. A new requirement makes client navigation non-blocking on page data. REQ-061 is updated to cite the new numbers.
- `workspace-settings`, `tracking-project-mentions`: REQ-165, REQ-168 and REQ-372 are updated to cite REQ-395 / REQ-396 (no behavior change).

## Impact

- `apps/web/server/api/time-entries/feed.get.ts`, `server/utils/timer-view-feed.ts`, `shared/types/time-entry.ts` (query schema, constants).
- `apps/web/app/pages/index.vue`, `app/utils/timer-view-grouping.ts`, `TimerTaskGroup.vue`, `TimerEntryRow.vue`.
- `apps/web/app/pages/reports/monthly.vue`, `reports/client.vue`, `app/app.vue`.
- i18n: skeleton/loading `aria` labels in `en` and `pl`.
- Tests: feed unit and e2e-api, timer view nuxt and e2e-ui, report page nuxt specs.
