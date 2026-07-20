# coding-standards-compliance Specification

## Purpose
Define concrete, checkable conformance rules derived from `CODING_STANDARDS.md` that prevent style drift in the codebase: Vue components use the established PrimeVue `Form`/`FormFieldWrap` pattern instead of native `<form>`/`<label>` markup, and every `no-explicit-any` lint-disable annotation carries a justification comment.

## Requirements

### Requirement: REQ-035 Vue forms use the PrimeVue Form pattern
Vue components that render a submittable form SHALL use the PrimeVue `Form` component together with `FormFieldWrap` for labeled fields, matching the pattern already established by `app/pages/settings.vue` and `app/components/RemoteIssuePicker.vue`. Native `<form>` and `<label>` elements SHALL NOT be used for this purpose.

#### Scenario: Dialog form uses PrimeVue Form
- **WHEN** `TimerAddEntryDialog.vue` or `TimerBulkAssignDialog.vue` renders its submittable form
- **THEN** it wraps its fields in a PrimeVue `Form` component and labels them via `FormFieldWrap`, with no native `<form>` or `<label>` element present

#### Scenario: Existing behavior and hooks are preserved
- **WHEN** the form is converted to the PrimeVue pattern
- **THEN** the submit handler still fires on submission, all previously present `data-testid` attributes remain on the same logical elements, and no new validation behavior is introduced

### Requirement: REQ-036 Lint-disable exceptions carry a justification
Every `// eslint-disable-next-line @typescript-eslint/no-explicit-any` annotation SHALL be followed on the same line by a trailing comment (` -- <reason>`) explaining why the exception is unavoidable.

#### Scenario: Justification comment is present
- **WHEN** `test/e2e/support/seed.ts` declares `sharedHasher` with an `eslint-disable-next-line @typescript-eslint/no-explicit-any` annotation
- **THEN** the annotation includes a trailing `-- <reason>` comment explaining the exception

### Requirement: REQ-037 Bug fixes are test-first
Every bug fix SHALL be preceded by an automated regression test that reproduces the reported defect. The test SHALL be written and confirmed **failing** against the unfixed code before the fix is applied, and SHALL be confirmed **passing** after the fix. The reproduction test SHALL NOT be weakened, skipped, or deleted to force a green run, and it SHALL remain in the suite as a permanent regression guard. Trivial defects (e.g. typos, obvious single-line logic errors) MAY rely on a documented manual check instead of an automated test.

#### Scenario: Failing repro precedes the fix
- **WHEN** a bug is fixed in application code
- **THEN** a regression test that fails against the pre-fix code and passes against the post-fix code SHALL be added in the same change, and it SHALL NOT be weakened or skipped
