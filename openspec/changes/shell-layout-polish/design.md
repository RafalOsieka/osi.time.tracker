## Context

See `proposal.md` for motivation. The authenticated shell is already built on Nuxt UI dashboard primitives (`UDashboardGroup` + full-height `UDashboardSidebar` + panel `UDashboardNavbar`). Collapse state is cookie-persisted and `AppSidebar` already supports a collapsed icon rail, but there is no desktop collapse control in the UI. Logout/identity live in `AppUtilityMenu` on the navbar right. The timer widget is centered with a capped width and labelled Start/Stop.

Session user shape is `email` + optional `displayName` (no first/last name). Locale and theme already live on Settings only.

## Goals / Non-Goals

**Goals:**

- Move identity + logout into the sidebar footer with density-aware chrome (expanded details vs icon-only logout).
- Free the top bar for a full-width timer row with icon-only start/stop and a stronger running affordance.
- Make desktop icon-only rail reachable from the navbar and usable via label tooltips.
- Keep mobile off-canvas drawer behavior.

**Non-Goals:**

- Profile editing, avatar uploads, or name field splits.
- Resizable drag handle, keyboard shortcut for collapse (unless free from Nuxt UI).
- Tooltip on the navbar collapse control.
- Cross-spec cleanup of every historical “utility menu” phrase outside behavior that still mentions opening that menu (those can be tightened when those specs next change).

## Decisions

### D1: Sidebar footer owns identity and logout; delete `AppUtilityMenu`

Introduce a small footer component (e.g. `AppUserFooter`) in `UDashboardSidebar` `#footer`, driven by `{ collapsed }` from the slot (mobile drawer always receives `collapsed: false`).

| Rail state | Footer UI |
|------------|-----------|
| Expanded / mobile drawer | Primary line: `displayName?.trim() \|\| email`; secondary muted email only when a non-empty display name is shown; labelled logout button |
| Desktop collapsed | Logout **icon only** (`i-lucide-log-out`), `aria-label` + `UTooltip` with the logout string — **no** avatar, **no** dropdown |

**Alternative considered:** Collapsed avatar opening `UDropdownMenu` with logout. Rejected — extra click and component for a single action; user chose icon-only logout.

Preserve a stable test hook for logout (`data-testid="logout-button"` on the control in both densities).

### D2: Navbar left = mobile open + desktop collapse (two components)

Nuxt UI splits the behaviors:

- `UDashboardSidebarToggle` — `lg:hidden`, opens mobile drawer (already injected by `UDashboardNavbar` when `toggle` is enabled).
- `UDashboardSidebarCollapse` — `hidden lg:flex`, toggles `collapsed` on the collapsible sidebar.

Place collapse in the navbar `#left` slot so it sits next to the auto toggle; only one is visible per breakpoint. Keep existing cookie/storage wiring on `UDashboardGroup` / `v-model:collapsed`.

**Alternative considered:** Custom single button switching behavior by breakpoint. Rejected — duplicates Nuxt UI dashboard context and a11y labels already provided by the two components.

### D3: Timer row fills the navbar; icon-only play/square; running pulse

- Remove `max-w-3xl` / centering; timer region uses the navbar center slot as `flex-1` full remaining width, content left-aligned after the left control cluster.
- `AppTimer` layout: title `UInputMenu` `flex-1` → elapsed → square icon toggle on the right.
- Icons: idle `i-lucide-play` (`primary`); running `i-lucide-square` (`error`) with pulse/ring styling while running.
- Labels via i18n `aria-label` from existing `timer.start` / `timer.stop` (no visible text).
- Prefer Tailwind utilities; gate animation with `motion-safe:` (or equivalent) so `prefers-reduced-motion` users keep a static ring/color only.

**Alternative considered:** Keep labelled Start/Stop. Rejected — wastes horizontal space needed for the title field.

Empty navbar `#right` (no utility menu).

### D4: Collapsed nav tooltips via `UNavigationMenu`

When vertical + collapsed, enable the menu’s built-in `tooltip` so each item shows its `label` (i18n nav strings) on the right. No custom tooltip layer for nav. Footer logout gets an explicit `UTooltip` only when collapsed.

**Alternative considered:** Rely on `title` attributes only. Rejected — weaker UX and not the Nuxt UI pattern for icon rails.

### D5: Spec impact concentrated on `frontend-shell`

Behavioral contract changes land in `frontend-shell` (regions, timer chrome, collapse control placement, footer user area, tooltips). `frontend-pages` REQ-061 still requires a reachable `logout-button` on the default layout; adjust wording so it is not tied to a top-bar header. Historical requirement/scenario titles that mention “utility menu” or “centered” timer may remain for OpenSpec MODIFIED continuity while the normative text describes the new layout.

## Risks / Trade-offs

- **[Risk] E2E/timer tests assert Start/Stop text** → Mitigate by switching assertions to `aria-label` / `aria-pressed` and stable `data-testid`s.
- **[Risk] Logout path in e2e opens utility menu first** → Mitigate by clicking the footer logout control directly (expanded desktop/mobile); for collapsed desktop, the icon is the control (no menu open step).
- **[Risk] Identity invisible when rail is collapsed** → Accepted for personal single-user product; expand rail to read name/email.
- **[Risk] Residual specs (i18n/theming) still say “utility menu” for “controls not there”** → Behavior remains true (those controls stay on Settings); no functional gap. Optional wording cleanup later.

## Migration Plan

- Pure front-end layout change; no DB or API migration.
- Deploy with normal app release; cookie key `osi-dashboard` for collapse state can remain.
- Rollback: revert UI commit; no data repair needed.

## Open Questions

None material — product choices locked in exploration (footer densities, play/square, navbar collapse, full-width timer, running pulse, no collapsed avatar/menu).
