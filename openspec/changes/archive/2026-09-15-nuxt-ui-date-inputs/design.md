## Context

See `proposal.md` — Why. Four call sites hold a date today, all as `UInput type="date"` bound to a `YYYY-MM-DD` string:

| Call site | Model today | Downstream contract |
|---|---|---|
| `AppTimer.vue` start editor | `startDateText: string` **plus** a parallel `startDate: Date` kept in sync by `toPickerDate`/`fromPickerDate` (`utils/date-time.ts`) | `wallClockToInstant(dayKey, 'HH:mm', tz)` |
| `TimerAddEntryDialog.vue` | `state.date: string` | `wallClockToInstant` |
| `TrackerImportDialog.vue` | `fromDate` / `toDate: string` | `Temporal.PlainDate.compare`, `startScan({ from, to })` |
| `sync/SyncDayHeader.vue` | `dateInput: string` mirrored from the route `date` prop | `emit('navigate', dayKey)` |

Nuxt UI 4.11.1 ships `UInputDate` (reka `DateField` / `DateRangeField`), `UCalendar`, and the documented "date picker" composition (`UInputDate` + `#trailing` `UPopover` > `UCalendar`, anchored to the field via `inputsRef`). Their model type is `@internationalized/date` `CalendarDate`; the app's date math is `temporal-polyfill`. `UApp` already receives the active `en`/`pl` locale, which drives segment order.

Constraints: REQ-131 (`TimeInput`) is untouched; existing `data-testid` / `id` / `<label for>` wiring must survive; heights and surrounding grids must not shift.

## Goals / Non-Goals

**Goals:**
- One way to enter a date across the app, locale-aware, with a calendar affordance everywhere.
- Keep the `YYYY-MM-DD` string contract at every call site so date math, API payloads, and routes are unchanged.
- Delete the `Date`-based picker shim in `AppTimer`.
- Make date fields testable with one shared helper per test layer.

**Non-Goals:**
- Replacing `Temporal` with `@internationalized/date` (or vice versa) anywhere outside the field boundary.
- Any `UInputTime` adoption, or changes to the duration editor on Remote Sync.
- A user-facing date-format preference; segment order is whatever the `UApp` locale produces.

## Decisions

### D1. `CalendarDate` lives only at the component boundary; strings everywhere else
Each call site holds `CalendarDate | null` (or `{ start, end }` for the range) as the field's `v-model` and converts at the edge: `parseDate(dayKey)` on the way in, `value.toString()` (already `YYYY-MM-DD` for `CalendarDate`) on the way out. No new shared utility — both conversions are single library calls and a wrapper would be exactly the one-liner cast we avoid. `@internationalized/date` is added to `apps/web/package.json` at the same range `@nuxt/ui` declares (`^3.12.4`) because pnpm's strict layout does not expose transitive packages.

*Alternative considered:* a `useDateField(dayKeyRef)` composable returning a computed `CalendarDate` getter/setter. Rejected: four call sites, each a two-line conversion; a composable would hide `null` handling that each site treats differently (blocks save vs shows range error vs ignores).

### D2. Segmented field + trailing calendar popover for form dates; bare calendar for jump-to-day
Form dates (start editor, add-entry, import range) use the documented composition: `UInputDate` with a `#trailing` `UButton` opening a `UPopover` whose content is `UCalendar` (`range` on the import dialog). The Remote Sync switcher already has a button that opens a popover, and its only job is "pick a day", so its popover content becomes `UCalendar` directly, bound to the route day; `@update:model-value` navigates and closes.

*Alternative considered:* `UCalendar` inline inside the forms without a segmented field. Rejected: a 7-column grid is ~280 px wide and ~300 px tall; dropping it into the `min-w-64` start-editor popover or the import dialog's range row is exactly the layout reorganisation ruled out.

### D3. The start editor keeps its nested popover; fallback is documented
`AppTimer`'s start editor is a `UPopover`; the date field's calendar opens a second `UPopover` inside its content. Reka's dismissable layers stack, so an inside click on the calendar must not dismiss the outer popover. If in practice the outer popover closes (focus-outside / pointer-outside heuristics), the fallback is to render the calendar for that one field with `:dismissible="false"` on the outer popover while the inner one is open — not to drop the calendar. The e2e journey for the start editor asserts the outer popover survives a calendar pick (REQ-146 "Calendar pick stays inside the start editor").

### D4. `AppTimer` state collapses to one `CalendarDate`
`startDateText`, `startDate`, `commitStartDateText()`, and the `@change` handler are replaced by `startDate: ShallowRef<CalendarDate | null>`; `combineStartedAt()` reads `startDate.value?.toString()`. `localDateToPickerDate` / `pickerDateToLocalDate` and the `toPickerDate` / `fromPickerDate` aliases in `utils/date-time.ts` lose their last caller and are deleted along with their unit tests.

### D5. Import range becomes one `UInputDate range` control
`fromDate` / `toDate` become `range: ShallowRef<{ start: CalendarDate; end: CalendarDate } | null>`. The existing guards stay: a missing end → `rangeRequired`; `Temporal.PlainDate.compare(start.toString(), end.toString()) > 0` → `rangeInverted`. `defaultRange()` builds the two `CalendarDate`s from `today(tz)`. The two `<label for>` become one label; `tracker-import-from-input` / `tracker-import-to-input` test ids collapse to `tracker-import-range-input` (the only selector rename in this change, and the range field has no separate from/to elements to keep them on).

*Alternative considered:* keep two single fields for zero test churn. Rejected by the owner: the range variant is the point of the component and the inverted-range error stays anyway.

### D6. Labels and accessible names
`UInputDate` spreads `$attrs` onto its root (`div[role=group]`), so `data-testid` and `id` land there. A `<label for>` on a `div` does not focus anything on click, so each field also receives `:aria-label` with the same translated text (the pattern `TimeInput` already uses); the visible `<label>` stays for layout parity. The calendar button gets a new translated `aria-label` (`common.openCalendar`, en/pl).

### D7. Size and layout parity
Every swapped field keeps the default `md` size in dialogs (matching the neighbouring `UInput`/`UInputMenu`) and stays inside its existing `grid gap-1` wrapper; `UInputDate` shares the `UInput` theme size scale so the control height is identical. The import dialog's `grid grid-cols-2` row becomes a single full-width row (REQ-263 full-width controls in dialogs). Nothing else in the surrounding layouts changes.

### D8. Test strategy per layer
- **Nuxt component tests** (`test/nuxt`): the field is driven through its component instance — `wrapper.findComponent({ name: 'UInputDate' }).vm.$emit('update:modelValue', new CalendarDate(...))` — the same technique `AppTimer.spec.ts` already uses for `UInputMenu`. Assertions on the model read the emitted string contract, not DOM segments. `AppTimer.spec.ts`'s local `UInput` stub gains a `UInputDate` stub of the same shape.
- **Playwright** (`test/e2e/ui`): a helper `typeDateField(page, testId, isoDate, index = 0)` in `test/e2e/helpers/` clicks the `[data-segment="day"]`/`month`/`year` segment (nth `index` for range fields) inside `[data-testid]` and types the digits; order-independent because it targets segments by part, not by position. Calendar picks are exercised by at least one journey (Remote Sync) via the grid's `[data-value]` / accessible day names.
- No unit tests are added for the conversions (single library calls); the deleted `date-time.ts` helpers take their tests with them.

## Risks / Trade-offs

- [Nested popover in the start editor dismisses the outer one] → D3 fallback; covered by an e2e assertion so it cannot regress silently.
- [`en` locale renders month-first segments, unfamiliar to a Polish user working in English] → accepted: `formatDate` already uses `en-US` conventions for display, so entry and display agree; a locale/format preference is WBS 7.5.
- [Happy-dom / jsdom cannot run reka's segment keyboard handling] → tests never type into segments below Playwright (D8).
- [`@internationalized/date` and `temporal-polyfill` both in the client bundle] → `@internationalized/date` is already shipped by `@nuxt/ui`; the added weight is zero. Only string round-trips cross the boundary, so there is no dual-representation drift.
- [Test-id rename for the import range] → single rename, called out in tasks; every other selector is preserved.
- [Segments accept `Backspace` to empty, yielding `null`] → every call site already has a "required" guard (save disabled, `rangeRequired`, navigate ignored); specs now state that behaviour explicitly.

## Migration Plan

Pure front-end change; ship in one PR. No data, route, or API migration. Rollback is a revert.
