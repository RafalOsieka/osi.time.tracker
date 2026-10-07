# tracking-client-report Specification

## Purpose

Gives the user a per-client monthly timesheet PDF built only from the time logs recorded on the client's trackers, ready to hand to the client.

## Requirements

### Requirement: REQ-384 Client report page and month selection
The private `/reports/client` page SHALL use the shared page header with month controls. The month SHALL default to the current one in the user's timezone, live in the `month=YYYY-MM` query and change with previous/next. An invalid `month` SHALL show a translated error and disable export rather than guess. The preview area SHALL show a translated placeholder. The global guard SHALL redirect unauthenticated visitors.

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
The page SHALL load the user's presets (REQ-381), preselecting the most recently used, with a selector whose last option, "new preset", switches to an unsaved one. The inline form SHALL hold the client name, a checkbox list of active trackers, hours format (`H:MM` or decimal) and PDF language (`en` or `pl`); a new preset starts empty with `decimal` and the UI locale. A preset with inactive trackers SHALL warn how many were removed. The selected preset SHALL be deletable after confirmation.

#### Scenario: Last used preset is preselected
- **WHEN** the user has presets A and B and B was used last
- **THEN** the page SHALL open with B selected and its values in the form

#### Scenario: First visit
- **WHEN** the user has no presets and the UI locale is `en`
- **THEN** the selector SHALL show "new preset", the form SHALL be empty with hours format `decimal` and PDF language `en`, and the export action SHALL read "save and export"

#### Scenario: New preset from the selector
- **WHEN** the user picks "new preset" in the selector
- **THEN** the form SHALL reset to the first-visit defaults without any request

#### Scenario: Removed tracker warning
- **WHEN** the selected preset reports one inactive tracker
- **THEN** the page SHALL show a translated warning and the form SHALL list only active trackers

### Requirement: REQ-473 Export label and form validation
Because export saves the preset first (REQ-386), the export action SHALL read "save and export" while the form holds a new preset or differs from the selected saved one, and "export" otherwise. The form SHALL validate as REQ-380 does and show translated field errors before any request is sent.

#### Scenario: Export label follows unsaved changes
- **WHEN** a saved preset is selected unchanged, and the user then edits its client name
- **THEN** the export action SHALL read "export" before the edit and "save and export" after it

#### Scenario: Invalid form blocks export
- **WHEN** the client name is empty or no tracker is checked
- **THEN** the export action SHALL show translated field errors and SHALL NOT call any API or tracker

### Requirement: REQ-386 Export assembles the report only from remote time logs
Export SHALL save the form (REQ-382), then fetch each preset tracker's own-account logs for the month with the browser secret, directly or via the extension. The report SHALL use only those logs, tracker name, type and URL, and the user's name and email — never OSI entries, tasks or provenance. A running export SHALL NOT restart.

#### Scenario: Two trackers are combined
- **WHEN** the preset has an OpenProject and a Redmine tracker with logs in the month
- **THEN** the PDF SHALL contain the logs of both trackers in one table

#### Scenario: Logs logged directly in the tracker are included
- **WHEN** a remote log was created in the tracker's own UI and never exported from OSI
- **THEN** it SHALL appear in the PDF like any other log

### Requirement: REQ-475 Export fails without a file
If saving fails, a tracker has no secret, the extension is unavailable or incompatible, or any fetch fails, the export SHALL stop with a translated error naming the affected tracker and SHALL NOT produce a file. If every fetch succeeds but returns no logs, the page SHALL show a translated "nothing logged" message and SHALL NOT produce a file.

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
The report SHALL list only days with logs, ascending by `spentOn`, one row per log, ordered within a day by tracker (preset order), remote issue id, then remote log id (numeric when both are numeric, else lexical). Durations SHALL follow the preset: `hm` as unpadded `H:MM`, seconds floored; `decimal` as hours rounded half-up to two places with the locale's separator (`3,50` pl, `3.50` en). Every day, tracker and month total SHALL equal the sum of the printed row values.

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
The first page SHALL be a title page without table, running header or page number, showing: the app name and mark; "Timesheet for" and the client name; the month and year and its date range; the contractor's display name (or email if empty) and email; the month total, days with logs and log count; each tracker's name and host as data sources, with its total when there are two or more. Its footer SHALL show the generation date and time with the user's timezone name.

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
After the title page comes a Date, Task and Hours table. The Date cell SHALL span the day's rows with weekday and date. The Task cell SHALL show three lines: the tracker name and the remote issue id linked to its URL (from base URL and system type); the issue title, or a translated "issue not available" when `null`; the activity in brackets (omitted when `null`) and the comment, or a translated "(no comment)". Each day SHALL end with a total row, and the table with a month-total row.

#### Scenario: Issue id is a link
- **WHEN** a row belongs to OpenProject work package `4821` on `https://op.example`
- **THEN** the issue id text SHALL link to `https://op.example/work_packages/4821`

#### Scenario: Hidden issue
- **WHEN** a log's remote issue title is `null`
- **THEN** the title line SHALL show the translated "issue not available" text and the id SHALL still link to the issue

#### Scenario: Missing comment
- **WHEN** a log's comment is empty and its activity is `Development`
- **THEN** the third line SHALL show `[Development]` followed by the translated "(no comment)"

### Requirement: REQ-474 Table page layout
The table's header row SHALL repeat on every page. Every table page SHALL carry a running header (report title, month, client name) and a footer (contractor, generation date and time, "page X of Y"). A day's rows and its total row SHALL NOT be split across pages unless the day alone exceeds a page.

#### Scenario: Day kept together
- **WHEN** a day's rows would start near the bottom of a page and not fit
- **THEN** the whole day, including its total row, SHALL move to the next page

### Requirement: REQ-390 PDF language, typography, and file
All PDF text SHALL come from the `en`/`pl` catalogs (in parity) in the preset's locale, whatever the UI locale, with month, weekday and date formats of that locale. The PDF SHALL embed IBM Plex Sans so Polish characters render, use tabular figures for durations, be A4 portrait, and download as `<localized prefix>-<client slug>-<YYYY-MM>.pdf`, the slug being the client name lowercased with runs of non-alphanumerics replaced by `-`.

#### Scenario: Polish PDF from an English UI
- **WHEN** the UI locale is `en` and the preset locale is `pl`
- **THEN** every PDF string, month name, and weekday SHALL be Polish

#### Scenario: Polish characters render
- **WHEN** a log comment is `Poprawki błędów`
- **THEN** the PDF SHALL render `ł` in the embedded font, not a fallback glyph or a missing character

#### Scenario: File name
- **WHEN** a `pl` preset for client `Helios Energy` is exported for September 2026
- **THEN** the downloaded file SHALL be named with the Polish prefix followed by `-helios-energy-2026-09.pdf`
