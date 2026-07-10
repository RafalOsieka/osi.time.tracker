## Context

Daily use of the timer view revealed UX friction and one data-freshness bug:

- The top-bar start-edit popover (`app/components/AppTimer.vue`) uses PrimeVue `DatePicker` for both date and `time-only` time; both revert manually typed text on blur unless it matches the exact format, so keyboard entry is effectively broken.
- Inline entry rows (`TimerEntryRow.vue`) use native `<input type="time">` and the manual-entry dialog (`TimerAddEntryDialog.vue`) uses `InputText type="time"`; typing shortcuts like `900` for `09:00` is impossible.
- Group (task) editing goes through `TimerTaskEditorDialog.vue`, a modal round-trip, while individual entries already support in-place editing.
- Stopping the timer from the top bar zeroes `running` in `useTimer`, but `app/pages/index.vue` has no hook on that transition, so the just-stopped entry disappears from the view until a manual refresh (it only rendered because `displayEntries` merges `running` into the fetched list).
- Two fixes already applied locally are undocumented in specs: the day/group list renders inside `<ClientOnly>` (with `useAsyncData(..., { server: false })`) because REQ-TTR-046 groups by the browser-local day, which the server cannot reproduce; and task edits/bulk-assigns call `fetchRunning()` to keep the shell indicator fresh.

## Goals / Non-Goals

**Goals:**

- One consistent keyboard-friendly `HH:mm` input used in all three time-entry locations.
- Manually typed dates commit in the popover.
- Inline group editing (title + project) replacing the dialog, including a clickable "(no project)" placeholder.
- Timer view refreshes when the running timer stops from the top bar.
- Specs describe the already-shipped hydration and running-refresh behavior.

**Non-Goals:**

- No server/API changes; no new endpoints or DTO fields.
- No `DateInput` component; the calendar `DatePicker` stays for the date field.
- No change to entry-row title semantics (blank still means `title: null`).

## Decisions

### D1: Shared `TimeInput` — plain text input + pure parser (not `type="time"`, not `DatePicker time-only`)

A new `app/components/TimeInput.vue` with `v-model: string | null` (`HH:mm`) wrapping a text input, and a pure `normalizeTimeInput(raw: string): string | null` in `app/utils/` (unit-testable). Parser rules:

| Input | Result | Rule |
|---|---|---|
| `9` | `09:00` | 1 digit → hour |
| `23` | `23:00` | 2 digits ≤ 23 → hour |
| `93` | `09:30` | 2 digits > 23, second digit ≤ 5 → `H` + tens of minutes |
| `59` | invalid | 2 digits > 23, second digit > 5 |
| `900` | `09:00` | 3 digits → `H:mm` |
| `1234` | `12:34` | 4 digits → `HH:mm` |
| `123:` | `01:23` | trailing `:` → digits before it parsed as above |
| `9:5` | `09:05` | colon form, zero-padded |
| `25:00`, `12:66` | invalid | range validation |

Commit on blur/Enter, Escape cancels; invalid input silently reverts to the previous value (consistent with the existing inline-edit contract in REQ-TTR-046). Used in: `AppTimer.vue` popover (replacing `DatePicker time-only`), `TimerEntryRow.vue` (replacing native `type="time"`), `TimerAddEntryDialog.vue` (replacing `InputText type="time"`).

- *Alternative — keep native `type="time"` and add smart parsing only where text inputs exist*: cheaper but leaves the top-bar bug for the time field only half-solved and yields three divergent behaviors. Rejected for consistency.
- *Trade-off*: we lose the native mobile time picker; the primary use case is desktop keyboard entry, accepted.

### D2: Date field keeps `DatePicker`, gains typed-input commit

The calendar affordance is valuable for dates. Fix scope: a manually typed valid `yyyy-mm-dd` date (tolerant of unpadded month/day, e.g. `2026-7-9`) commits on blur/Enter via custom parsing on the DatePicker's input events instead of reverting; invalid text reverts as today.

- *Alternative — twin `DateInput` text component*: more consistent but more work; dates are usually picked from the calendar. Rejected as over-engineering for now.

### D3: Inline group editing replaces the dialog (dialog deleted)

`TimerTaskGroup.vue` gets the same in-place pattern as `TimerEntryRow`:

- Title: button → text input, blur/Enter commit, Escape cancels; commits via `PATCH /api/tasks/:id`. An empty/whitespace name silently reverts (a task cannot be unnamed) — deliberately different from entry rows where blank means detach.
- Project: the context label (`project · client`) becomes a button that swaps to a PrimeVue `Select` with clear support; the `extraProjectOptions` logic (retain current, possibly soft-deleted, project as an option) moves from the dialog into the group component. When no project is assigned, a "(no project)" placeholder button is rendered so the target remains clickable.
- `TimerTaskEditorDialog.vue`, the group edit button, and the page's `editingTask` wiring are removed. Merge-on-collision (REQ-TTR-049) and post-save `refreshEntries()` + `fetchRunning()` stay.
- The "(no task)" group keeps its current behavior: no title/project editing (there is no task), bulk-assign only.

- *Alternative — keep the dialog alongside inline*: safer for accessibility, but duplicates UX and code. Rejected; inline controls must instead meet REQ-NFR-028 themselves (buttons with `aria-label`, keyboard-operable Select).

### D4: Stop-transition refresh via `running` watcher

`app/pages/index.vue` watches the `running` ref from `useTimer` and calls `refreshEntries()` when it transitions to `null` (or the running id changes) from an external cause (top-bar stop, stop-on-new-start). This closes the gap without new events or global state.

- *Alternative — event bus / callback from `useTimer.stop()`*: more plumbing for the same effect; the watcher is local to the only page that needs it.

## Risks / Trade-offs

- [Parser guesses wrong for odd inputs like `59`] → invalid inputs revert silently, never mutate data; the rule table is deterministic and unit-tested.
- [Losing native mobile time picker] → acceptable for a desktop-first personal tool; can be revisited with `inputmode="numeric"`.
- [Removing the dialog degrades a11y] → inline controls are specced under REQ-NFR-028 (labelled buttons, keyboard-operable Select) and covered by nuxt tests.
- [Watcher-based refresh may double-fetch after page-initiated actions] → guard by comparing running-entry ids / skipping when the page itself already triggered a refresh.
- [DatePicker typed-date parsing fights PrimeVue internals] → scope is narrow (valid `yyyy-mm-dd` on blur/Enter); if unachievable cleanly, fall back on documenting calendar-only date editing and revisit a `DateInput`.

## Open Questions

- None blocking; interpretation rules for two-digit input were settled with the user (`23`→`23:00`, `93`→`09:30`, `59` invalid).
