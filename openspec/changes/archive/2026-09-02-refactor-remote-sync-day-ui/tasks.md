## 1. Frontend Implementation

- [x] 1.1 Refactor `SyncDayHeader.vue` to render the stable title, compact localized date popover
  trigger, previous/next actions, and Export action; verify keyboard labels, responsive wrapping, and
  emitted navigation/export events in the focused Nuxt component test.
- [x] 1.2 Update `app/pages/sync/[date].vue` to supply the short date and Export state to the header,
  remove the day-level include/exclude helpers and controls, and verify task-level and per-entry
  selection still update the existing summaries.
- [x] 1.3 Remove only the obsolete Today, Pick date, include-all, and exclude-all messages from both
  locale catalogs; verify `en`/`pl` key parity and `pnpm lint` pass.

## 2. Frontend Tests and Validation

- [x] 2.1 Update focused Nuxt tests to cover the stable title, short localized date trigger,
  previous/next navigation, calendar date selection, Export emission/state, and absence of retired
  controls; verify the targeted `pnpm test:nuxt` run passes.
- [x] 2.2 Update the Remote Sync UI E2E journey to exercise the compact switcher and Export action,
  and assert day-level bulk actions are absent while per-task selection remains operable; verify the
  targeted E2E spec passes with its required runtime available.
- [x] 2.3 Run `pnpm format:check`, `pnpm lint`, `pnpm type-check`, and the relevant Nuxt test project;
  verify all commands pass and changed test hooks are limited to intentionally retired controls.

## 3. Backend Verification

- [x] 3.1 Confirm the implementation changes no server routes, shared boundary types, database schema,
  or remote adapter behavior by reviewing the final diff; verify no backend test expansion is needed.
