## 1. Document already-shipped fixes (frontend, no code changes expected)

- [x] 1.1 Verify the uncommitted `app/pages/index.vue` state matches the spec: day/group list (incl. empty state) inside `<ClientOnly>` with `useAsyncData(..., { server: false })`, and `fetchRunning()` called after task update and bulk assign
- [x] 1.2 Add/extend nuxt tests asserting the timer view renders the grouped list client-side without hydration errors and that a task edit triggers a running-state re-fetch

## 2. Smart time parser and shared TimeInput (frontend)

- [x] 2.1 Implement pure `normalizeTimeInput(raw: string): string | null` in `app/utils/` per the REQ-NFR-034 rule table (`9`→`09:00`, `23`→`23:00`, `93`→`09:30`, `59`→invalid, `900`→`09:00`, `1234`→`12:34`, `123:`→`01:23`, `9:5`→`09:05`, range validation, whitespace tolerance)
- [x] 2.2 Unit tests for `normalizeTimeInput` covering every rule-table row plus edge cases (empty string, `24:00`, `0`, `0000`, `:30`, non-digits)
- [x] 2.3 Create `app/components/TimeInput.vue`: text input, `v-model: string | null` (`HH:mm`), commit on blur/Enter, Escape cancels, invalid input silently reverts without model update; label and `data-testid` via props
- [x] 2.4 Nuxt component tests for `TimeInput` (commit normalization, silent revert, Escape cancel, accessible label)

## 3. Adopt TimeInput in the th ree time-entry locations (frontend)

- [x] 3.1 `TimerEntryRow.vue`: replace native `<input type="time">` for start and stop editing with `TimeInput`; keep combine-with-local-day logic and blur/Enter/Escape contract
- [x] 3.2 `TimerAddEntryDialog.vue`: replace `InputText type="time"` start/end fields with `TimeInput`; keep inverted-times inline error
- [x] 3.3 `AppTimer.vue` popover: replace `DatePicker time-only` with `TimeInput` (model mapped to/from the seeded start `Date`); keep future-start inline error
- [x] 3.4 Update existing nuxt tests for row inline editing, the manual-entry dialog, and the popover to the new inputs, adding compact-typed-time cases (`900` commit, `59` revert)
- [x] 3.5 E2E test: edit a running timer's start time by typing a compact value in the top-bar popover and verify the elapsed ticker rebases

## 4. Typed date commit in the start popover (frontend)

- [x] 4.1 In `AppTimer.vue`, commit a manually typed valid `yyyy-mm-dd` date (tolerating unpadded parts) on blur/Enter on the DatePicker input; invalid text reverts as before
- [x] 4.2 Nuxt tests: typed `2026-7-9` commits as `2026-07-09`; garbage text reverts and sends no request

## 5. Inline group editing replaces the dialog (frontend)

- [x] 5.1 `TimerTaskGroup.vue`: in-place title editing (button → input, blur/Enter commit via `PATCH /api/tasks/:id`, Escape cancels, empty/whitespace name silently reverts)
- [x] 5.2 `TimerTaskGroup.vue`: in-place project editing — context label (or localized "(no project)" placeholder) as a button swapping to a PrimeVue `Select` with clear option; move `extraProjectOptions` (soft-deleted current project) logic in from the dialog; pass project options from the page
- [x] 5.3 Remove `TimerTaskEditorDialog.vue`, the group edit button/`edit` emit, and the `editingTask` wiring in `app/pages/index.vue`; keep post-save `refreshEntries()` + `fetchRunning()`; ensure the "(no task)" group offers no title/project editing
- [x] 5.4 Add "(no project)" placeholder and any new labels to `i18n/locales/en.json` and `pl.json` in parity; remove dialog-only keys
- [x] 5.5 Nuxt tests for inline group editing: rename commit, empty-name silent revert, Escape cancel, project change/clear, placeholder visibility, soft-deleted project retained, a11y (labelled buttons, keyboard-operable select)
- [x] 5.6 E2E test: rename a task group inline and assign a project via the "(no project)" placeholder; verify regrouping after a merge-collision rename

## 6. Refresh entries when the timer stops (frontend)

- [x] 6.1 In `app/pages/index.vue`, watch `running` from `useTimer` and call `refreshEntries()` on the running→stopped transition (and running-id change), guarding against double-fetch after page-initiated actions
- [x] 6.2 E2E test: start a timer, stop it from the top-bar widget, and verify the finished entry appears in the timer view without a manual reload

## 7. Post-implementation UX follow-ups (added after initial apply)

- [x] 7.1 Replace native `<input>`/`<button>` controls with PrimeVue `InputText`/`Button` in `TimeInput.vue`, `TimerEntryRow.vue`, `TimerTaskGroup.vue`, and `AppTimer.vue`; restructure the group header so the expand button and inline edit triggers are siblings (no nested interactive controls)
- [x] 7.2 Single-click inline editing: activating a title/project/time editor cancels the previously active editor in the same component, focuses the swapped-in input, and immediately opens the project `Select` option list (`show()`/`hide()` via ref)
- [x] 7.3 Exclusive editing across groups: `activeEditorKey` coordination in `app/pages/index.vue` (`editing-started` emit + `editorKey` prop keyed by day and group) closes editors left open in other groups
- [x] 7.4 Nuxt tests for the follow-up behaviors: single-click select opening, editor exclusivity across groups, and PrimeVue control rendering in the group header

## 8. Final verification

- [x] 8.1 Run `pnpm lint`, `pnpm format:check`, `pnpm test:unit`, `pnpm test:nuxt`, `pnpm test:e2e` and keep the suite green
