## 1. Standards

- [x] 1.1 Update `CODING_STANDARDS.md` §4 with the type-assertion ladder, forbid `as unknown as` in `app/`, UForm `reactive` + schema-input/`*FormState` vs primitive refs, task-title menu adapter rule, and parallel named task-keyed maps (REQ-243)

## 2. Task-title menu helper (frontend)

- [x] 2.1 Add a pure builder (prefer `app/utils/taskTitleMenu.ts` unless lifecycle forces a composable) that maps `TaskDto[]` + search text → menu items `{ id, name, label, onSelect }` with optional synthetic create row, matching `AppTimer` semantics (REQ-241)
- [x] 2.2 Refactor `AppTimer.vue` to use the shared builder without behavior change
- [x] 2.3 Refactor `TimerAddEntryDialog.vue` and `TimerBulkAssignDialog.vue` to the shared builder + string model; remove all `as unknown as` (REQ-238, REQ-241)

## 3. Task-title menu tests

- [x] 3.1 Add unit tests for the pure builder (suggestion rows, create row, onSelect captures id/name, freeform clears identity) (REQ-241)
- [x] 3.2 Extend or adjust nuxt/component tests for add/bulk dialogs (or AppTimer) so selection and freeform paths stay covered without cast-based test hacks

## 4. Form and literal state cleanup (frontend)

- [x] 4.1 Type UForm state from schema input or `*FormState` and drop value casts in `TimerBulkAssignDialog`, `projects.vue`, `login.vue` (and any sibling create/edit forms touched) (REQ-239, REQ-240)
- [x] 4.2 Type union/literal UI state without casts in `settings.vue` (week start) and `RemoteIssuePicker.vue` (search mode); use container annotation or `satisfies` (REQ-239)
- [x] 4.3 Ensure submit handlers use validated form data without `as string` (etc.) on individual fields (REQ-239)

## 5. Form cleanup verification

- [x] 5.1 Run/adjust unit or nuxt tests for affected forms; add coverage only where submit/optional-field typing could regress
- [x] 5.2 Smoke existing e2e paths that exercise login/projects/settings or document that type-only changes need no new e2e when behavior is unchanged; add e2e only if a form flow’s runtime behavior changes

## 6. Sync maps and export refs (frontend)

- [x] 6.1 Introduce documentation aliases (`TaskId`, per-map value types) for sync page / `useSyncExport` / related composables; keep parallel maps (no mega row object) (REQ-242)
- [x] 6.2 Ensure scope/date reset clears every task-keyed map via one reset path; fix any missed map (REQ-242)
- [x] 6.3 Add expand-map helper for `true | Record<…>` so call sites do not cast; seed outcome/progress refs without double `Ref` assertions (REQ-238, REQ-239)

## 7. Sync map tests

- [x] 7.1 Unit-test expand-map helper and any new pure alias/reset helpers
- [x] 7.2 Adjust existing sync/export unit tests for renamed types only; keep behavior assertions intact

## 8. Library friction adapters (frontend)

- [x] 8.1 Replace `Record<string, unknown>` / inline casts for Nuxt UI props (e.g. sidebar toggle, confirm modal component typing) with small adapters returning the real prop type (REQ-238, REQ-239)
- [x] 8.2 Replace DOM `currentTarget as …` with `instanceof` narrowing (or one DOM helper) at known call sites
- [x] 8.3 Optionally tighten `extractMessageKey` unknown peeling with `in` checks / envelope type instead of `Record` cast if touched

## 9. Final verification

- [x] 9.1 Grep `app/` for `as unknown as` and remaining high-severity value casts; resolve or confine to documented adapters
- [x] 9.2 Run `pnpm lint`, `pnpm type-check`, `pnpm test:unit`, and `pnpm test:nuxt`; run `pnpm test:e2e` if form/dialog runtime behavior changed
