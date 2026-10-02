# tracking-client-report Specification

## Purpose

Gives the user a per-client monthly timesheet PDF built only from the time logs recorded on the client's trackers, ready to hand to the client.

## Requirements

### Requirement: REQ-384 Client report page and month selection
The application SHALL expose a private `/reports/client` page using the shared authenticated page header (title plus month controls). The selected month SHALL default to the current month in the user's effective timezone, SHALL be kept in the `month=YYYY-MM` query string, and SHALL change with previous/next controls. An invalid `month` value SHALL show a translated error and SHALL disable export instead of guessing a month. The page SHALL show a translated placeholder where a report preview will later appear. Unauthenticated visitors SHALL be redirected by the global guard.

#### Scenario: Default month
- **WHEN** an authenticated user opens `/reports/client` without a `month` query
- **THEN** the page SHALL select the current month in the effective timezone and write it to the URL

#### Scenario: Next month
- **WHEN** the user activates next month while viewing `2026-09`
- **THEN** the URL SHALL become `month=2026-10`

#### Scenario: Invalid month
- **WHEN** the query is `month=2026-13`
- **THEN** the page SHALL show a translated error and the export action SHALL be disabled

#### Scenario: Unauthenticated access
- **WHEN** an unauthenticated visitor requests `/reports/client`
- **THEN** the guard SHALL redirect to `/login` with that path as the redirect target

### Requirement: REQ-385 Preset selection and inline preset form
The page SHALL load the user's report presets (REQ-381) and SHALL preselect the most recently used one. It SHALL offer a preset selector whose last option is a translated "new preset" entry that switches the form to an unsaved preset, and an inline form with client name, a checkbox list of the user's active trackers, hours format (`H:MM` or decimal), and PDF language (`en` or `pl`). With no presets the selector SHALL show the "new preset" entry and the form SHALL start empty with the hours format `decimal` and the PDF language equal to the current UI locale. A preset that reports inactive trackers SHALL show a translated warning naming how many trackers were removed. The page SHALL offer deleting the selected preset after a confirmation. Because export saves the preset (REQ-386), the export action SHALL be labelled "save and export" while the form holds a new preset or differs from the selected saved preset, and "export" otherwise. Form validation SHALL mirror REQ-380 and SHALL show translated field errors before any request is sent.

#### Scenario: Last used preset is preselected
- **WHEN** the user has presets A and B and B was used last
- **THEN** the page SHALL open with B selected and its values in the form

#### Scenario: First visit
- **WHEN** the user has no presets and the UI locale is `en`
- **THEN** the selector SHALL show "new preset", the form SHALL be empty with hours format `decimal` and PDF language `en`, and the export action SHALL read "save and export"

#### Scenario: New preset from the selector
- **WHEN** the user picks "new preset" in the selector
- **THEN** the form SHALL reset to the first-visit defaults without any request

#### Scenario: Export label follows unsaved changes
- **WHEN** a saved preset is selected unchanged, and the user then edits its client name
- **THEN** the export action SHALL read "export" before the edit and "save and export" after it

#### Scenario: Removed tracker warning
- **WHEN** the selected preset reports one inactive tracker
- **THEN** the page SHALL show a translated warning and the form SHALL list only active trackers

#### Scenario: Invalid form blocks export
- **WHEN** the client name is empty or no tracker is checked
- **THEN** the export action SHALL show translated field errors and SHALL NOT call any API or tracker

### Requirement: REQ-386 Export assembles the report only from remote time logs
Activating Export PDF SHALL first save the form (create for a new preset, update for an existing one, per REQ-382). It SHALL then, for every tracker in the preset, fetch the current account's time logs for the selected month's first through last local day through the tracker's execution path (client or extension), using the browser-held secret. The report SHALL be built only from those logs plus the trackers' name, system type, and base URL, and the user's display name and email; OSI time entries, tasks, and export provenance SHALL NOT be read. If saving fails, a tracker has no secret, the extension is unavailable or incompatible, or any fetch fails, the export SHALL stop, SHALL show a translated error naming the affected tracker, and SHALL NOT produce a file. If the fetches succeed but return no logs, the page SHALL show a translated "nothing logged" message and SHALL NOT produce a file. While exporting, the action SHALL show a busy state and SHALL NOT start a second export.

#### Scenario: Two trackers are combined
- **WHEN** the preset has an OpenProject and a Redmine tracker with logs in the month
- **THEN** the PDF SHALL contain the logs of both trackers in one table

#### Scenario: Logs logged directly in the tracker are included
- **WHEN** a remote log was created in the tracker's own UI and never exported from OSI
- **THEN** it SHALL appear in the PDF like any other log

#### Scenario: One tracker fails
- **WHEN** one tracker's fetch fails and the other succeeds
- **THEN** no file SHALL be produced and the page SHALL show a translated error naming the failed tracker

#### Scenario: Missing secret
- **WHEN** a preset tracker has no secret stored in this browser
- **THEN** the export SHALL stop before any tracker request and SHALL name that tracker

#### Scenario: Empty month
- **WHEN** every tracker returns no logs for the month
- **THEN** the page SHALL show a translated "nothing logged" message and SHALL NOT produce a file

### Requirement: REQ-387 Grouping, ordering, and totals
The report SHALL contain only days that have at least one log, in ascending date order, keyed by each log's `spentOn` day. Within a day, logs SHALL be ordered by tracker (preset order), then remote issue id (numeric when both ids are numeric, otherwise lexical), then remote log id (numeric when numeric, otherwise lexical). Each log SHALL be its own row. Every duration SHALL be shown in the preset's hours format: `hm` as unpadded `H:MM` with seconds floored to minutes; `decimal` as hours rounded half-up to two decimals using the PDF locale's decimal separator (`3,50` for `pl`, `3.50` for `en`). Day totals, per-tracker totals, and the month total SHALL each equal the sum of the row values as displayed, so every printed total adds up from the printed rows.

#### Scenario: Days without logs are omitted
- **WHEN** logs exist only on the 1st and the 3rd
- **THEN** the table SHALL contain exactly those two days

#### Scenario: Ordering within a day
- **WHEN** a day has Redmine `#112` and OpenProject `#4821` logs and the preset lists OpenProject first
- **THEN** the OpenProject rows SHALL precede the Redmine rows

#### Scenario: Decimal totals add up on paper
- **WHEN** a day has three logs of 20 minutes each in `decimal` format
- **THEN** each row SHALL show `0,33` (locale `pl`) and the day total SHALL show `0,99`

#### Scenario: H:MM floors seconds
- **WHEN** a log lasts 7 hours, 50 minutes, and 59 seconds in `hm` format
- **THEN** its row SHALL show `7:50`

### Requirement: REQ-388 Title page content
The first PDF page SHALL be a title page with no table, running header, or page number. It SHALL show: the application name and mark; the localized heading "Timesheet for" followed by the preset's client name; the month name and year; the inclusive date range of the month; the contractor's display name (or email when the display name is empty) and email; the month total, the number of days with logs, and the number of logs; and the data sources as each preset tracker's name and host. When the preset has two or more trackers, each data source SHALL also show that tracker's total; with one tracker the per-tracker total SHALL be omitted. The footer SHALL show the generation date and time with the user's effective timezone name.

#### Scenario: Multiple trackers show their totals
- **WHEN** the preset has two trackers with 98.25 h and 44.25 h
- **THEN** the data sources SHALL show both totals and the month total SHALL show 142.50 h (in the locale's format)

#### Scenario: Single tracker hides its total
- **WHEN** the preset has one tracker
- **THEN** the data source SHALL show only its name and host

#### Scenario: Missing display name
- **WHEN** the user has no display name
- **THEN** the contractor SHALL be shown by email

### Requirement: REQ-389 Table pages content
After the title page the PDF SHALL present a table with Date, Task, and Hours columns whose header row repeats on every page. The Date cell SHALL span all of a day's rows and show the weekday and date. The Task cell SHALL show, in three lines: the tracker name and the remote issue id as a link to the issue URL derived from the tracker's base URL and system type; the remote issue title; and the log's activity in brackets followed by the comment. A `null` issue title SHALL be replaced by a translated "issue not available" text, a `null` activity SHALL omit the brackets, and a missing comment SHALL show a translated "(no comment)". Each day SHALL end with a day-total row, and the last page SHALL end with a month-total row. Every table page SHALL carry a running header (report title, month, client name) and a footer (contractor, generation date and time, "page X of Y"). A day's rows and its total row SHALL NOT be split across pages unless the day alone exceeds a page.

#### Scenario: Issue id is a link
- **WHEN** a row belongs to OpenProject work package `4821` on `https://op.example`
- **THEN** the issue id text SHALL link to `https://op.example/work_packages/4821`

#### Scenario: Hidden issue
- **WHEN** a log's remote issue title is `null`
- **THEN** the title line SHALL show the translated "issue not available" text and the id SHALL still link to the issue

#### Scenario: Missing comment
- **WHEN** a log's comment is empty and its activity is `Development`
- **THEN** the third line SHALL show `[Development]` followed by the translated "(no comment)"

#### Scenario: Day kept together
- **WHEN** a day's rows would start near the bottom of a page and not fit
- **THEN** the whole day, including its total row, SHALL move to the next page

### Requirement: REQ-390 PDF language, typography, and file
All PDF text SHALL come from the `en`/`pl` catalogs (kept in parity) in the preset's locale, independent of the UI locale. Month names, weekday names, and dates SHALL be formatted for that locale. The PDF SHALL embed the IBM Plex Sans font so that Polish characters render correctly, and SHALL use tabular figures for durations. The file SHALL be A4 portrait and SHALL download as `<localized prefix>-<client slug>-<YYYY-MM>.pdf`, where the client slug is the client name lowercased with runs of non-alphanumeric characters replaced by `-`.

#### Scenario: Polish PDF from an English UI
- **WHEN** the UI locale is `en` and the preset locale is `pl`
- **THEN** every PDF string, month name, and weekday SHALL be Polish

#### Scenario: Polish characters render
- **WHEN** a log comment is `Poprawki błędów`
- **THEN** the PDF SHALL render `ł` in the embedded font, not a fallback glyph or a missing character

#### Scenario: File name
- **WHEN** a `pl` preset for client `Helios Energy` is exported for September 2026
- **THEN** the downloaded file SHALL be named with the Polish prefix followed by `-helios-energy-2026-09.pdf`
