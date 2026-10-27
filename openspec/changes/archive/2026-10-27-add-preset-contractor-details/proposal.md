# Proposal

## Why

Clients often need the contractor's business identifiers (for example, a tax ID) next to the contractor on the monthly timesheet. The client report PDF shows only the contractor's name and email, so the user cannot hand over a timesheet that carries those details.

## What Changes

- A report preset gains optional, free-text **contractor details** (up to 500 characters, line breaks allowed). Blank input is stored as "no details".
- The preset list returns the details. Create and update store them, and update replaces them like every other preset field.
- The inline preset form on the client report page gains a multiline "Contractor details" field below the client name, with a keyboard-accessible help tooltip that explains where the text appears in the PDF.
- The PDF title page prints the details below the contractor's email, left-aligned with it, with line breaks preserved. Nothing is printed when a preset has no details.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `workspace-report-presets`: presets hold optional contractor details, which are validated, stored and listed.
- `tracking-client-report`: the preset form edits contractor details, the export may use them, and the title page prints them below the contractor's email.

## Non-goals

- No profile-level (per-user) contractor details and no fallback from the profile to a preset. The details live only on the preset.
- No structured fields (tax ID, address, contract number). The text is printed as typed.
- No details in the running header, the table page footers or the closing note. Only the title page shows them.
- No rich text, links or formatting in the details.

## Impact

- **Database:** a nullable text column on `report_presets` and one migration. Existing presets read as "no details".
- **API:** `POST /api/report-presets` and `PATCH /api/report-presets/[id]` accept an optional `contractorDetails`, and `GET /api/report-presets` returns it. Older clients that omit the field keep working; a PATCH without it clears the details, consistent with "PATCH replaces every field".
- **Web app:** shared preset schema and DTO, the client report page form, the report model and the PDF title page.
- **i18n:** field label, tooltip text, tooltip button label and a "too long" error in the `en` and `pl` catalogs.
