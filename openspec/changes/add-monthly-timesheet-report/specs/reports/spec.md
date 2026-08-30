## Purpose

Give the authenticated user a reports hub and a monthly timesheet that reconciles local logged hours with live remote tracker hours, split into app-exported versus logged-directly, so a consultant can see what actually landed on each tracker for a month.

## ADDED Requirements

### Requirement: REQ-288 Reports hub at `/reports`

The application SHALL replace the `/reports` coming-soon placeholder with a private reports hub. The hub SHALL list each available report as a card. The first (and, in this slice, only) card SHALL navigate to the monthly timesheet. The sidebar SHALL continue to expose a single Reports link to `/reports` and SHALL NOT nest report types under that link.

#### Scenario: Authenticated user opens the hub
- **WHEN** an authenticated user navigates to `/reports`
- **THEN** the application SHALL render the reports hub with a monthly-timesheet card and SHALL NOT render the coming-soon placeholder

#### Scenario: Hub card opens the monthly timesheet
- **WHEN** the user activates the monthly-timesheet card
- **THEN** the application SHALL navigate to `/reports/monthly`

#### Scenario: Unauthenticated access is redirected
- **WHEN** an unauthenticated visitor requests `/reports`
- **THEN** the global guard SHALL redirect to `/login` with the hub as the redirect target before any protected markup is sent

### Requirement: REQ-289 Monthly timesheet month selection

The application SHALL expose a private `/reports/monthly` page for one calendar month. The selected month SHALL default to the current month in the user's effective timezone (stored timezone when set, otherwise the same fallback as other timezone-sensitive server consumers: stored or `UTC` on the server). The page SHALL offer previous-month and next-month controls and SHALL keep the selection in the `month=YYYY-MM` query string. Changing the month SHALL reload the timesheet for that month.

#### Scenario: Default is the current month
- **WHEN** an authenticated user opens `/reports/monthly` with no `month` query
- **THEN** the page SHALL show the current calendar month in the effective timezone and SHALL write `month=YYYY-MM` for that month into the URL

#### Scenario: Explicit month is honored
- **WHEN** the user opens `/reports/monthly?month=2026-03`
- **THEN** the page SHALL show March 2026

#### Scenario: Previous and next change the month
- **WHEN** the user activates next month while viewing `2026-08`
- **THEN** the application SHALL navigate to `month=2026-09` and show September 2026

#### Scenario: Invalid month is rejected
- **WHEN** the query is `month=2026-13`, `month=13`, or another non-`YYYY-MM` calendar month
- **THEN** the API SHALL reject the request with status 422 and a `{ messageKey, params }` body, and the page SHALL show a translated error rather than an empty fake month

#### Scenario: Unauthenticated access is redirected
- **WHEN** an unauthenticated visitor requests `/reports/monthly`
- **THEN** the global guard SHALL redirect to `/login` with that path as the redirect target before any protected markup is sent

### Requirement: REQ-290 Monthly table columns, days, and totals

The monthly timesheet SHALL present a table with a Local column (OSI time-entry hours) and, for **every active** (non-soft-deleted) tracker the user owns, a nested group of App, Direct, and Total columns. A tracker with no hours that month SHALL still appear with `0:00` cells. Soft-deleted trackers SHALL NOT appear. The table SHALL list only calendar days of the selected month that have Local hours, App hours, or Direct hours greater than zero. Days with no hours in any column SHALL be omitted. A totals row SHALL sum the visible days per column. Day rows SHALL NOT be links to Timer View or Remote Sync.

#### Scenario: Active tracker with no hours still has columns
- **WHEN** the user owns two active trackers and only one has remote hours in the month
- **THEN** both tracker groups SHALL be shown and the unused tracker's cells SHALL display `0:00`

#### Scenario: Empty days are omitted
- **WHEN** August has local or remote hours only on the 3rd and the 12th
- **THEN** the table SHALL contain those two day rows plus the totals row and SHALL NOT list the other days of August

#### Scenario: Empty month
- **WHEN** the selected month has no local hours, no matching exports that appear on a remote, and no remote hours
- **THEN** the page SHALL show a translated empty state and SHALL NOT render a table of blank days

#### Scenario: Soft-deleted tracker is omitted
- **WHEN** the user has a soft-deleted tracker with historical exports
- **THEN** that tracker SHALL NOT appear as a column group

### Requirement: REQ-291 Server aggregation of local hours and export provenance

The system SHALL expose `GET /api/reports/monthly?month=YYYY-MM` for the authenticated user. The response SHALL include: the resolved month; the timezone used to bucket days; per-day Local totals for stopped time entries whose `startedAt` falls on that local calendar day; the user's active trackers (id and name); and finalized `remote_exports` for that month (at least `localDate`, `remoteLogId`, and `exportDurationSeconds`). Duration for Local SHALL be `stoppedAt - startedAt`. Entries with `stoppedAt` null (running timers) SHALL be excluded. An entry that spans local midnight SHALL be attributed entirely to the local day of `startedAt`, matching Timer View. The endpoint SHALL require authentication, isolate rows to the authenticated user, and emit timestamps as ISO strings where timestamps appear.

#### Scenario: Stopped entries bucket by startedAt local day
- **WHEN** the user has a stopped entry starting 2026-08-03 22:00 in their timezone and stopping the next calendar day
- **THEN** the full duration SHALL appear in Local for 2026-08-03 and SHALL NOT appear on 2026-08-04

#### Scenario: Running timer is excluded
- **WHEN** the user has a running timer during the selected month
- **THEN** that entry SHALL NOT contribute to any Local day total

#### Scenario: Foreign user data is excluded
- **WHEN** another user has time entries or exports in the same month
- **THEN** the response SHALL NOT include those rows

#### Scenario: Missing month defaults on the server
- **WHEN** `GET /api/reports/monthly` is called without `month`
- **THEN** the server SHALL use the current month in the feed timezone (stored timezone, else `UTC`) and return that month in the payload

### Requirement: REQ-292 Live remote hours split into App and Direct

After the monthly aggregation is loaded, the client SHALL fetch date-range time logs once per active tracker for the month's inclusive `from`/`to` local dates via the neutral adapter (REQ-296), using the tracker's execution mode and existing credential rules. It SHALL NOT call the same-day time-log operation once per day. App hours for a tracker-day SHALL be the sum of fetched logs whose `spentOn` is that day and whose `remoteLogId` matches a finalized export for the user. Direct hours SHALL be the sum of fetched logs for that day whose `remoteLogId` does not match any known export. Tracker Total SHALL be App + Direct. A missing browser secret or a failed range fetch SHALL mark that tracker as unavailable for the month: its cells SHALL NOT display `0:00` as if no hours existed.

#### Scenario: Export id matches App
- **WHEN** a remote log for 2026-08-03 has a `remoteLogId` stored on a finalized export
- **THEN** that log's duration SHALL count toward App for that tracker and day and SHALL NOT count toward Direct

#### Scenario: Unrecognized remote log is Direct
- **WHEN** a remote log for the current account exists on 2026-08-03 with a `remoteLogId` that is not in `remote_exports`
- **THEN** that log's duration SHALL count toward Direct for that tracker and day

#### Scenario: One range fetch per tracker
- **WHEN** the monthly page loads with three active trackers
- **THEN** the client SHALL issue at most one date-range time-log fetch per tracker for the month, not one fetch per day

#### Scenario: Fetch failure is not zero
- **WHEN** a tracker's range fetch fails or no secret is available
- **THEN** that tracker column group SHALL show a translated error state and SHALL NOT present `0:00` totals for the month

#### Scenario: Remote-only day appears
- **WHEN** a tracker has Direct or App hours on a day with Local of zero
- **THEN** that day SHALL appear in the table

### Requirement: REQ-293 Attention indicators

The monthly table SHALL mark a day as needing attention when any of these hold after successful fetches: Direct hours > 0 on any tracker; Local > 0 and every successfully fetched tracker has App + Direct = 0 (or the user has no trackers); Local = 0 and any tracker has App or Direct > 0. A tracker fetch failure SHALL mark that tracker (and the day, when the day is listed) as unknown, not as unexported. A Local vs App difference caused only by export rounding SHALL NOT by itself mark the day as needing attention; that difference MAY appear as informational text in a tooltip. Attention SHALL use color plus a non-color cue (icon) and a tooltip that lists the translated reasons; color alone SHALL NOT be the only signal (accessibility REQ-004). Icon-only markers SHALL have an accessible name (REQ-001). Tooltips SHALL be the themed hover/focus tooltip (REQ-269), not the native `title` attribute.

#### Scenario: Direct hours flag the day
- **WHEN** a tracker has Direct hours on a day
- **THEN** that tracker cell and the day SHALL show an attention icon and tooltip stating that remote hours were not exported from the app

#### Scenario: Unexported local flags the day
- **WHEN** Local is 8:00, every tracker range fetch succeeded, and every tracker App and Direct are 0:00
- **THEN** the day SHALL show attention stating local hours did not land on any tracker

#### Scenario: Fetch failure is not treated as unexported
- **WHEN** Local is 8:00 and one tracker range fetch failed
- **THEN** the page SHALL show the fetch-failure state for that tracker and SHALL NOT claim the day is unexported solely because remote totals are unknown

#### Scenario: Rounding-only difference is info
- **WHEN** Local is 7:50 and App is 8:00 with Direct 0:00 and no fetch failures
- **THEN** the day SHALL NOT be marked as needing attention; a tooltip MAY mention the two durations as information

### Requirement: REQ-294 Report durations use unpadded `H:MM`

All durations on the reports hub (if any) and the monthly timesheet SHALL be displayed as unpadded `H:MM` (examples: `0:00`, `8:00`, `10:05`). Whole seconds SHALL be floored to minutes. Timer View and Remote Sync duration formatting SHALL remain unchanged.

#### Scenario: Hours are unpadded
- **WHEN** a cell total is 8 hours
- **THEN** the cell SHALL display `8:00` and SHALL NOT display `08:00` or `08:00:00`

#### Scenario: Seconds are floored
- **WHEN** a total is 7 hours, 50 minutes, and 59 seconds
- **THEN** the cell SHALL display `7:50`

### Requirement: REQ-295 Reports i18n and page chrome

All user-visible reports copy SHALL come from the `en` and `pl` catalogs in parity. The monthly page SHALL use the shared authenticated page header pattern (title plus month controls). Attention icons, month controls, and the hub card SHALL be keyboard operable with visible focus and accessible names.

#### Scenario: Polish catalog covers new strings
- **WHEN** the UI locale is `pl`
- **THEN** hub, month picker, table headers, empty state, errors, and attention tooltips SHALL render Polish strings with no raw English keys

#### Scenario: Month controls are keyboard operable
- **WHEN** a keyboard user tabs to previous/next month
- **THEN** both controls SHALL be reachable, show visible focus, and change the month on activation
