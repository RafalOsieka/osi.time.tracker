# Design

## Context

See proposal.md (Why). The preset round-trip runs through one zod schema (`reportPresetInputSchema`) and one DTO (`ReportPresetDto`) in `apps/web/shared/types/report-preset.ts`. `saveReportPreset` and `listReportPresets` in `apps/web/server/utils/report-presets.ts` copy fields explicitly. The client report page (`apps/web/app/pages/reports/client.vue`) keeps the form in `reactive<ReportPresetInput>`. Export saves first and passes the saved DTO to `buildClientReport`, whose `ClientReport` model feeds `titlePage()` in `build-client-report-pdf.ts`.

## Goals / Non-Goals

**Goals:**
- One normalization point: the shared schema turns any blank value into `null`, so server, client validation and PDF all see either `null` or trimmed, non-empty text.
- The PDF reads the details from the report model, never from the form directly.

**Non-Goals:**
- No change to the session, the profile or any other endpoint.

## Decisions

### D1. Nullable column, `null` as the only "none"
`report_presets."contractorDetails" text NULL`, added by the hand-written migration `0026_add_report_preset_contractor_details.sql` with its journal entry. `drizzle-kit generate` cannot run here: the snapshots stop at 0014, so it asks interactive questions, and migrations since then have been written by hand. Existing rows become `NULL` without a backfill. The schema uses `z.string().trim().max(500, …).nullish()` followed by a transform `(value) => value || null`. The output type is `string | null`, and `''` never reaches the database.
- *Alternative:* `text NOT NULL DEFAULT ''`. This avoids `null` in TypeScript, but two spellings of "none" would exist at the API boundary (`''` from forms, a missing field from old clients). The decision was nullable, as agreed.

### D2. Omitted field clears the details
PATCH already replaces every field, so `nullish()` maps a missing field to `null`. Old clients keep working, and the semantics stay uniform.
- *Alternative:* keep the stored value when the field is omitted. That would make it the only partial-update field, so it was rejected.

### D3. One constant for the limit
`REPORT_PRESET_CONTRACTOR_DETAILS_MAX_LENGTH = 500` lives next to the client-name constant. It feeds the zod `max`, the textarea's `maxlength` and nothing else. The error key is `error.reportPresetContractorDetailsTooLong`. 500 characters is about 6–8 lines in the contractor column, which fits the title page without overflow.

### D4. Form state holds a string
`UTextarea` binds a string, so the page form state widens `contractorDetails` to `string` (empty for "none") instead of `string | null`. `applyPreset` maps `null` to `''`. `hasUnsavedChanges` compares `state.contractorDetails.trim()` with `preset.contractorDetails ?? ''`. Parsing through the shared schema on save restores `null`. This avoids a `null` v-model and a `// SAFETY:` cast.

### D5. Tooltip follows the existing help pattern
The field uses `UTooltip` around a ghost `UButton` with `i-lucide-circle-help`, a translated `aria-label` and a `data-testid`, as in `TrackerFormDialog.vue`. The help button goes in the `UFormField` `hint` slot, with `labelWrapper` set to `justify-start`, so it sits next to the label text. The `label` slot is not used because it renders inside the field's `<label>`, and a button inside a label is invalid HTML. The button is keyboard-focusable, which meets WCAG 2.1 AA (REQ-512).

### D6. PDF rendering
`ClientReport.contractor` gains `details: string | null`, filled from `input.preset.contractorDetails`. `BuildClientReportInput.preset` picks that field too. `titlePage()` appends `{ text: details, fontSize: 10.5, color: SLATE_700, margin: [0, 4.5, 0, 0] }` to the contractor `stack` only when `details` is non-null. Left alignment is the default, and pdfmake breaks lines on `\n` and wraps within the column. Footers and the closing note keep using `contractorName()` only (REQ-513).
- *Alternative:* split lines and render one text node per line. pdfmake already handles `\n`, so the extra code buys nothing.

## Risks / Trade-offs

- [A user puts sensitive data into a preset] → The details are the user's own business data, stored like the client name and scoped per user. No new exposure path is added.
- [Leading spaces on the first line are lost by the trim] → This is accepted. Indentation on later lines is kept (REQ-511).
- [A very long unbroken token (e.g. an IBAN without spaces) overflows the column] → pdfmake breaks long words at the column edge. A PDF unit test covers a long line.

## Migration Plan

One additive migration (a nullable column). Rollback means dropping the column. Older app builds ignore it.
