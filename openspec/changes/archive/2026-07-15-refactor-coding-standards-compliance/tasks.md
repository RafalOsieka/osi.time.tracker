## 1. Frontend: TimerAddEntryDialog

- [x] 1.1 Replace the native `<form>`/`<label>` markup in `app/components/TimerAddEntryDialog.vue` with PrimeVue `Form` + `FormFieldWrap`, mirroring the structure in `app/pages/settings.vue`.
- [x] 1.2 Preserve the existing `data-testid` attributes, submit handler wiring, and validation behavior.
- [x] 1.3 Update/verify `test/nuxt` specs covering `TimerAddEntryDialog.vue` still pass against the new markup (adjust selectors only if strictly necessary).

## 2. Frontend: TimerBulkAssignDialog

- [x] 2.1 Replace the native `<form>`/`<label>` markup in `app/components/TimerBulkAssignDialog.vue` with PrimeVue `Form` + `FormFieldWrap`, mirroring the structure in `app/pages/settings.vue`.
- [x] 2.2 Preserve the existing `data-testid` attributes, submit handler wiring, and validation behavior.
- [x] 2.3 Update/verify `test/nuxt` specs covering `TimerBulkAssignDialog.vue` still pass against the new markup (adjust selectors only if strictly necessary).

## 3. Lint-exception cleanup

- [x] 3.1 Add a trailing justification comment to the `// eslint-disable-next-line @typescript-eslint/no-explicit-any` annotation in `test/e2e/support/seed.ts`.

## 4. Verification

- [x] 4.1 Run `pnpm lint` and `pnpm format:check` and fix any reported issues. (lint and format pass; a pre-existing `README.md` formatting warning is unrelated to this change and left untouched.)
- [x] 4.2 Run `pnpm test:nuxt` (and any affected `test/e2e` specs) to confirm the dialogs and seed helper still behave correctly.
- [x] 4.3 Run `pnpm type-check` to confirm no type regressions were introduced.
