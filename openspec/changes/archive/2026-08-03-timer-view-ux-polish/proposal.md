## Why

Two rough edges hit daily use of the timer view. Opening the app early in a fresh week shows an empty page whose only call to action is "load more", so the user has to click backwards to reach their own work. And the top-bar title autocomplete offers no way to commit a typed title that collides with an existing task name — the open suggestion overlay swallows Enter, so a new project-less task with a familiar name cannot be created from the keyboard.

## What Changes

- Add `GET /api/time-entries/latest`, returning the `startedAt` of the user's newest entry or `null`. The client centres its `weekStart`-aligned window on that instant on first load, so the timer view opens on the week that actually contains work.
- Distinguish **"no entries in this window"** from **"never tracked anything"**: a first-time user gets a start-tracking empty state instead of a "load more" button, and a user landing on a non-current week is told which week is shown with a way back to today.
- Add a `… (new task)` sentinel row to the top-bar title autocomplete (Nuxt UI `UInputMenu` `create-item` + `@create`), wired to the existing free-form-title path so the entry is created from the typed text with no task binding, even when suggestions match that text.

## Non-goals

- No change to `GET /api/time-entries`' `from`/`to` contract, and no day/timezone logic on the server (REQ-148 stays timezone-pure).
- No arbitrary week navigation (date picker, previous/next week paging) — only the initial anchor plus the existing "load more".
- No change to task identity, matching, merging, or remote issue references — that is `per-day-remote-issue-refs`.
- No new task row per creation: the sentinel still resolves through find-or-create in the project-less scope (REQ-136 uniqueness unchanged).

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `time-tracking`: adds the newest-entry anchor endpoint; the timer view's initial window is anchored on the newest entry instead of always "now", the empty state distinguishes an empty window from no entries at all, and the top-bar autocomplete gains an explicit create-new-task option so a free-form title can be committed even when it matches existing suggestions.

## Impact

- New `server/api/time-entries/latest.get.ts` + `shared/types/time-entry.ts` (`LatestTimeEntryDto`).
- `app/pages/index.vue` — initial window anchoring, non-current-week banner, split empty states.
- `app/utils/timerViewGrouping.ts` — anchor-aware `computeWindowRange`.
- `app/components/AppTimer.vue` — `create-item` sentinel and `@create` handler.
- `i18n/locales/en.json` / `pl.json` — create-option, anchored-week and empty-state strings.
