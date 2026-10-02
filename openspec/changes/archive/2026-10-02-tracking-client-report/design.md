# Design

## Context

- Tracker secrets live only in the browser (`use-tracker-secret`), so remote logs can only be fetched there. `createRemoteAdapter(config, secret)` (`app/utils/remote/create-remote-adapter.ts`) already picks the client or extension path, and `/reports/monthly` uses it for one `fetchTimeLogsInRange` per tracker.
- After `remote-issue-titles-contract`, every `RemoteTimeLogDto` carries `remoteIssueTitle: string | null` for both providers; `deriveIssueUrl` builds issue links.
- Month helpers exist in `shared/utils/report-month.ts` (`currentCalendarMonth`, `addCalendarMonths`, `monthDateRange`). The effective timezone comes from user settings, falling back to `UTC`.
- i18n uses `@nuxtjs/i18n` with `en.json` / `pl.json`; the session user carries `displayName` and `email`.
- Visual reference: `mockups/title-page.html`, `mockups/table-page.html`, `mockups/last-page.html` (static A4 pages, 794×1123 CSS px). They show the target hierarchy, spacing, and colours; pdfmake reproduces them in points.

## Goals / Non-Goals

**Goals:**
- A deterministic, unit-testable path from fetched logs to a PDF document definition.
- No server involvement beyond preset CRUD.

**Non-Goals:**
- Pixel-identical reproduction of the HTML mockups; PDF layout is in points and pdfmake's table model.
- Refactoring `/reports/monthly` to share its fetch loop.

## Decisions

### D1. Render with pdfmake in the browser, loaded on demand
`pdfmake` is imported dynamically when Export is activated, so the ~1 MB library and fonts never enter the page bundle or SSR.
- *Alternative — print stylesheet + `window.print()`:* no dependency and reuses Tailwind, but goes through the print dialog, cannot name the file, and page numbers/headers depend on browser support.
- *Alternative — server-side headless Chromium or Typst:* better typography, but the server never sees the logs (secrets are browser-only) and it adds a heavy runtime to a self-hosted image.

### D2. Two pure stages: report model, then document definition
- `buildClientReport({ preset, trackers, logsByTracker, month, user, generatedAt, timeZone })` → `ClientReport` (days → rows, per-tracker/day/month totals as displayed values, counts). It owns ordering and the "totals are sums of displayed values" rule (REQ-387); durations are converted once into display units (whole minutes for `hm`, hundredths of an hour for `decimal`) and summed as integers.
- `buildClientReportPdf(report, t, formatters)` → pdfmake `TDocumentDefinitions`. It owns layout only.
Both live in `app/utils/client-report/` and are covered by unit tests on plain data. The page only orchestrates (save → fetch → build → download).
- *Alternative — one builder from logs to document:* fewer types, but totals/ordering tests would have to dig through layout nodes.

### D3. Day blocks as unbreakable outer rows
The table is one pdfmake table with `headerRows: 1` (header repeats). Each day is one outer row containing the date cell and a nested table of its log rows plus the day-total row, so the date visually spans the day. The outer row is `unbreakable` so a day moves whole to the next page (REQ-389). A day estimated taller than a page (more than 14 rows) is emitted as plain breakable rows with a `rowSpan` date cell instead, so it can split. Title page is a separate first section followed by `pageBreak: 'before'`; `header`/`footer` callbacks return nothing for page 1.
- *Alternative — flat rows with `rowSpan` and `dontBreakRows`:* keeps single entries together but lets a day split mid-way, and `rowSpan` across a page break duplicates poorly.

### D4. Fonts shipped as TTF with the OFL notice
IBM Plex Sans Regular, Italic, SemiBold, and Bold TTF files go in `app/assets/fonts/ibm-plex-sans/` with `OFL.txt`. They are imported with `?url`, fetched at export time, and registered in pdfmake's virtual file system. pdfmake needs TTF (not WOFF2) and embeds only the glyphs used. Durations use the font's tabular figures.
- *Alternative — pdfmake's bundled Roboto VFS:* zero setup, but generic look and a 900 kB bundled VFS file.

### D5. PDF strings in the preset locale via the existing catalogs
PDF strings live under `clientReport.pdf.*` in both catalogs. At export the page calls `$i18n.loadLocaleMessages(preset.locale)` and passes a translator bound to that locale (`t(key, params, { locale })`) into the builder. Dates use `Intl.DateTimeFormat` with `pl-PL`/`en-US` and the effective timezone; decimals use the locale's separator.
- *Alternative — separate PDF-only message files:* avoids touching the UI catalogs but breaks the en/pl parity lint and splits translations.

### D6. Presets in two tables
`report_presets` (`id`, `userId`, `clientName`, `hoursFormat`, `locale`, `lastUsedAt`, `createdAt`, `updatedAt`, unique `(userId, lower(clientName))`) and `report_preset_trackers` (`presetId` → cascade, `trackerId` → `trackers.id`, `position`, primary key `(presetId, trackerId)`). Trackers are only soft-deleted, so the foreign key never blocks; the list endpoint filters inactive trackers and counts them (REQ-381). PATCH replaces the tracker rows in one transaction.
- *Alternative — `uuid[]` column:* one table, but no foreign key and ordering/filtering in application code.

### D7. Save the preset before fetching
Export first persists the form (so `lastUsedAt` and edits are kept even if a tracker then fails), then fetches all trackers in parallel with `Promise.allSettled`, and builds only when every fetch succeeded.
- *Alternative — save only after a successful PDF:* a failing tracker would discard the user's edits.

## Risks / Trade-offs

- [pdfmake's 14-row heuristic misjudges a day with very long comments] → long comments wrap within the column; the heuristic only decides breakability, so the worst case is a day that starts on a new page with some white space above.
- [Large months with an extension tracker] → fetches are bounded by the existing pagination and title batching; the busy state prevents double exports.
- [The browser blocks the download] → pdfmake triggers a normal anchor download from a user gesture; nothing is opened in a new window.
- [Fonts add ~600 kB on first export] → fetched only on export and cached by the browser afterwards.

## Migration Plan

One Drizzle migration adds both tables; no data backfill. Rollback drops them. Ships after `remote-issue-titles-contract`.
