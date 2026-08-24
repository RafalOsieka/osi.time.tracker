## Context

See proposal.md for motivation and the delta specs (REQ-269, REQ-270, REQ-127) for the behavior contract.

`UTooltip` is already used for overflow (`OverflowTooltip`) and Remote Sync summary chips. Native HTML `title` is still bound as a hint on `RemoteIssuePicker` (linked `#id`, unlinked icon), `TimerTaskGroup` (disabled project and disabled remote icon), and `SyncRowDetail` (truncated remote-log comments). Icon-only actions (`RowActions`, timer group toggle/play/stop, entry delete, sync day chevrons, shell timer toggle) have `aria-label` only. Nuxt UI `UButton` has no tooltip prop; the documented pattern is wrapping the trigger in `UTooltip`. `UApp` already provides the tooltip provider. Linked-issue Edit/Unlink stays a hover dropdown (REQ-107), not a tooltip.

## Goals / Non-Goals

**Goals:**
- One hint mechanism: Nuxt UI `UTooltip` on hover and keyboard focus.
- Reuse existing i18n strings; tooltip text for icon-only matches `aria-label`.
- Keep `OverflowTooltip` as the shared overflow helper (REQ-270) and point remaining truncated slots at it.
- Document the convention in `CODING_STANDARDS.md` so new UI does not reintroduce native `title`.

**Non-Goals:**
- New shared `IconButton` / `DisabledTooltip` primitives (YAGNI; two-to-few call sites).
- Changing `UApp` tooltip delay/theme.
- Turning the linked-issue hover menu into a tooltip.

## Decisions

### 1. `UTooltip` instead of native `title`

| Option | Notes |
|--------|--------|
| A. Keep native `title` | Fails keyboard focus; unstyled; already contradicts REQ-107 / REQ-265 |
| **B. Wrap triggers in `UTooltip`** | Matches existing overflow and sync-chip pattern; themed; focusable | **chosen** |
| C. New icon-button component with a built-in tip | Extra abstraction for a one-line wrap |

Remove `:title` used as a hint. Leave modal/page/confirm `title` props. Do not set HTML `title` and `UTooltip` on the same control (double tooltip).

### 2. Icon-only: same string as `aria-label`

Wrap the existing `UButton` (or equivalent) in `UTooltip :text="…"` using the same localized string as `aria-label`. No extra catalog keys.

Audit `app/` for remaining icon-only / status-only controls, including `AppTimer` start/stop. Labeled buttons and expanded nav stay without a repeating tip (`UNavigationMenu :tooltip="isCollapsed"` already follows this).

### 3. Disabled explanations wrap a focusable host

Disabled buttons swallow pointer events, so `UTooltip` on the button itself never opens.

| Option | Notes |
|--------|--------|
| A. Native `title` on the disabled button | Works in browsers; fails REQ-269 keyboard + themed tooltip |
| **B. `UTooltip` around a `tabindex="0"` span** | Same pattern as sync summary chips | **chosen** |
| C. Do not disable; intercept click | Changes affordance and focus order |

Use this for “project requires a title” and “cannot link a remote issue”. Keep `aria-label` on the button.

### 4. Overflow stays `OverflowTooltip`; comments use it too

`OverflowTooltip` already enables `UTooltip` only when `scrollWidth > clientWidth`. Point `SyncRowDetail` truncated comments at it instead of `:title`. Do not wrap every truncated slot that already uses it (group title/project, entry title).

### 5. Linked `#id`: tooltip above, dropdown below

REQ-107 requires both the cached-title tooltip and the Edit/Unlink hover dropdown. Place `UTooltip` with `content.side = 'top'` (same as overflow). The dropdown remains `top-full` under the identifier so the two overlays do not stack on the same side. Do not wrap the popover or the dropdown in the tooltip.

### 6. Tests stub `UTooltip` via `data-tooltip-text`

Existing nuxt tests already stub `UTooltip` that way (`timer-task-group`, `timer-entry-row`, `remote-sync-page`). Extend that to picker, row actions, and any new icon-only wrap. Stop asserting the HTML `title` attribute as the hint. `ButtonStub` can drop its `title` passthrough once call sites stop sending it.

## Risks / Trade-offs

- **[Risk] Tooltip and linked-issue dropdown both appear on hover** → Mitigation: opposite sides (top vs below); default Reka delay keeps the tip from racing the CSS dropdown.
- **[Risk] Extra tab stops from `tabindex="0"` wrappers on disabled controls** → Mitigation: only wrap controls that need a disabled explanation (two group-row slots), not every disabled button.
- **[Risk] Screen readers announce `aria-label` and tooltip** → Mitigation: keep tooltip text identical to the accessible name for icon-only; do not add a second `aria-describedby`.
- **[Trade-off] No shared IconTooltip component** → Duplicated wrap markup; cheaper than another primitive. Revisit only if a third cluster appears.

## Migration Plan

Frontend-only. Ship in one PR: migrate native-`title` sites, add icon-only wraps, route truncated comments through `OverflowTooltip`, update nuxt tests, add the coding-standards bullet. Rollback is revert. No schema, API, or i18n catalog migration.

## Open Questions

None. Remaining icon-only call sites are an implementation audit, not a spec or approach change.
