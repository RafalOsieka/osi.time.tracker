## Why

The timer view still sizes group and entry titles (and project labels) to the full string via `ch`-width readonly inputs. Long names overflow the header, swapping display to an editor jumps the layout, and the compact inline `TimeInput` clips `HH:mm`. After the 30-day feed rewrite this is the daily working surface on tablet and rail-open laptops (~750px content). In scope of WBS 2.10; explicitly deferred by `2026-08-12-timer-view-feed-windowing`.

## What Changes

- Truncate long task, project, and entry titles; expose the full string in a tooltip on hover/focus **only when the text overflows** the slot.
- Two-line group header below the existing shell `lg` breakpoint; one truncated row at `lg` and above. Group and entry chrome uses compact `xs` controls so rows stay short.
- Replace the visible "N entries" / "N wpisów" phrase with a numeric `UBadge` immediately left of the title (`1`–`9` or `9+`); keep the localized phrase as the accessible name.
- Remote-issue chrome is always present: linked `#id` (click opens the remote URL; hover/focus reveals an Edit dropdown that opens the picker); unlinked eligible groups show a compact `link-2-off` icon that opens the picker; groups that cannot resolve a tracker show the same icon disabled. The icon slot and a one-digit `#n` share a reserved width. Unlinked tooltip/accessible name is a full sentence about the task, not a parenthetical phrase.
- Project context is a slot-owned `UButton` that opens a non-modal popover listbox on one click (no `USelect` overlay). Untitled groups show the same title/project/continue chrome as named groups; project assign is disabled until a title exists. The group-level bulk-assign button is removed.
- A live group does not show a separate “Running” / “W toku” phrase. It uses the same animated stop control as the shell widget; activating it stops the running entry. Idle groups keep Continue.
- Slot-owned widths: display and editor occupy the same box; typing does not resize the layout. Compact start/stop `TimeInput` is an outlined `HH:mm` field in that reserved slot (time-only; still pinned to the entry's local day).
- Group, entry, and day-heading totals use the top-bar duration typography (`font-mono`, `tabular-nums`, same size). Totals stay non-activating.

## Non-goals

- Phone / PWA layout (WBS 8.1 / 8.9).
- Changing an entry's **date**, overnight ranges, or a date+time popover (follow-up; the row still cannot implement REQ-150's cross-midnight regroup).
- Extracting a `TimerDaySection`; today-highlight; semantic day-heading copy beyond duration typography.
- Default-expanded groups; hiding duplicate entry titles.
- Removing the bulk-assign **API**; only the group-header button is dropped.
- API, grouping, or feed-windowing changes.

## Capabilities

### New Capabilities

- _(none)_

### Modified Capabilities

- `time-tracking`: timer group/row presentation — truncate + tooltip, two-line header below `lg`, numeric entry-count badge, stable editor slots, fully visible inline times, duration chrome matching the top-bar timer, live stop on the group action, untitled groups use the same chrome as named groups.
- `remote-issue-linking`: REQ-107 compact control — linked `#id` + hover Edit dropdown, unlinked icon (not visible phrase), disabled icon when no tracker, day-scoped picker unchanged.
- `shared-ui-components`: REQ-178 drops content-sized `ch` widths in favor of a stable slot; title stays `UInput` none/ghost; project is a slot-owned button + popover listbox; compact TimeInput is an outlined field that shows a full `HH:mm`.

## Impact

- Frontend: `TimerTaskGroup.vue`, `TimerEntryRow.vue`, `TimeInput.vue`, `RemoteIssuePicker.vue`, `OverflowTooltip.vue`, `AppTimer.vue` (stop-icon motion), `index.vue` (day total, live stop, no group bulk-assign button).
- i18n `en`/`pl`: untitled/project-requires-title copy; unlinked tooltip is a sentence; existing count phrases reused as badge accessible names.
- Tests: nuxt `timer-task-group`, `timer-entry-row`, `remote-issue-picker`, `shared-ui-components` TimeInput; e2e `timer-view-ui` (badge, unlinked icon, inline title assign).
- No backend or API changes.
