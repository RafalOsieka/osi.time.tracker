## Why

The authenticated shell still treats the top bar as a utility chrome (avatar menu, centered capped-width timer) even though locale/theme already moved to Settings. Users need a denser working top bar for the live timer and a clearer desktop icon-only rail, with account/logout living in the full-height sidebar footer instead of competing with the timer.

## What Changes

- **Remove** the top-bar `AppUtilityMenu` (and the utility-menu region) completely.
- **Add** a sidebar footer user area: expanded rail/mobile drawer shows display name (or email fallback) with email underneath when a distinct display name exists, plus a labelled logout control; desktop icon-only rail shows a logout icon only (no avatar, no dropdown).
- **Expose** desktop rail collapse in the navbar left (`UDashboardSidebarCollapse`); keep mobile drawer open via the existing navbar toggle (`UDashboardSidebarToggle`). One control visible per breakpoint.
- **Re-layout** the top-bar timer to full remaining navbar width, left-aligned: title autocomplete grows; elapsed time and start/stop sit on the right of the timer row. Empty navbar right slot.
- **Replace** labelled Start/Stop with icon-only controls (`play` / `square`), with i18n `aria-label`s; running stop gets stronger pulse/ring affordance (respect reduced motion).
- **Enable** label tooltips on icon-only sidebar nav (and the collapsed logout icon). Touch-only mobile continues to use the full drawer with visible labels.

## Non-goals

- First/last-name profile fields or editing display name.
- Putting locale/theme back into shell chrome.
- Drag-to-resize sidebar handle.
- Extra tooltip on the navbar collapse control.
- Avatar in the collapsed footer.

## Capabilities

### New Capabilities

- _(none)_

### Modified Capabilities

- `frontend-shell`: Relocate logout/identity to sidebar footer; drop utility menu; full-width timer chrome with icon-only start/stop and running affordance; desktop collapse control in navbar; collapsed-rail tooltips.
- `frontend-pages`: Align authenticated-layout logout reachability with the sidebar footer (no top-bar header utility menu).

## Impact

- **UI:** `app/layouts/default.vue`, `AppTimer.vue`, `AppSidebar.vue`; delete `AppUtilityMenu.vue`; new sidebar footer component (e.g. `AppUserFooter.vue`).
- **i18n:** Keep logout/start/stop strings for labels/`aria-label`/tooltips; retire unused `utilityMenu.*` keys if nothing else references them.
- **Tests:** `test/nuxt/shell.spec.ts`, `test/nuxt/AppTimer.spec.ts`, `test/nuxt/page-render.spec.ts`, `test/e2e/shell.spec.ts`, `test/e2e/auth-ui.spec.ts`, timer e2e that assert Start/Stop button text.
- **Specs:** Deltas against `frontend-shell` and `frontend-pages`. No API, schema, or session shape changes.
