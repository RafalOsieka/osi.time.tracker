## 1. Timer composable (frontend)

- [x] 1.1 Add a `loading` state to `useTimer` (`useState<boolean>`), set true before the initial `fetchRunning()` and false in a `finally`; export it as `readonly`
- [x] 1.2 Add an `updateTitle(title: string | null)` action wrapping `PATCH /api/time-entries/[id]` via `$csrfFetch`; send `title: null` for a blank/whitespace-only value; update `running` from the returned DTO
- [x] 1.3 Unit/nuxt test: `loading` is true during the in-flight running fetch and false after it resolves (running and no-running cases)

## 2. Timer widget UI (frontend)

- [x] 2.1 Bind the input's displayed value to `running.taskName` while running (blank when `taskName` is `null` — no placeholder, no "(no task)"); keep the local ref only for the idle/compose state
- [x] 2.2 Disable the autocomplete input and toggle button while `loading` is true, then reflect the resolved state
- [x] 2.3 Make the running title editable in place; commit via `updateTitle` on **blur** and on **Enter**; a blank commit detaches the task (`title = null`)
- [x] 2.4 Track suggestion-overlay visibility (`@before-show`/`@hide`); on Enter, start the timer only when the overlay is closed, otherwise let PrimeVue handle select/close
- [x] 2.5 Keep WCAG 2.1 AA: labelled control, keyboard operable, disabled state conveyed

## 3. Tests (frontend)

- [x] 3.1 nuxt test: after start, the running title is displayed (not cleared to placeholder)
- [x] 3.2 nuxt test: after reload/hydration with a running entry, the title is displayed from the server
- [x] 3.3 nuxt test: untitled running entry shows a blank input (no placeholder, no "(no task)")
- [x] 3.4 nuxt test: input and button are disabled while the running fetch is in flight
- [x] 3.5 nuxt test: Enter with overlay closed starts the timer; Enter with overlay open does not start
- [x] 3.6 nuxt test: editing the running title and blurring/Enter commits via PATCH; clearing to blank detaches the task

## 4. Verification

- [x] 4.1 Run `pnpm lint` and `pnpm format:check`
- [x] 4.2 Run `pnpm test:unit`, `pnpm test:nuxt`, and `pnpm test:e2e`; ensure all pass
- [x] 4.3 Confirm i18n parity (`test/unit/i18n-catalog-parity.spec.ts`) if any keys were added
