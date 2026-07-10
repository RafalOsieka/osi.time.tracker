## Why

Daily use of the timer view surfaced several UX defects: the top-bar start-time popover reverts values typed from the keyboard, group editing forces a dialog round-trip, stopping the timer from the top bar makes the just-stopped entry vanish from the view, and two already-applied local fixes (client-only rendering to avoid hydration mismatch, refreshing running state after task edits) are not captured in the specs.

## What Changes

- Introduce a shared smart `TimeInput` component (text-based, `HH:mm` model) with a forgiving parser (`9`→`09:00`, `23`→`23:00`, `93`→`09:30`, `900`→`09:00`, `1234`→`12:34`, `123:`→`01:23`, `9:5`→`09:05`; invalid input silently reverts). It replaces the PrimeVue `DatePicker time-only` in the top-bar start popover, the native `<input type="time">` in inline entry rows, and the `InputText type="time"` fields in the manual-entry dialog.
- Make the date field in the top-bar start popover commit a manually typed valid date (`yyyy-mm-dd`, tolerant of unpadded parts) on blur/Enter instead of reverting; the calendar picker stays.
- Replace the mini task editor dialog with inline group editing: in-place title edit (blur/Enter commit, Escape cancel, empty name silently reverts) and an in-place project select with a clickable "(no project)" placeholder when none is assigned. **BREAKING**: `TimerTaskEditorDialog` and the group "edit" button are removed.
- Refresh the timer view entry list when the running timer transitions to stopped (top-bar stop), so the finished entry appears immediately.
- Document already-implemented behavior: timer view day/group list renders client-side only (browser-local day grouping precludes SSR parity), and editing a task (rename/reassign/bulk-assign) refreshes the running-timer indicator state.

## Non-goals

- No changes to server API contracts (`/api/time-entries`, `/api/tasks`) — all changes are client-side.
- No new `DateInput` component; the date picker remains PrimeVue `DatePicker` with a typed-input fix only.
- No changes to entry-row semantics: an empty inline entry title still means `title: null` (detach from task).
- No mobile-specific time pickers.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `time-tracking`: REQ-NFR-026 (popover time/date typed-input commit; running state refresh after task edits), REQ-TTR-046 (client-only rendering, smart time input in rows and manual dialog, list refresh on top-bar stop), REQ-TTR-049 (inline group editing replaces the dialog, "(no project)" placeholder, empty-name silent revert), REQ-NFR-028 (accessibility of the new inline controls).
- `shared-ui-components`: new shared smart time input requirement (parser rules, commit/cancel contract).

## Impact

- `app/components/AppTimer.vue` (popover fields), `TimerEntryRow.vue`, `TimerAddEntryDialog.vue`, `TimerTaskGroup.vue` (inline editing), removal of `TimerTaskEditorDialog.vue`, `app/pages/index.vue` (stop-transition refresh, dialog wiring removal).
- New `app/components/TimeInput.vue` + pure parser util in `app/utils/` (unit-testable).
- i18n catalogs `en`/`pl` (placeholder, labels); Vitest unit + nuxt tests updated.
