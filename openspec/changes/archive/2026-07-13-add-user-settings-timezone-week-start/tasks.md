## 1. Backend: schema & settings API

- [x] 1.1 Add `timezone` (text, nullable) and `week_start` (text, default `'monday'`) columns to `users` in `server/db/schema`; generate and commit the Drizzle migration (`pnpm db:generate`)
- [x] 1.2 Create `shared/types/user-settings.ts`: settings DTO, `WeekStart` union, and a zod schema validating `timezone` against `Intl.supportedValuesOf('timeZone')` and `weekStart` as `monday`/`sunday`
- [x] 1.3 Extend the `AuthUser` boundary type and session creation (login) to include the user's settings
- [x] 1.4 Implement `server/api/user/settings.get.ts` (requireAuth, returns settings DTO)
- [x] 1.5 Implement `server/api/user/settings.patch.ts` (requireAuth + CSRF, zod validation via `mapZodError`, persists settings, re-seals the session with updated values, returns the DTO)
- [x] 1.6 Unit tests for the zod schema (valid/invalid timezone, week start, partial update)
- [x] 1.7 E2E/integration tests for GET/PATCH settings: happy path, invalid timezone rejected, unauthenticated 401, session payload refreshed after PATCH

## 2. Frontend: timezone-aware date foundation

- [x] 2.1 Add `temporal-polyfill` dependency and a small date-utils module wrapping instant↔zoned conversions (`compatible` disambiguation)
- [x] 2.2 Rework `app/utils/timerViewGrouping.ts` (`localDayKey`, `computeWindowRange`, `combineLocalDateAndTime`, `isoToLocalTime`) into pure functions taking `{ timeZone, weekStart }` parameters, built on Temporal
- [x] 2.3 Update `app/utils/formatDate.ts` / `formatDuration.ts` to pass an explicit `timeZone` to `Intl`/`toLocale*` formatting
- [x] 2.4 Add the PrimeVue `DatePicker` adapter pair (`toPickerDate`/`fromPickerDate`) confined to the components using the picker
- [x] 2.5 Implement `useUserSettings` composable: effective settings (stored value or browser-detected TZ + Monday fallback), sourced from the session, with optimistic update on save
- [x] 2.6 Unit tests for the reworked date utils: foreign-zone day bucketing, week windows for Monday/Sunday starts, DST skipped/ambiguous wall-clock conversion, picker adapter round-trip
- [x] 2.7 Unit tests for `useUserSettings` fallback logic (no saved TZ → detected, saved TZ wins)

## 3. Frontend: apply settings to the timer view

- [x] 3.1 Wire the timer view page, `AppTimer.vue`, `TimerAddEntryDialog.vue`, and `TimerEntryRow.vue` to the effective `{ timeZone, weekStart }` from `useUserSettings` (grouping, manual-entry conversion, inline edits, running-start popover seed)
- [x] 3.2 Ensure a settings change triggers a pure client-side regroup/re-render of loaded entries (no refetch)
- [x] 3.3 Nuxt component tests for timer view grouping under a non-browser timezone and regroup-on-settings-change

## 4. Frontend: settings page

- [x] 4.1 Build the `/settings` preferences form: filterable timezone `Select` from `Intl.supportedValuesOf('timeZone')` with a localized "detected" hint when unsaved, week-start `SelectButton`, save via `$csrfFetch` PATCH with success confirmation and translated error handling
- [x] 4.2 Update the sidebar/settings routing expectations (page is no longer a placeholder; keep nav test hooks)
- [x] 4.3 Add all new i18n keys to `en.json` and `pl.json` in parity
- [x] 4.4 E2E test: change timezone and week start on `/settings`, verify persistence across reload and that timer-view day grouping re-renders accordingly
- [x] 4.5 Accessibility pass on the form (labelled controls, keyboard operation) and `pnpm lint` green

## 5. Verification

- [x] 5.1 Run `pnpm lint`, `pnpm format:check`, `pnpm test:unit`, `pnpm test:nuxt`, `pnpm test:e2e`; keep the suite green
