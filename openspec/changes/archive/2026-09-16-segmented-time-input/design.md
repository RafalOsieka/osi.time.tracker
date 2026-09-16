## Context

See `proposal.md` — Why. Four call sites accept a clock time today, all through `TimeInput.vue` (REQ-131) with an `HH:mm` string model:

| Call site | Model today | Instant conversion | Commit contract |
|---|---|---|---|
| `TimerEntryRow.vue` start / stop | `startValue` / `stopValue: string`, swapped into a `w-[10ch]` slot when `editingField` is `'start'` / `'stop'` | `combineWithEntryDay(iso, 'HH:mm')` → `wallClockToInstant` | blur / Enter → `PATCH`, Escape → revert; skips the request when the string round-trips equal |
| `TimerAddEntryDialog.vue` start / end | `state.startTime` / `state.endTime: string` | `wallClockToInstant(state.date, …)` at submit | form submit; `rangeError` when end < start |
| `AppTimer.vue` start popover | `startTime: string \| null` | `wallClockToInstant(startDate, …)` on save | save button; inline future error |
| `sync/SyncDayRow.vue` to-send | `HH:MM:SS` duration string (`duration` prop) | `normalizeDurationInput` → seconds | blur / Enter / Escape (REQ-178) |

Server write paths (`index.post.ts`, `[id].patch.ts`) store whatever instant they receive; live start/stop use `new Date()`, so stored values carry seconds and milliseconds. `wallClockToInstant` builds a `PlainDateTime` from `{ hour, minute }` only, so every edited instant ends in `:00.000Z`. `[id].patch.ts` rejects `startedAt > stoppedAt` at full precision.

Nuxt UI 4.11 ships `UInputTime` (reka `TimeField` / `TimeRangeField`). Its model is an `@internationalized/date` `TimeValue` (`Time | CalendarDateTime | ZonedDateTime`); `range` uses `{ start, end }` with each side optionally `undefined`. `granularity` controls which segments render, and a `ZonedDateTime` model keeps date, seconds and milliseconds even when only hour/minute segments are shown. Its `xs` size token is `px-2 py-1 text-sm/4` — the same classes the entry row's `timeSlotUi` applies today — and every non-literal segment is a fixed `w-8` at `xs`/`sm`, so a field's width is deterministic. `@internationalized/date` is already a declared dependency (REQ-359 work).

Constraints: REQ-265 stable slots (activating an editor must not shift neighbours); REQ-178 inline-edit affordance; REQ-154 accessibility; existing `data-testid` contracts where the control shape survives; `en`/`pl` parity.

## Goals / Non-Goals

**Goals:**
- One segmented, 24-hour clock-time field for every clock time in the app, with per-segment editing.
- Edits preserve the parts the user did not touch (date, seconds, milliseconds), so re-committing an unchanged minute is a no-op and never produces a server error.
- Entry rows lose the display/editor swap: the field is the display.
- Consistent width and height across every row and form where the field appears.

**Non-Goals:**
- Changing what the server stores or validates.
- Replacing `temporal-polyfill` with `@internationalized/date` (or vice versa) beyond the field boundary; grouping, day bounds and range math stay on `Temporal`.
- A duration mode on the new field; `SyncDayRow` keeps the text duration editor.

## Decisions

### D1. One wrapper, `TimeField.vue`, whose model is the raw `TimeValue`
`TimeField` wraps `UInputTime` and owns only behaviour: `hourCycle=24`, `granularity="minute"`, a local draft, `commit` on Enter or on focus leaving the field root, `cancel` on Escape (draft reset to the last committed value), passthrough of `size` / `variant` / `ui` / `disabled` / `id` / `data-testid` / `aria-label`, and the optional clamp (D3). Its `v-model` is `TimeValue | null` or, with `range`, `{ start: TimeValue | null; end: TimeValue | null }`. It emits `update:modelValue` on every segment change (forms bind live) and `commit` / `cancel` for inline sites. It never converts to or from instants.

*Alternative considered:* a wrapper that accepts ISO instants + `timeZone` and hides `ZonedDateTime` entirely. Rejected: the dialog builds instants from a separate date field at submit, the popover from a `CalendarDate`, and the row from the entry's own instant — three different "other halves". Keeping conversion at the call site (as REQ-359's D1 does for dates) keeps the wrapper a pure presentation component.

*Alternative considered:* two wrappers (clock vs duration). Rejected: `SyncDayRow` keeps the text editor, so there is exactly one `UInputTime` consumer shape; a second wrapper would have nothing to wrap.

### D2. `ZonedDateTime` at the boundary; seconds ride along
Call sites convert with two additions to `apps/web/app/utils/date-time.ts`: `instantToZonedDateTime(iso, timeZone)` (`fromAbsolute(Date.parse(iso), timeZone)`) and `zonedDateTimeToInstant(value)` (`value.toDate().toISOString()`). Because the model carries the whole instant, a minute-segment edit yields `10:45:31.812Z` from `10:42:31.812Z`; the row's existing `stoppedAt === entry.stoppedAt` guard then correctly detects "nothing changed". DST disambiguation for a typed wall-clock time is handled by `@internationalized/date` (`set` on a `ZonedDateTime`), replacing `Temporal`'s `disambiguation: 'compatible'` for these paths only. The row no longer needs `combineWithEntryDay`.

*Alternative considered:* a plain `Time` model plus `wallClockToInstant`, as today. Rejected: it is exactly the seconds-dropping path that causes the bug; preserving seconds would need a manual "copy seconds from the previous value" step at each site.

### D3. Same-minute inversion is clamped in the wrapper, behind a prop
With seconds preserved, the screen can show `10:43 – 10:43` while the instants are `10:43:50 > 10:43:10`. `TimeField` accepts `clampSeconds` (default `false`; the entry row passes `true`). On commit in `range` mode, if `start` and `end` fall in the same minute and `start > end`, the bound the user edited takes the other bound's second and millisecond (a zero-duration entry, which the server accepts). The wrapper knows which bound changed because it tracks the draft per side. Server validation stays strict — the clamp is client courtesy, not a rule relaxation.

*Alternative considered:* relaxing `[id].patch.ts` to compare at minute granularity. Rejected: it would persist negative durations. *Also considered:* truncating stored instants to whole minutes. Rejected by the owner: the live ticker and export precision should keep seconds.

### D4. Entry rows render the field permanently; no editor swap
The start/stop pair becomes one `TimeField range` with `size="xs"`, `variant="none"`, and `ui.base` limited to the existing `px-2 py-1 text-sm/4 tabular-nums`, inside one fixed-width slot (`w-[11.5rem]`-class, derived from `2 × (2 × w-8 + literal) + separator + padding`, tuned once against the rendered field). The `#separator` slot renders the existing `timerView.entryRow.separator` text so the row looks as it does now. A running entry (`stoppedAt === null`) renders `TimeField` without `range` for the start plus the existing "now" label, inside the same slot width. `editingField` shrinks to `'title' | null`; `startEditStart` / `startEditStop`, `startValue` / `stopValue`, and the two `UInput readonly` decoys are removed. Commit sends one `PATCH` with whichever of `startedAt` / `stoppedAt` changed (both when both changed).

*Alternative considered:* keep the swap pattern with a read-only `UInput` that becomes a `TimeField` on activation, preserving REQ-178's "seamless until edited" look. Rejected: `variant="none"` already reads as plain text (segments highlight only on focus), and the swap is what made the two-slot width bookkeeping necessary.

### D5. Add-entry dialog uses one range field; popover uses one single field
`TimerAddEntryDialog` replaces `state.startTime` / `state.endTime` with `state.times: { start: Time | null; end: Time | null }` (plain `Time` — there is no existing instant to preserve, and the date is a separate `CalendarDate` field). At submit the instants are built with `toZoned(new CalendarDateTime(date…, time…), tz)` and the existing `rangeError` guard (end before start) stays, driven from the two `Time`s. The two `<label for>` collapse to one label and one `data-testid="add-entry-time-input"`; segments are addressed by `data-segment` and `nth(0|1)` as the date-range helper does. `AppTimer`'s popover replaces `startTime: string | null` with `startTime: Time | null` seeded from the running entry's zoned start; the save button stays disabled while either the date or the time is `null`; `combineStartedAt()` composes the same way as the dialog. Future-start and incomplete-date behaviour is unchanged.

### D6. `TimeInput` → `DurationInput`
`TimeInput.vue` keeps only the duration branch: the `duration` prop and `normalizeTimeInput` branch are removed, the file is renamed `DurationInput.vue`, `SyncDayRow.vue` imports it, and the component test block moves accordingly. `normalizeTimeInput` and `test/unit/normalize-time-input.spec.ts` are deleted. REQ-131 is retired and the duration behaviour is re-specified as REQ-362; REQ-178's "to-send shares the entry start/stop slot pattern" sentence is rewritten to describe the duration editor on its own.

### D7. Test strategy per layer
- **Nuxt component tests**: drive `TimeField` through the `UInputTime` instance (`findComponent({ name: 'UInputTime' }).vm.$emit('update:modelValue', …)`), the technique the date work established; assert emitted instants / request bodies, not DOM segments. New `TimeField` cases in `shared-ui-components.spec.ts`: commit on Enter and focus-out, cancel on Escape, no `commit` when nothing changed, clamp on same-minute inversion (edited side takes the other's seconds), range with an `undefined` end.
- **Playwright**: `typeTimeField(page, testId, 'HH:mm', index = 0)` in `test/e2e/helpers/time-field.ts` clicks `[data-segment="hour"]` / `"minute"` (nth `index` for range) and types digits, mirroring `typeDateField`. The timer-view journey covers the seconds scenario end to end: start and stop a live entry within a minute, retype the same minute, assert no error toast and no `PATCH`; then set a later minute and assert the row and totals update.
- **Unit**: `date-time.spec.ts` gains the two conversion helpers (round-trip preserves seconds/ms; DST wall-clock resolves).

## Risks / Trade-offs

- [Reka segment typing differs from the smart parser: `93` yields `09:03`, not `09:30`] → Accepted and specified (REQ-361); `900` / `1234` still produce `09:00` / `12:34` through segment auto-advance.
- [Permanently rendered segments in every expanded row add focusable elements] → Each field is one `role="group"` with two spinbuttons; rows are only rendered when a group is expanded, and Tab order stays left-to-right as today.
- [Focus-out commit inside a range field must not fire when focus moves between its own segments] → Commit on `focusout` only when `relatedTarget` is outside the field root; covered by a component test.
- [`fromAbsolute` / `toDate` round-trip on a `ZonedDateTime` across a DST gap or overlap] → Only hour/minute segments are editable; `@internationalized/date` resolves wall-clock ambiguity deterministically; a unit test pins the Europe/Warsaw spring-forward hour.
- [Fixed slot width must be tuned by hand once] → Derived from the theme's `w-8` segment token; a Playwright assertion compares the start/stop field width across a stopped row and a running row so they stay aligned.
- [**Known limitation**, accepted as-is: reka-ui 2.10.4's `TimeRangeFieldRoot` (the `range` mode `UInputTime` uses) seeds its rendering segments from an internal ref *once at mount* and never re-syncs them from a later external `modelValue` prop change — unlike its single-value `TimeFieldRoot`, which is correctly controlled. So when a stopped entry's row commit is rejected by the server (e.g. an edit that inverts start/stop across different minutes, which `clampSeconds` does not cover) and `TimerEntryRow` reverts `timesModel` to the entry's stored values, the underlying Vue state is correct but the row's *visible* segments stay on the rejected value until the row remounts (e.g. a page refresh). The running-entry single-field case and the add-entry dialog's live-bound range are unaffected in practice (the add-entry dialog never programmatically reverts a `TimeField`'s value after a rejection). A workaround (forcing a `:key` remount on revert) is available if this needs fixing later; not applied here.

## Migration Plan

Frontend-only; ships with the next deploy, no data or API migration. Rollback is a revert of the change.
