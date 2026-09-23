## 1. Frontend: Time Field Behavior

- [ ] 1.1 Update `TimeField.vue` to hide timezone text only on non-transition dates for zoned single and range values; verify ordinary, spring/fall transition, spanning-range, and unzoned cases in `apps/web/test/nuxt/shared-ui-components.spec.ts`.
- [ ] 1.2 Update `TimeField.vue` to commit on settled focus leaving the entire control, preserving Enter/Escape and preventing duplicate commits; verify missing `relatedTarget`, internal range transitions, outside blur, and cancellation in focused Nuxt tests.
- [ ] 1.3 Ensure `TimerEntryRow.vue` does not PATCH on an incomplete range after focus transitions, without changing instant conversion; verify with the timer-view UI test and existing entry editing behavior.

## 2. Frontend: Browser Journeys

- [ ] 2.1 Add a real segmented range interaction in `apps/web/test/e2e/ui/timer-view-ui.spec.ts` that edits the start, crosses into the end group without PATCH, then leaves the whole field and observes exactly one valid PATCH; verify by running the focused UI test.
- [ ] 2.2 Cover ordinary-day hidden timezone and transition-day visible abbreviation, including compact row layout and keyboard access, in the appropriate browser/component tests; verify by running the focused tests.

## 3. Backend

- [ ] 3.1 Confirm no backend/API changes are required by this UI-only change; verify the existing PATCH contract and that no server files were modified.

## 4. Validation

- [ ] 4.1 Run focused Nuxt and UI tests, then `pnpm lint`, `pnpm format:check`, and `pnpm type-check`; verify failures are resolved without weakening tests.