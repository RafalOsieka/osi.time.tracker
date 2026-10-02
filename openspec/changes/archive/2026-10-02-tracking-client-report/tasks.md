# Tasks

Prerequisite: `remote-issue-titles-contract` is applied (non-null-semantics issue titles from both providers).

## 1. Report presets data model (backend)

- [x] 1.1 Add `report_presets` and `report_preset_trackers` to `apps/web/server/db/schema` per design D6, export them from the schema index, and run `pnpm db:generate` to add the migration under `apps/migrator/migrations` (hand-edit for the `lower(clientName)` unique index if drizzle cannot express it); verify with a `test/e2e/db` spec that the migration applies, the case-insensitive unique index rejects a duplicate name, and deleting a preset cascades its tracker rows.
- [x] 1.2 Add `shared/types/report-preset.ts` with the zod input schema (REQ-380 limits, `hoursFormat` and `locale` enums, distinct tracker ids) and `ReportPresetDto` (REQ-381 shape); verify with unit tests in `test/unit/report-preset.spec.ts` covering trimming, length limits, empty/duplicate/too many trackers, and the error `messageKey`s.

## 2. Report presets API (backend)

- [x] 2.1 Implement `GET /api/report-presets` (ordering, active trackers in position order, inactive count, ISO timestamps) and verify with `test/e2e/api/report-presets.spec.ts`: ordering by last use, soft-deleted tracker reported not listed, foreign presets excluded, unauthenticated 401.
- [x] 2.2 Implement `POST /api/report-presets` and `PATCH /api/report-presets/[id]` (ownership/active check on tracker ids, transactional tracker-row replacement, `lastUsedAt = now`, 409 on duplicate name, 404 on foreign id) and extend the API e2e spec with: create happy path, update replaces trackers and order, foreign/deleted tracker 422, duplicate name 409, foreign preset 404, missing CSRF rejected.
- [x] 2.3 Implement `DELETE /api/report-presets/[id]` and extend the API e2e spec: delete removes it from the list, foreign/unknown id 404.
- [x] 2.4 Add the preset error `messageKey`s to `en.json`/`pl.json` and verify `pnpm lint` (i18n parity) passes.

## 3. Report model (frontend, non-UI logic)

- [x] 3.1 Implement `app/utils/client-report/build-client-report.ts` (design D2): day grouping by `spentOn`, ordering per REQ-387, integer display units, day/tracker/month totals from displayed values, days/log counts; verify with `test/unit/build-client-report.spec.ts` covering empty days omitted, tracker-then-issue-then-log ordering with numeric and non-numeric ids, three 20-minute logs → `0,33` rows and `0,99` total, `hm` flooring of 7:50:59, and per-tracker totals.
- [x] 3.2 Implement locale formatters (decimal separator, `H:MM`, month/weekday/date via `Intl` with timezone, file name slug per REQ-390) in `app/utils/client-report/format.ts`; verify with unit tests for `pl`/`en`, slugging `Helios Energy` → `helios-energy`, and month names.

## 4. PDF document builder (frontend, non-UI logic)

- [x] 4.1 Add `pdfmake` as a dependency of `apps/web`, the IBM Plex Sans TTF files (Regular, Italic, SemiBold, Bold) with `OFL.txt` and the IBM copyright line under `app/assets/fonts/ibm-plex-sans/`, and a lazy loader that registers them in pdfmake's VFS; verify `pnpm build` succeeds and pdfmake is not part of the initial client chunk (check the build output).
- [x] 4.2 Implement the title page in `app/utils/client-report/build-client-report-pdf.ts` per REQ-388 and `mockups/title-page.html` (per-tracker totals only for 2+ trackers, display-name fallback, generated-at footer); verify with unit tests asserting the document nodes for one vs two trackers and a missing display name.
- [x] 4.3 Implement the table pages per REQ-389, design D3 and `mockups/table-page.html` / `mockups/last-page.html` (repeating header, unbreakable day blocks, breakable fallback above 14 rows, issue-id `link` from `deriveIssueUrl`, `null` title/activity/comment fallbacks, day and month totals, running header and "page X of Y" footer skipped on page 1); verify with unit tests asserting link targets, fallback texts, unbreakable vs breakable day nodes, and header/footer callbacks for pages 1 and 2.
- [x] 4.4 Add the `clientReport.pdf.*` strings to both catalogs and verify `pnpm lint` parity plus a unit test rendering the builder with a `pl` translator from an `en` UI context.

## 5. Client report page (frontend)

- [x] 5.1 Add `pages/reports/client.vue` with the page header, month controls (`month` query, default from `currentCalendarMonth` in the effective timezone, invalid month error) and the preview placeholder, plus the Client report child in `AppSidebar.vue`; verify with `test/nuxt/client-report-page.spec.ts` (default month written to the URL, next/previous, invalid month disables export) and update the sidebar nuxt test for the new child.
- [x] 5.2 Add the preset selector, "new preset", inline form (`UForm`/`UFormField`, tracker checkboxes from active trackers, hours format, PDF language), inactive-tracker warning and delete-with-confirmation; verify with nuxt tests: last-used preset preselected, first-visit defaults, warning shown, validation errors block export without requests.
- [x] 5.3 Implement the export orchestration (save → parallel `fetchTimeLogsInRange` via `createRemoteAdapter` → build → `download`), busy state, missing-secret/extension/fetch error naming the tracker, and the "nothing logged" message; verify with nuxt tests mocking the adapter: one failing tracker produces no download and names it, missing secret makes no tracker request, empty month shows the message, double activation runs once.
- [x] 5.4 Add the page's UI strings to both catalogs and verify `pnpm lint` passes.
- [x] 5.5 Add `test/e2e/ui/client-report.spec.ts`: seed two trackers, mock OpenProject and Redmine responses with `page.route`, create a preset, export, and assert a download named `*-<client-slug>-<YYYY-MM>.pdf` that is a non-empty PDF; then reload and assert the preset is preselected; verify `pnpm test:e2e:ui` passes.

## 6. Docs and integration

- [x] 6.1 Update `docs/wbs.md` (4.6 points to the client report and is delivered; 5.15 Redmine is no longer deferred) and `docs/user-stories.md` (client report story with acceptance criteria); verify `pnpm format:check` passes.
- [x] 6.2 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:nuxt`, `pnpm test:e2e`, and manually export a report against the local `trackers` profile, comparing it with the three mockups (title page, table page, last page).

## 7. Preset UX follow-up

- [x] 7.1 Move "new preset" into the preset selector as its last entry (shown selected on first visit) and label the export action "save and export" while the form is new or differs from the selected preset; update the catalogs and verify with nuxt tests (new-preset entry resets the form without requests, label switches on edit) and the UI e2e.
