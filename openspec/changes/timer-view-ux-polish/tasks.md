## 1. Document already-shipped fixes (frontend, no code changes expected)

- [ ] 1.1 Verify the uncommitted `app/pages/index.vue` state matches the spec: day/group list (incl. empty state) inside `<ClientOnly>` with `useAsyncData(..., { server: false })`, and `fetchRunning()` called after task update and bulk assign
- [ ] 1.2 Add/extend nuxt tests asserting the timer view renders the grouped list client-side without hydration errors and that a task edit triggers a running-state re-fetch

## 2. Smart time parser and shared TimeInput (frontend)

- [ ] 2.1 Implement pure `normalizeTimeInput(raw: string): string | null` in `app/utils/` per the REQ-NFR-034 rule table (`9`→`09:00`, `23`→`23:00`, `93`→`09:30`, `59`→invalid, `900`→`09:00`, `1234`→`12:34`, `123:`→`01:23`, `9:5`→`09:05`, range validation, whitespace tolerance)
- [ ] 2.2 Unit tests for `normalizeTimeInput` covering every rule-table row plus edge cases (empty string, `24:00`, `0`, `0000`, `:30`, non-digits)
- [ ] 2.3 Create `app/components/TimeInput.vue`: text input, `v-model: string | null` (`HH:mm`), commit on blur/Enter, Escape cancels, invalid input silently reverts without model update; label and `data-testid` via props
- [ ] 2.4 Nuxt component tests for `TimeInput` (commit normalization, silent revert, Escape cancel, accessible label)

## 3. Adopt TimeInput in the three time-entry locations (frontend)

- [ ] 3.1 `TimerEntryRow.vue`: replace native `<input type="time">` for start and stop editing with `TimeInput`; keep combine-with-local-day logic and blur/Enter/Escape contract
- [ ] 3.2 `TimerAddEntryDialog.vue`: replace `InputText type="time"` start/end fields with `TimeInput`; keep inverted-times inline error
- [ ] 3.3 `AppTimer.vue` popover: replace `DatePicker time-only` with `TimeInput` (model mapped to/from the seeded start `Date`); keep future-start inline error
- [ ] 3.4 Update existing nuxt tests for row inline editing, the manual-entry dialog, and the popover to the new inputs, adding compact-typed-time cases (`900` commit, `59` revert)
- [ ] 3.5 E2E test: edit a running timer's start time by typing a compact value in the top-bar popover and verify the elapsed ticker rebases

## 4. Typed date commit in the start popover (frontend)

- [ ] 4.1 In `AppTimer.vue`, commit a manually typed valid `yyyy-mm-dd` date (tolerating unpadded parts) on blur/Enter on the DatePicker input; invalid text reverts as before
- [ ] 4.2 Nuxt tests: typed `2026-7-9` commits as `2026-07-09`; garbage text reverts and sends no request

## 5. Inline group editing replaces the dialog (frontend)

- [ ] 5.1 `TimerTaskGroup.vue`: in-place title editing (button → input, blur/Enter commit via `PATCH /api/tasks/:id`, Escape cancels, empty/whitespace name silently reverts)
- [ ] 5.2 `TimerTaskGroup.vue`: in-place project editing — context label (or localized "(no project)" placeholder) as a button swapping to a PrimeVue `Select` with clear option; move `extraProjectOptions` (soft-deleted current project) logic in from the dialog; pass project options from the page
- [ ] 5.3 Remove `TimerTaskEditorDialog.vue`, the group edit button/`edit` emit, and the `editingTask` wiring in `app/pages/index.vue`; keep post-save `refreshEntries()` + `fetchRunning()`; ensure the "(no task)" group offers no title/project editing
- [ ] 5.4 Add "(no project)" placeholder and any new labels to `i18n/locales/en.json` and `pl.json` in parity; remove dialog-only keys
- [ ] 5.5 Nuxt tests for inline group editing: rename commit, empty-name silent revert, Escape cancel, project change/clear, placeholder visibility, soft-deleted project retained, a11y (labelled buttons, keyboard-operable select)
- [ ] 5.6 E2E test: rename a task group inline and assign a project via the "(no project)" placeholder; verify regrouping after a merge-collision rename

## 6. Refresh entries when the timer stops (frontend)

- [ ] 6.1 In `app/pages/index.vue`, watch `running` from `useTimer` and call `refreshEntries()` on the running→stopped transition (and running-id change), guarding against double-fetch after page-initiated actions
- [ ] 6.2 E2E test: start a timer, stop it from the top-bar widget, and verify the finished entry appears in the timer view without a manual reload

## 7. Final verification

- [ ] 7.1 Run `pnpm lint`, `pnpm format:check`, `pnpm test:unit`, `pnpm test:nuxt`, `pnpm test:e2e` and keep the suite green
