# Proposal

## Why

A consultant has to hand clients a monthly timesheet of what was actually logged on their trackers, like OpenProject's "Time & costs" PDF export. That export covers one tracker at a time, so a client served through two trackers (OpenProject + Redmine) gets two inconsistent documents. OSI already reaches every tracker from the browser, so it can produce one polished per-client PDF. This pulls WBS 4.6 (🟢 PDF export) forward by explicit product decision.

## What Changes

- New private page `/reports/client` ("Client report") under the sidebar Reports group: month picker, report preset picker/form, and an **Export PDF** action. A report preview is a placeholder for now.
- New **report presets**: a saved, reusable setup of client name, selected trackers, hours format (`H:MM` or decimal), and PDF language. The page preselects the most recently used preset. Presets are stored per user in the database and edited inline on the page.
- The PDF is built in the browser **only from remote data**: the current account's time logs for the month, fetched live from each preset tracker (issue titles resolved per `remote-issue-titles-contract`). OSI time entries, tasks, and export provenance are not used.
- PDF content (A4): an editorial title page (client, month and range, contractor display name and email, total hours, days, entries, data sources with per-tracker hours when there are several trackers) and a Date | Task | Hours table. The task cell shows the tracker, a clickable issue id, the issue title, and `[activity] comment`. Each day has a total row and the month has a closing total. Running headers, footers with generation time and page numbers, and no day is split across pages.
- Any tracker fetch failure aborts the export; a partial PDF is never produced.
- The PDF uses the IBM Plex Sans font (SIL OFL 1.1), shipped with its license.

## Capabilities

### New Capabilities

- `workspace-report-presets`: per-user report presets and their CRUD API.
- `tracking-client-report`: the Client report page, remote data assembly, and PDF content/format rules.

### Modified Capabilities

- `ui-shell`: REQ-065 adds a Client report child to the Reports group.

## Non-goals

- Report preview in the UI, arbitrary date ranges, remote-project filtering within a tracker.
- Rates, amounts, invoices (vision non-goal: billing).
- Server-side rendering of the PDF, emailing, or storing generated files.
- Any change to `/reports/monthly`.

## Impact

- DB: new `report_presets` and `report_preset_trackers` tables and a migration.
- API: `GET/POST /api/report-presets`, `PATCH/DELETE /api/report-presets/[id]`.
- Web: new page, sidebar entry, PDF builder modules, `en`/`pl` catalogs.
- Dependencies: `pdfmake` (lazy-loaded) and IBM Plex Sans TTF files plus `OFL.txt`.
- Depends on `remote-issue-titles-contract` (non-null issue titles for every provider).
