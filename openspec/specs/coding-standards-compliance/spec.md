# coding-standards-compliance Specification

## Purpose
Define concrete, checkable conformance rules derived from `CODING_STANDARDS.md` that prevent style drift in the codebase: Vue components use the established PrimeVue `Form`/`FormFieldWrap` pattern instead of native `<form>`/`<label>` markup, and every `no-explicit-any` lint-disable annotation carries a justification comment.

## Requirements

### Requirement: REQ-NFR-020 Vue forms use the PrimeVue Form pattern
Vue components that render a submittable form SHALL use the PrimeVue `Form` component together with `FormFieldWrap` for labeled fields, matching the pattern already established by `app/pages/settings.vue` and `app/components/RemoteIssuePicker.vue`. Native `<form>` and `<label>` elements SHALL NOT be used for this purpose.

#### Scenario: Dialog form uses PrimeVue Form
- **WHEN** `TimerAddEntryDialog.vue` or `TimerBulkAssignDialog.vue` renders its submittable form
- **THEN** it wraps its fields in a PrimeVue `Form` component and labels them via `FormFieldWrap`, with no native `<form>` or `<label>` element present

#### Scenario: Existing behavior and hooks are preserved
- **WHEN** the form is converted to the PrimeVue pattern
- **THEN** the submit handler still fires on submission, all previously present `data-testid` attributes remain on the same logical elements, and no new validation behavior is introduced

### Requirement: REQ-NFR-021 Lint-disable exceptions carry a justification
Every `// eslint-disable-next-line @typescript-eslint/no-explicit-any` annotation SHALL be followed on the same line by a trailing comment (` -- <reason>`) explaining why the exception is unavoidable.

#### Scenario: Justification comment is present
- **WHEN** `test/e2e/support/seed.ts` declares `sharedHasher` with an `eslint-disable-next-line @typescript-eslint/no-explicit-any` annotation
- **THEN** the annotation includes a trailing `-- <reason>` comment explaining the exception
