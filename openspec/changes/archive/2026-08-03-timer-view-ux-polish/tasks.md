## 1. Backend: newest entry anchor endpoint

- [x] 1.1 Add `LatestTimeEntryDto` (`{ startedAt: string } | null`) to `shared/types/time-entry.ts`
- [x] 1.2 Add `server/api/time-entries/latest.get.ts`: resolve the authenticated user via the shared auth helper, read the newest entry through the shared Drizzle client (`ORDER BY startedAt DESC LIMIT 1`, scoped by `userId`), and return the instant as an ISO string or `null`
- [x] 1.3 Confirm an index supports the descending `startedAt` read for a single user in `server/db/schema/time-entries.ts`; add one plus a migration (`pnpm db:generate`) only if missing
- [x] 1.4 Integration tests for `GET /api/time-entries/latest`: newest entry returned, running entry eligible, `null` for a user with no entries, another user's newer entry ignored, unauthenticated request rejected

## 2. Frontend: anchored initial window

- [x] 2.1 Extend `computeWindowRange()` in `app/utils/timerViewGrouping.ts` to accept an optional anchor instant (defaulting to now) while preserving `weekStart` alignment and the 7-day step
- [x] 2.2 Unit-test the anchored `computeWindowRange()`: anchor in a past week aligns to that week's `weekStart`, anchor in the current week yields the current window, `load more` extends from the anchored start, both `weekStart` values covered, DST-boundary week covered
- [x] 2.3 Fetch the anchor in `app/pages/index.vue` on first load and derive the initial window from it; keep the anchor cached so `load more` and a `weekStart` change re-derive without re-fetching
- [x] 2.4 Add a `resetToCurrentWeek()` action plus the non-current-week signpost banner (localized week label, stable `data-testid`), rendered only when the anchored window is not the current week

## 3. Frontend: split empty states

- [x] 3.1 Replace the single `isEmpty` branch with three states — entries present, empty window (CTA "load more"), never tracked (CTA pointing at the timer widget) — driven by the anchor being `null`
- [x] 3.2 Add the anchored-week, reset-to-current-week and never-tracked strings to `i18n/locales/en.json` and `pl.json` in parity
- [x] 3.3 Component test (`test/nuxt`) for the three states and for the reset control re-aligning the window

## 4. Frontend: create-new-task option in the top-bar autocomplete

- [x] 4.1 Enable the `UInputMenu` create-item sentinel in `app/components/AppTimer.vue`, shown for any non-empty typed text including exact matches, labelled with the typed text plus a localized "(new task)" marker
- [x] 4.2 Wire `@create` to `applyFreeformTitle()` so the captured task identity is cleared, the overlay closes, and only `title` is sent on start
- [x] 4.3 Add the create-option i18n keys to `en.json` and `pl.json` in parity, with an accessible name that includes the typed text
- [x] 4.4 Component test (`test/nuxt`) for `AppTimer`: sentinel present alongside an exact match, absent for empty text, activation clears a previously selected `taskId`, keyboard activation closes the overlay

## 5. E2E coverage

- [x] 5.1 E2E: with entries only in an earlier week, open `/` and assert that week's entries are listed and the signpost plus reset control are shown; activate reset and assert the current (empty) week
- [x] 5.2 E2E: a user with no entries at all sees the never-tracked empty state and no "load more"
- [x] 5.3 E2E: type a title that matches an existing project-bound task, activate the create option, start the timer, and assert the new entry is project-less rather than bound to the matching task

## 6. Verification

- [x] 6.1 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`
- [x] 6.2 Run `pnpm test:unit`, `pnpm test:nuxt`, `pnpm test:e2e`
