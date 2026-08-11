## Context

See `proposal.md` for motivation. The authenticated shell is already built on Nuxt UI dashboard primitives (`UDashboardGroup` + full-height `UDashboardSidebar` + panel `UDashboardNavbar`). Collapse state is cookie-persisted and `AppSidebar` already supports a collapsed icon rail.

Session user shape is `email` + optional `displayName` (no first/last name). Locale and theme already live on Settings only.

## Goals / Non-Goals

**Goals:**

- Move identity + logout into the sidebar footer as a **single account control** (dropdown), not competing with the timer.
- Free the top bar for a full-width timer row with icon-only start/stop and a stronger running affordance on the **icon**.
- Make desktop icon-only rail reachable from the navbar and usable via nav label tooltips.
- Keep mobile off-canvas drawer behavior (footer always expanded density there).

**Non-Goals:**

- Profile editing, avatar uploads, or name field splits.
- Resizable drag handle.
- Tooltip on the navbar collapse control.
- Cross-spec cleanup of every historical “utility menu” phrase in unrelated main specs (optional later).

## Decisions

### D1: Sidebar footer is an account menu (`UUser` / avatar → logout)

**Choice (final):** `AppUserFooter` mounts `UDropdownMenu` opening **upward** from the footer.

| Rail state | Trigger | Menu |
|------------|---------|------|
| Expanded / mobile drawer | `UUser` as `button` — avatar initial + name (or email fallback) + optional secondary email | Logout item (`layout.logoutButton`, `i-lucide-log-out`, error) |
| Desktop collapsed | Square ghost `UButton` with the same avatar initial | Same logout item |

Identity rules: primary = `displayName?.trim() || email`; secondary email only when a non-empty display name is shown.

**Why not a separate logout row under `UUser`:** Two chrome styles (identity card + nav-style logout) looked incoherent.

**Why not collapsed logout-icon-only (earlier plan):** Product chose account-menu consistency; avatar keeps identity affordance when the rail is icon-only.

**Why not bare `UTooltip` on a logout icon:** Logout lives in the menu; primary nav already uses `UNavigationMenu` tooltips for destinations.

Test hooks: `data-testid="app-user-footer"`, `app-user-footer-trigger`, identity primary/email testids when expanded. Logout activation in e2e is **open trigger → `getByRole('menuitem', { name: /log out/i })`** (no permanent `logout-button` node in the closed menu).

**Alternatives considered:** Always-visible labelled logout under identity; collapsed icon-only logout with `UTooltip`. Rejected after UI review.

### D2: Navbar left = mobile open + desktop collapse (two components)

- `UDashboardSidebarToggle` — `lg:hidden`, mobile drawer (navbar `toggle`).
- `UDashboardSidebarCollapse` — `hidden lg:flex`, in navbar `#left`.

Cookie persistence via `UDashboardGroup` / `v-model:collapsed` unchanged.

### D3: Timer row fills the navbar; ghost play/square; icon-only running pulse

- Full remaining width after left controls; no centered `max-w-3xl`.
- Title `flex-1` → elapsed → toggle on the right.
- Elapsed always `UButton` `variant="link"` `font-mono` (disabled when idle; popover only when running).
- Toggle: ghost; idle `play` + primary; running `square` + error; `aria-label` / `aria-pressed`.
- Running affordance: **`ui.leadingIcon`** animation `animate-timer-stop-icon` (error color breathe). No full-button `animate-pulse`, no background halo. `motion-reduce:animate-none`.

Empty navbar `#right`.

### D4: Collapsed nav tooltips via `UNavigationMenu`

`:tooltip="isCollapsed"` on vertical menu — built-in right-side tooltips for destination labels. Footer does **not** duplicate that pattern for logout (menu labels instead).

### D5: Collapsed brand mark

Until an app icon exists, sidebar header shows i18n `layout.brandShort` (`OSI`) centered when collapsed; full `layout.title` when expanded.

### D6: Spec impact

Behavioral contract in `frontend-shell` + logout reachability in `frontend-pages` REQ-061. Historical scenario titles that still say “utility menu” or “centered timer” may remain for OpenSpec MODIFIED continuity while normative text describes the new layout.

## Risks / Trade-offs

- **[Risk] Logout is one extra click** → Accepted for a single cohesive account control; menu can grow later.
- **[Risk] E2E must open the account menu first** → Mitigated: shell/auth-ui click `app-user-footer-trigger` then Log out menuitem.
- **[Risk] Residual main-spec “utility menu” wording elsewhere** → Locale/theme still not in shell chrome; optional cleanup later.

## Migration Plan

- Pure front-end; no DB/API migration.
- Cookie key `osi-dashboard` retained.
- Rollback: revert UI commit.

## Open Questions

None — account-menu footer, ghost timer toggle, and icon color pulse are locked to the shipped implementation.
