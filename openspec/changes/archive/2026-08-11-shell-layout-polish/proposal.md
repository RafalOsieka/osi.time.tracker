## Why

The authenticated shell still treats the top bar as a utility chrome (avatar menu, centered capped-width timer) even though locale/theme already moved to Settings. Users need a denser working top bar for the live timer and a clearer desktop icon-only rail, with account/logout living in the full-height sidebar footer instead of competing with the timer.

## What Changes

- **Remove** the top-bar `AppUtilityMenu` (and the utility-menu region) completely.
- **Add** a sidebar footer **account control**: expanded rail/mobile drawer shows `UUser` (avatar initial + display name or email fallback, secondary email when a distinct display name exists) as a button that opens a dropdown with logout; desktop icon-only rail shows the **avatar** as the same menu trigger (not a bare logout icon). Logout is a menu item (i18n label + icon), not a always-visible second footer row.
- **Expose** desktop rail collapse in the navbar left (`UDashboardSidebarCollapse`); keep mobile drawer open via the existing navbar toggle (`UDashboardSidebarToggle`). One control visible per breakpoint.
- **Re-layout** the top-bar timer to full remaining navbar width, left-aligned: title autocomplete grows; elapsed time and start/stop sit on the right of the timer row. Empty navbar right slot. Elapsed is always a consistent `UButton` (disabled when idle; opens start editor only when running).
- **Replace** labelled Start/Stop with icon-only **ghost** controls (`play` / `square`), with i18n `aria-label`s; running stop uses a **leading-icon color pulse** (not full-button opacity pulse or background halo), respecting reduced motion.
- **Enable** label tooltips on icon-only primary nav via `UNavigationMenu`. Collapsed brand shows short mark `OSI` until an app icon exists.

## Non-goals

- First/last-name profile fields or editing display name.
- Putting locale/theme back into shell chrome.
- Drag-to-resize sidebar handle.
- Extra tooltip on the navbar collapse control.
- Separate always-visible logout row under the user block (rejected for layout cohesion).

## Capabilities

### New Capabilities

- _(none)_

### Modified Capabilities

- `frontend-shell`: Relocate logout/identity to sidebar account menu; drop utility menu; full-width timer chrome with icon-only start/stop and running icon affordance; desktop collapse control in navbar; collapsed-rail nav tooltips; collapsed brand short mark.
- `frontend-pages`: Align authenticated-layout logout reachability with the sidebar account menu (no top-bar utility menu).

## Impact

- **UI:** `app/layouts/default.vue`, `AppTimer.vue`, `AppSidebar.vue`, `AppUserFooter.vue`; delete `AppUtilityMenu.vue`; timer stop icon keyframes in `app/assets/css/main.css`.
- **i18n:** `layout.logoutButton`, `layout.brandShort`; retire `utilityMenu.*`.
- **Tests:** shell/footer/timer nuxt + e2e open account trigger then Log out menuitem; timer asserts `aria-pressed` / icons not Start/Stop text.
- **Specs:** Deltas against `frontend-shell` and `frontend-pages`. No API, schema, or session shape changes.
