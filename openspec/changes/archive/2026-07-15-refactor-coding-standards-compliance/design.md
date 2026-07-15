## Context

`CODING_STANDARDS.md` establishes the PrimeVue-first convention for forms (`Form` + `FormFieldWrap`, as already used in `settings.vue` and `RemoteIssuePicker.vue`) and requires justification comments on every `eslint-disable` for `no-explicit-any`. `TimerAddEntryDialog.vue` and `TimerBulkAssignDialog.vue` were written before this pattern was established and still use native `<form>`/`<label>` elements; `test/e2e/support/seed.ts` has an unjustified `any` exception. This is a small, localized consistency fix rather than an architectural change.

## Goals / Non-Goals

**Goals:**
- Bring the two dialogs' markup in line with the existing `Form`/`FormFieldWrap` pattern without changing their visible behavior, validation, or `data-testid` hooks.
- Add the missing justification to the flagged `eslint-disable` comment.
- Keep all existing `test/nuxt` coverage for these dialogs green with no test behavior changes required.

**Non-Goals:**
- No new UI/UX, no new validation rules, no API or schema changes.
- Not attempting an exhaustive repo-wide rewrite; only the identified non-conforming files are in scope.

## Decisions

- **Reuse `Form`/`FormFieldWrap` rather than inventing a new pattern.** `settings.vue` and `RemoteIssuePicker.vue` already demonstrate the target shape (PrimeVue `Form` wrapping `FormFieldWrap` around inputs), so the dialogs adopt the same structure instead of a bespoke one, minimizing risk and review surface.
  - *Alternative considered*: Keep native `<form>` but wrap only the `<label>` elements with PrimeVue equivalents. Rejected because it leaves the standards violation (native `<form>`) partially unresolved and creates a third, inconsistent pattern.
- **Preserve existing `for`/`id` association semantics via `FormFieldWrap`'s label slot** instead of hand-rolling `aria-label`, keeping accessibility parity with the other converted pages.
- **Add the justification inline on the existing disable comment** in `seed.ts` rather than removing the `any` altogether, since the underlying dynamic-hasher-import reason (mirrors the pattern already used in `useRemoteIssueSearch.ts`) is a legitimate, narrow exception.

## Risks / Trade-offs

- [Risk] Swapping native `<form>`/`<label>` for `Form`/`FormFieldWrap` could change submit-event wiring (`@submit.prevent` vs PrimeVue's `@submit`) and break existing `test/nuxt` dialog specs → Mitigation: mirror `settings.vue`'s exact submit-handler wiring and rerun the affected `test/nuxt` specs after the change.
- [Risk] `FormFieldWrap` may render markup that shifts existing `data-testid` selectors → Mitigation: keep all `data-testid` attributes on the same elements they were previously on; verify via the existing dialog specs.

## Open Questions

None — the two target files and the missing-comment fix are directly identified from `CODING_STANDARDS.md` §4 and §1.
