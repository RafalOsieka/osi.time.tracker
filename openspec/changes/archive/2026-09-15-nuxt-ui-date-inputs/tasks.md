All tasks are frontend (`apps/web`); there is no backend work in this change.

## 1. Dependency and shared test helpers

- [x] 1.1 Add `@internationalized/date` to `apps/web/package.json` `dependencies` at the range `@nuxt/ui` declares (`^3.12.4`), run `pnpm install`, and verify `import { CalendarDate, parseDate, today } from '@internationalized/date'` type-checks from `apps/web/app` (`pnpm type-check`).
- [x] 1.2 Add a Playwright helper `typeDateField(page, testId, isoDate, index = 0)` in `apps/web/test/e2e/helpers/ui.ts` (or a sibling `date-field.ts`) that clicks the `[data-segment="day"]`, `month`, and `year` segments inside `[data-testid="<testId>"]` (nth `index` for range fields) and types each part's digits; verify with a smoke assertion in the first journey that uses it (task 3.4) that the field's segments show the typed date.
- [x] 1.3 Add a `UInputDate` stub next to the existing `UInput` stub in `apps/web/test/nuxt/AppTimer.spec.ts` (renders a root element carrying `$attrs`, re-emits `update:modelValue`), and verify the existing AppTimer suite still mounts with `pnpm test:nuxt -t "AppTimer"`.

## 2. Remote Sync jump-to-day calendar (REQ-224)

- [x] 2.1 Replace the `UInput type="date"` inside `SyncDayHeader.vue`'s popover with a `UCalendar` bound to `parseDate(date)`; on `update:model-value` emit `navigate` with `value.toString()` and close the popover (no-op when the day equals the current route day); keep `data-testid="remote-sync-calendar"` on the popover content and drop `remote-sync-calendar-input` and `onDateInputChange`. Verify manually that the calendar opens on the displayed month with the day selected and that picking another day navigates.
- [x] 2.2 Update `apps/web/test/nuxt/remote-sync-page.spec.ts` to assert the popover renders a calendar grid (no `input[type=date]`) and that emitting a new `CalendarDate` from the `UCalendar` instance triggers navigation to that day and not when the same day is picked; verify with `pnpm test:nuxt -t "remote-sync"`.
- [x] 2.3 Update the jump-to-date journey in `apps/web/test/e2e/ui/remote-sync-ui.spec.ts` (around line 422) to open the label popover and click a day cell in the grid (by its accessible name or `[data-value]`), asserting the route changes and the popover closes; add a keyboard variant (arrow into the grid, Enter) and an Escape-closes-without-navigating assertion; verify with `pnpm test:e2e:ui -t "remote-sync"`.

## 3. Timer start editor (REQ-146)

- [x] 3.1 In `AppTimer.vue`, replace `startDateText` / `startDate: Date` / `commitStartDateText` / the inline `@change` handler with a single `startDate: ShallowRef<CalendarDate | null>` seeded from `current.toPlainDate().toString()` via `parseDate`; render `UInputDate` with the existing `id`, `data-testid="timer-start-editor-date-input"`, `:aria-label`, and a `#trailing` calendar `UButton` + `UPopover` > `UCalendar` bound to the same ref; `combineStartedAt()` uses `startDate.value?.toString()`; disable the save button while `startDate` is `null`. Verify manually: typing digits fills the field, calendar pick keeps the start editor open, save patches `startedAt`.
- [x] 3.2 Remove `localDateToPickerDate`, `pickerDateToLocalDate`, `toPickerDate`, `fromPickerDate` from `apps/web/app/utils/date-time.ts` and their cases from `apps/web/test/unit/date-time.spec.ts`; verify `pnpm lint` reports no unused exports and `pnpm test:unit -t "date-time"` passes.
- [x] 3.3 Update `apps/web/test/nuxt/AppTimer.spec.ts` start-editor cases: seed date via the `UInputDate` stub's `update:modelValue` with a `CalendarDate`, assert the PATCH payload's `startedAt` matches the combined date/time, assert save is disabled when the date model is `null`, and keep the future-start inline-error case; verify with `pnpm test:nuxt -t "AppTimer"`.
- [x] 3.4 Update `apps/web/test/e2e/ui/timer-topbar-start-edit.spec.ts` to fill the date via `typeDateField` (replacing the `input.value = …` evaluate), and add a journey that opens the field's calendar inside the start editor, picks yesterday, asserts the start editor popover is still open with the new date, saves, and verifies `startedAt` moved; verify with `pnpm test:e2e:ui -t "start edit"`.
- [x] 3.5 Add the `common.openCalendar` (or equivalent) aria-label string to `apps/web/i18n/locales/en.json` and `pl.json`; verify `pnpm test:unit -t "i18n-catalog-parity"` passes.

## 4. Manual add-entry dialog (REQ-150 via REQ-359)

- [x] 4.1 In `TimerAddEntryDialog.vue`, change `state.date` to a `CalendarDate | null` (default `today(effective.timeZone)`), render `UInputDate` with the existing `id`/`data-testid="add-entry-date-input"`/`:aria-label` plus the trailing calendar popover, convert with `.toString()` where the instant is built, and block submit with the existing inline-error pattern when the date is `null`. Verify manually that the field defaults to today and the created entry lands on the typed day.
- [x] 4.2 Update `apps/web/test/nuxt/timer-add-entry-dialog.spec.ts`: replace `setValue('2024-03-15')` with an `update:modelValue` emit of `new CalendarDate(2024, 3, 15)` on the `UInputDate` instance, assert the POST payload dates, and add a case that submit is blocked when the date is cleared to `null`; verify with `pnpm test:nuxt -t "add-entry"`.
- [x] 4.3 Add or extend a Playwright journey (in the existing timer-view e2e spec that covers add-entry) that types a date with `typeDateField`, submits, and asserts the entry appears under that day's section; verify with `pnpm test:e2e:ui -t "add entry"`.

## 5. Tracker import range (REQ-340)

- [x] 5.1 In `TrackerImportDialog.vue`, replace `fromDate`/`toDate` with `range: ShallowRef<{ start: CalendarDate; end: CalendarDate } | null>`, `defaultRange()` from `today(tz).subtract({ years: 5 })`/`today(tz)`, one `<label for="tracker-import-range">` with a new `trackerImport.rangeLabel` string (en/pl, replacing `fromLabel`/`toLabel`), a `UInputDate range` with `data-testid="tracker-import-range-input"` and a trailing `UCalendar range` popover; keep the `rangeRequired` (either end missing) and `rangeInverted` (`Temporal.PlainDate.compare` on `.toString()`s) guards and pass `.toString()` values to `startScan`. Verify manually that the default range shows, an inverted range shows the error, and a valid range scans.
- [x] 5.2 Update `apps/web/test/nuxt/tracker-import-dialog.spec.ts`: drive the range through `update:modelValue` on the `UInputDate` instance for the inverted-range error, an incomplete range (`end` missing → `rangeRequired`), and a valid range that calls `startScan` with the ISO strings; verify with `pnpm test:nuxt -t "tracker-import"`.
- [x] 5.3 Update `apps/web/test/e2e/ui/tracker-import-ui.spec.ts` and `tracker-import-extension-ui.spec.ts` to fill the range via `typeDateField(page, 'tracker-import-range-input', from, 0)` / `(…, to, 1)` instead of `page.fill` on the old from/to ids, and add one journey step that picks a range from the calendar popover; verify with `pnpm test:e2e:ui -t "import"`.
- [x] 5.4 Verify `pnpm test:unit -t "i18n-catalog-parity"` passes after removing `trackerImport.fromLabel`/`toLabel` and adding `rangeLabel` in both catalogs.

## 6. Spec text and docs (REQ-154, REQ-359)

- [x] 6.1 Confirm no `type="date"` remains under `apps/web/app` (`grep -rn 'type="date"' apps/web/app` returns nothing) and that every `UInputDate` carries `:aria-label`; verify with `pnpm lint` (a11y rules) passing.
- [x] 6.2 Extend the UI bullet in `AGENTS.md` (Code Style → UI) to name `UInputDate`/`UCalendar` for dates alongside the existing component list, and verify the wording matches REQ-359 (no other doc changes).

## 7. Final verification

- [x] 7.1 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:nuxt`, and `pnpm test:e2e:ui`; all green.
- [x] 7.2 Visual parity pass in the dev app (`pnpm dev`, both `en` and `pl`): start-editor popover, add-entry dialog, import range row, and Remote Sync header render at the same height/width as before the change, with only the import row collapsed into one range control.
