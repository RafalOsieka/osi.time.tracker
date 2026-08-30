## Why

Consultants need a month view of hours they logged in OSI versus hours that actually sit on each remote tracker — including time logged directly in OpenProject or Redmine. `/reports` is still a coming-soon placeholder. Reporting is in-scope (story 8 / WBS 4); this slice is a monthly reconciliation timesheet, not the WBS project-summary or weekly grid.

## What Changes

- Replace the `/reports` placeholder with a **report hub** of cards. First card: monthly timesheet.
- Add `/reports/monthly` with a month picker (default: current month in the user timezone; prev/next; `?month=YYYY-MM`).
- Day table: **Local** hours from time entries; **every active tracker** as App / Direct / Total even when `0:00`; **only days with local or remote hours**; month totals row.
- Split remote hours by matching live `remoteLogId` to `remote_exports` (App = known export, Direct = unmatched).
- Attention (color + icon + tooltip, not color-only): Direct hours, unexported local, remote-only, tracker fetch failure. Rounding `local ≠ App` is tooltip **info only**.
- Durations as unpadded `H:MM` (seconds floored). Running timers are excluded from Local.
- **New** adapter operation: date-range time-log fetch (one bounded-pagination call per tracker, current user, **no** issue filter). OpenProject, Redmine, and the server-mode proxy implement it. Same-day `fetchTimeLogs` is unchanged.
- Sidebar stays a single Reports link to the hub.

## Capabilities

### New Capabilities

- `reports`: hub, monthly timesheet UI, month aggregation API, App/Direct split, attention, `H:MM` display

### Modified Capabilities

- `remote-adapter-contract`: seventh operation — date-range time-log fetch
- `openproject-adapter`: implement the range fetch
- `redmine-adapter`: implement the range fetch
- `frontend-shell`: Reports is a real hub, not a placeholder

## Impact

- **UI:** `app/pages/reports.vue`, `app/pages/reports/monthly.vue`, i18n `en`/`pl`, shell e2e that currently asserts the placeholder
- **API:** `GET /api/reports/monthly`; proxied range time-logs for `server` execution mode
- **Remote:** `RemoteTrackerAdapter`, both provider adapters, client and server-execution wrappers
- **Tests:** unit (range fetch, App/Direct, attention, `H:MM`), e2e API (aggregation), e2e UI (hub + monthly table)

## Non-goals

- Nested sidebar group of report types (later iteration)
- Show/hide tracker columns
- Other reports (weekly, by project, CSV/PDF)
- Clicking a day to open Timer View or Sync
- Persisted remote-log cache
- Columns for soft-deleted trackers
- Treating rounding differences as errors
- Including a running timer in Local totals
