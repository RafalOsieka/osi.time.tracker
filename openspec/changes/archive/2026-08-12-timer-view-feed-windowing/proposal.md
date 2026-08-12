## Why

The timer view still uses a week-aligned, latest-entry-anchored 7-day window with an anchored-week banner and calendar load-more that can fetch empty gaps. That model confuses users, depends on `weekStart`, and blocks SSR of the list. We need a simpler rolling feed aligned with how people actually review time.

## What Changes

- Replace the anchored 7-day window with a **last-30-calendar-days** feed (effective timezone); if that window is empty but history exists, load **all entries from the single newest local day** that has data.
- **Load more** extends by **7 distinct activity days** (days with ≥1 entry), not 7 calendar days; hide the control when nothing older remains (`hasMore`).
- **SSR** the initial feed (`entries` + `hasMore`) so the list paints on first render.
- Move **Add entry** to a page-level header action (like Trackers); dialog gains a **date** field (default today); **smart-include** days outside the loaded set after create.
- Remove the anchored-week banner, page dependency on `GET /api/time-entries/latest`, and the empty-window-only state (never-tracked empty state stays, CTA focuses `AppTimer`).
- **BREAKING:** remove account **`weekStart`** from DB, session, settings API, and Settings UI (weekly reports can reintroduce later if needed).

## Non-goals

- Timer group/row density, bulk-assign UX, remote-issue chrome, continue placement.
- Auto-persisting browser timezone.
- Weekly timesheet / reports redesign.
- Fixing every hydration edge when `timezone` is still null (UTC SSR → browser upgrade remains; fix only if this change surfaces hard failures).

## Capabilities

### New Capabilities

- _(none)_

### Modified Capabilities

- `time-tracking`: timer-view feed windowing, load-more, SSR list, add-entry entry point, drop latest-anchor page behavior (and latest endpoint if unused).
- `user-settings`: drop `weekStart` persistence, API, settings UI, and date-utils coupling.
- `frontend-pages`: home timer page header pattern and SSR list expectations if specified there.

## Impact

- Frontend: `app/pages/index.vue`, `TimerAddEntryDialog`, settings page, `useUserSettings`, `timerViewGrouping` / date utils, i18n.
- Backend: time-entries list/feed API, optional remove `latest`, user settings schema/API/session/login, DB migration drop `week_start`.
- Tests: unit, nuxt, e2e for timer view and user settings; OpenSpec main specs on archive.
- In scope of WBS 2.2 / 2.10 / 7.1; drops WBS 7.2 until reports need it.
