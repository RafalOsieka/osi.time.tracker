## Why

The live timer (`time-tracking` capability) shipped, but manual verification surfaced four UI defects in the shell timer widget (`AppTimer.vue`):

1. After starting a timer, the typed title disappears and only the placeholder shows — the input is bound to a local ref that is cleared on start, never to the running entry.
2. After a page reload the running title is likewise missing — the input reads the empty local ref instead of `running.taskName`.
3. On reload there is a sub-second window where the running-entry query is still in flight, during which the autocomplete and Start button are interactive against a stale "idle" state, letting the user act on the wrong state.
4. Pressing Enter with the suggestion overlay closed does nothing; it should start the timer (Enter while the overlay is open must keep its select/close behavior).

The data needed for (1) and (2) already returns from the server as `running.taskName`; the widget simply never reads it. The retitle path (`PATCH /api/time-entries/[id]`, REQ-TTR-039) already re-resolves a title to a task server-side, so making the running title editable is a client-side wiring change with no backend work.

## What Changes

- Bind the timer input's displayed value to the running entry's title (`running.taskName`) while a timer is running, instead of the decoupled local ref. When the running entry is untitled, the input shows **blank** — no placeholder and no "(no task)" text.
- Make the running title **editable in place**: edits are committed via `PATCH /api/time-entries/[id]` on **blur or Enter** (not per keystroke). Committing a **blank** title detaches the task (`title = null`, `taskId` becomes `null`).
- Add a `loading` state to `useTimer` that is true while the initial running-entry fetch is in flight; disable the timer input and toggle button until it resolves, then reflect the server result (Option A — simple loading gate; no client-side offline cache).
- Handle Enter on the timer input: when the suggestion overlay is closed, Enter starts the timer; when the overlay is open, Enter keeps PrimeVue's default select/close behavior.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `time-tracking`: Refine the persistent running-timer indicator's UI behavior — bind the input to the running title, show blank for untitled running entries, gate the widget on the running-entry fetch, allow inline retitle committed on blur/Enter (blank detaches the task), and start the timer on Enter when no suggestion overlay is open.

## Impact

- **UI**: `app/components/AppTimer.vue` (input binding, inline edit, Enter handling, disabled-while-loading), `app/composables/useTimer.ts` (add `loading` state; add an `updateTitle` action wrapping the existing PATCH).
- **API**: none — reuses `POST /api/time-entries`, `PATCH /api/time-entries/[id]`, `GET /api/time-entries/running`.
- **i18n**: no new user-facing text expected (blank untitled, no new labels); add keys only if an edit affordance needs one, in `en`/`pl` parity.
- **Tests**: `test/nuxt` (widget: title shown while running, blank when untitled, disabled while loading, Enter-to-start, inline edit commit on blur/Enter, blank edit detaches), plus existing `test/e2e` retitle coverage.

## Non-goals

- No client-side offline/cached running state (Option B) and no SSR-of-running-entry (Option C) — only the simple loading gate.
- No debounced/live per-keystroke autosave of the title — commit is on blur/Enter only.
- No changes to the server contract, schema, or task-resolution rules.
