## Why

Live timers store `startedAt`/`stoppedAt` with seconds (`new Date()`), while every time editor produces whole minutes. Editing a stop time that already shows the right minute rewrites `10:42:31` to `10:42:00`, which the server rejects as "stopped before started" when the entry started later in that minute — and every blur on a live entry sends a PATCH because the no-op check never matches. The smart text input (REQ-131) is also the last clock-time control not built on Nuxt UI: users retype the whole `HH:mm` instead of clicking the minute part, now that dates already use `UInputDate` (REQ-359).

## What Changes

- Clock times use Nuxt UI `UInputTime` (24-hour, hour + minute segments) through one thin wrapper. Its model is a real date-time, so an edit replaces only the touched segment and keeps the entry's date, seconds and milliseconds. Server precision and validation are unchanged.
- Entry rows render start–stop as one permanently visible range field instead of two read-only slots that swap to a text editor; a running entry shows a single start field plus the "now" label at the same width. Commit on blur/Enter, cancel on Escape, no request when nothing changed.
- When an edit puts both bounds in the same minute with inverted seconds, the wrapper snaps the edited bound's seconds to the other bound (zero-duration entry, matching the screen).
- Add-entry dialog: start/end become one labelled range field; the running-start popover uses the single field.
- **BREAKING (UI contract):** the forgiving parser (`93` → `09:30`, "invalid reverts silently") is retired for clock times. `TimeInput` keeps only its duration mode and is renamed `DurationInput`.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `shared-ui-components`: new REQ-361 (segmented clock-time field) and REQ-362 (duration input, the surviving half of REQ-131); REQ-131 removed; REQ-178 wording follows.
- `time-tracking`: REQ-146 popover, REQ-150 manual form and inline edits, REQ-265 entry-row time slot use the segmented field; seconds preserved, same-minute inversions clamped.

## Non-goals

- No change to timestamp precision, API, validation, or database.
- Remote Sync "to send" stays a free-text duration input (durations may exceed 24 h; `Time` cannot).
- No "type an end to stop a running entry" from the row.
- No date control in entry rows; edits stay on the entry's local day (REQ-265).

## Impact

- Components: new `TimeField.vue`; `TimerEntryRow.vue`, `TimerAddEntryDialog.vue`, `AppTimer.vue`; `TimeInput.vue` → `DurationInput.vue`.
- Utils: `normalizeTimeInput` + unit spec removed; instant ⇄ `ZonedDateTime` helpers.
- Tests: 3 Playwright journeys, 5 nuxt specs, a `typeTimeField` helper. i18n labels in `en`/`pl`. `AGENTS.md` UI bullet.
