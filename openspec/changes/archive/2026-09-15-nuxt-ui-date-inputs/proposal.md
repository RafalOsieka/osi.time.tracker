## Why

Every date the UI accepts today is a native `<input type="date">` wrapped in `UInput` (timer start editor, manual add-entry dialog, tracker import range, Remote Sync jump-to-day popover), even though Nuxt UI 4.11 ships `UInputDate` and `UCalendar`. The native control renders differently per browser, ignores the `UApp` locale, and the Remote Sync "calendar" is really a text box. Clock times already have the shared smart time input (REQ-131) and stay as they are — this change is dates only.

## What Changes

- Shared date-entry rule (`shared-ui-components`): single dates use `UInputDate`, inclusive ranges use `UInputDate range`, jump-to-date pickers use `UCalendar`; native `type="date"` is retired. Call sites keep their `YYYY-MM-DD` string contract.
- Timer start editor (REQ-146): segmented `UInputDate` with a trailing calendar popover; the "typed `2026-7-9`" and "invalid text reverts" scenarios become segmented-field scenarios, since the field cannot hold an invalid date.
- Manual add-entry dialog: date field becomes `UInputDate` (covered by the shared rule; REQ-150 wording unchanged).
- Tracker import range phase (REQ-340): from/to become one labelled `UInputDate range`; inverted range still rejected inline.
- Remote Sync day switcher (REQ-224): the popover shows a `UCalendar`; picking a day navigates and closes it.
- Fix stale REQ-154 text naming PrimeVue components — the timer view uses Nuxt UI.
- Layout: swapped controls keep the same size token and wrappers so field heights and surrounding grids do not shift; the only reorganisation is the import range collapsing two fields into one.
- `@internationalized/date` becomes a declared `apps/web` dependency (already transitively present).

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `shared-ui-components`: new REQ-359 — Nuxt UI date components are the single date-entry mechanism.
- `time-tracking`: REQ-146 start-editor date field is a segmented `UInputDate` with calendar; REQ-154 names Nuxt UI instead of PrimeVue.
- `remote-sync-review`: REQ-224 jump-to-date opens a `UCalendar`.
- `remote-log-import`: REQ-340 range phase uses one date-range field.

## Non-goals

- No change to clock-time entry: `TimeInput`/REQ-131 stays the single time input; `UInputTime` is not adopted.
- The Remote Sync rounded-duration editor stays a duration text input.
- No date-format preference (WBS 7.5 stays deferred); segment order follows the `UApp` locale.
- No server/API changes.

## Impact

- Components: `AppTimer.vue`, `TimerAddEntryDialog.vue`, `TrackerImportDialog.vue`, `sync/SyncDayHeader.vue`.
- `apps/web/app/utils/date-time.ts`: the `Date`-based picker helpers become dead and are removed.
- `apps/web/package.json`: add `@internationalized/date`; i18n `en`/`pl`: calendar-button and range labels.
- Tests touching date fields (nuxt + Playwright): date fields are no longer `<input>`s, so a shared segment-typing helper replaces `fill`/`setValue`.
