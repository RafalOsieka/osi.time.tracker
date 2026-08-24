## Why

Several timer and remote-sync controls use the native HTML `title` attribute as a hover hint. Existing requirements already ask for a tooltip on pointer hover **and** keyboard focus (remote-issue linking, truncated group/entry names). Native `title` is hover-only, delayed, unstyled, and is not an accessible name. Icon-only actions (row edit/delete, day nav, group expand/play) have `aria-label` but no visual hint. This is in-scope MVP accessibility (WBS 8.5), not a new product feature.

## What Changes

- Stop using the HTML `title` attribute as a UI hint.
- Use Nuxt UI `UTooltip` when a hint is actually needed: icon-only or status-only controls, truncated overflow, or extra explanation (sync summary chips already do this).
- Keep `aria-label` (or a visible label) as the accessible name; a tooltip is not a substitute.
- Do not show a tooltip that only repeats already-visible text (labeled buttons, expanded nav).
- For disabled controls that need an explanation, wrap a focusable host so the tooltip still works on hover and focus.
- Leave component `title` props alone (modals, page headers, confirm copy).

## Non-goals

- Restyling or globally retuning tooltip delay/theme beyond what `UApp` already provides.
- Putting interactive content (linked-issue Edit/Unlink) inside a tooltip; those stay popover/dropdown.
- Tooltips on labeled buttons, expanded sidebar items, or text that already fits its slot.
- Replacing `aria-label` with tooltips.
- Backend, API, schema, or i18n catalog redesign (reuse existing strings).

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `accessibility`: add a project-wide hover/focus hint rule (`UTooltip`, not HTML `title`; when to show; icon-only; disabled wrapper).
- `shared-ui-components`: icon-only row actions expose the same name as a tooltip; truncated overflow continues to use the shared overflow tooltip.

## Impact

Frontend-only. Touch `RemoteIssuePicker`, `TimerTaskGroup`, `TimerEntryRow`, `RowActions`, `SyncRowDetail`, `SyncDayHeader`, and any other icon-only control still missing a visual hint. Tests that assert HTML `title` move to `UTooltip`. No API, schema, or dependency changes.
