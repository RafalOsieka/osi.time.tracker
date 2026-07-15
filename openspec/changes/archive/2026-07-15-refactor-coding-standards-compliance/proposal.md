## Why

`CODING_STANDARDS.md` codifies the conventions already used across most of the codebase, but a handful of existing files predate or drifted from it — notably Vue components that fall back to native `<form>`/`<label>` markup instead of the established PrimeVue pattern, and a lint-exception comment missing its required justification. Bringing these files into line now prevents the drift from spreading as new code copies the non-conforming examples.

## What Changes

- Refactor `TimerAddEntryDialog.vue` and `TimerBulkAssignDialog.vue` to use the `Form`/`FormFieldWrap` pattern (as in `settings.vue`, `RemoteIssuePicker.vue`) instead of native `<form>` and `<label>` elements.
- Add the missing justification comment to the `// eslint-disable-next-line @typescript-eslint/no-explicit-any` annotation in `test/e2e/support/seed.ts`.
- Audit remaining `app/` and `server/` files against `CODING_STANDARDS.md` (naming, imports, comments, accessibility affordances) and fix any additional non-conforming spots found during implementation.
- No behavioral change: form submission, validation, and accessibility affordances are preserved.

## Capabilities

### New Capabilities
- `coding-standards-compliance`: Defines that Vue components use the established PrimeVue `Form` pattern instead of native form elements, and that lint-exception comments always carry a justification, per `CODING_STANDARDS.md`.

### Modified Capabilities
(none — no existing spec's requirements change; this is a style/consistency alignment covered by a new capability spec)

## Non-goals

- No new features, API changes, or database schema changes.
- Not re-litigating `CODING_STANDARDS.md` itself or the `type-safety` spec's `any` rules (already covered).
- Not a full line-by-line lint/format pass — `pnpm lint`/`pnpm format` already gate whitespace and syntax style.

## Impact

- Affected files: `app/components/TimerAddEntryDialog.vue`, `app/components/TimerBulkAssignDialog.vue`, `test/e2e/support/seed.ts`, plus any other files found non-conforming during the audit.
- Affected tests: `test/nuxt` specs covering the two dialogs must remain green; `data-testid` selectors must be preserved.
