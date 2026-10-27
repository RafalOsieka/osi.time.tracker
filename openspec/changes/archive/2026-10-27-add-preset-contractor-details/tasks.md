# Tasks

## 1. Backend: schema, contract and persistence (REQ-511)

- [x] 1.1 Add `REPORT_PRESET_CONTRACTOR_DETAILS_MAX_LENGTH = 500` and `contractorDetails` to `reportPresetInputSchema` (trim, max with `error.reportPresetContractorDetailsTooLong`, `nullish()`, blank → `null`) and `contractorDetails: string | null` to `ReportPresetDto` in `apps/web/shared/types/report-preset.ts`. Verify by extending `apps/web/test/unit/report-preset.spec.ts` (multiline kept, surrounding whitespace trimmed, blank and omitted → `null`, 500 accepted, 501 rejected with the key) and running `pnpm test:unit`
- [x] 1.2 Add the nullable `contractorDetails` text column to `report_presets` in `apps/web/server/db/schema/report-presets.ts` (update its doc comment) and add the migration in `apps/migrator/migrations` (hand-written with a journal entry, see design D1). Verify by extending `apps/web/test/e2e/db/report-presets-schema.spec.ts` (column is nullable, existing rows read `NULL`) and running `pnpm test:e2e:db`
- [x] 1.3 Write `contractorDetails` in `saveReportPreset` and map it in `listReportPresets` (`apps/web/server/utils/report-presets.ts`). Verify by extending `apps/web/test/e2e/api/report-presets.spec.ts`: create with two-line details and list them back, PATCH without the field clears them, blank details list as `null`, 501 characters → 422 with the `messageKey` and nothing stored. Run `pnpm test:e2e:api`

## 2. Frontend: report model and PDF (REQ-513, REQ-386)

- [x] 2.1 Add `details: string | null` to `ClientReport.contractor`, pick `contractorDetails` in `BuildClientReportInput.preset` and fill it in `buildClientReport` (`apps/web/app/utils/client-report/build-client-report.ts`). Pass it from `use-client-report-export.ts`. Verify with a case in `apps/web/test/unit/build-client-report.spec.ts` (details copied, `null` kept) and `pnpm test:unit`
- [x] 2.2 Render the details below the email in the contractor `stack` of `titlePage()` in `build-client-report-pdf.ts`, only when non-null (`fontSize: 10.5`, `SLATE_700`, top margin 4.5, default left alignment). Verify in `apps/web/test/unit/build-client-report-pdf.spec.ts`: the title page carries the multiline text after the email, nothing is added for `null`, and the footers and closing note do not contain it. Run `pnpm test:unit`

## 3. Frontend: preset form field with tooltip (REQ-512)

- [x] 3.1 Add the `en`/`pl` catalog keys: field label ("Contractor details" / "Dane wykonawcy"), tooltip text, help button `aria-label`, and `error.reportPresetContractorDetailsTooLong`. Verify that `pnpm lint` passes (i18n parity rules)
- [x] 3.2 In `apps/web/app/pages/reports/client.vue`, add a `UTextarea` (`maxlength` from the constant, `data-testid="client-report-contractor-details"`) directly below the client name. Add a hint slot (design D5) with the `UTooltip` + `i-lucide-circle-help` help button (`data-testid="client-report-contractor-details-help"`). Wire `contractorDetails` as a string in the form state, `applyPreset` (`null` → `''`), `startNewPreset` and `hasUnsavedChanges`. Verify by extending `apps/web/test/nuxt/client-report-page.spec.ts` (selected preset fills the field, "new preset" empties it, an edit flips the label to "save and export", the help button has an accessible name) and running `pnpm test:nuxt`
- [x] 3.3 E2E journey in `apps/web/test/e2e/ui/client-report.spec.ts`: type two-line details, export with mocked trackers, and assert that the saved preset returns the details after a hydrated reload and that pasting 600 characters leaves 500. Run `pnpm test:e2e:ui`

## 4. Integration checks

- [x] 4.1 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check` and `pnpm test:e2e`, and confirm all pass
- [ ] 4.2 Export a preset with `NIP: …` details in `pnpm dev` and confirm visually that the title page shows them left-aligned below the email and that the table pages do not
- [x] 4.3 Run `openspec validate add-preset-contractor-details --strict` and confirm it passes

## Workflow follow-up

- Archive the change after review and merge, folding REQ-511, REQ-512, REQ-513 and the REQ-386 wording into the main specs.
