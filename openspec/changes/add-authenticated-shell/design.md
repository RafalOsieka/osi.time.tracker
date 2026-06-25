## Context

The authenticated surface currently renders through `app/layouts/default.vue`, a placeholder header (title + empty reserved `<nav>` + logout) styled with inline CSS. The product roadmap (`docs/vision.md` §3, `docs/wbs.md` §2.9/§3/§4/§7) requires navigation across a Client → Project → Task hierarchy plus Reports and Settings, and a **persistent running-timer indicator** (WBS 2.9, 🔴 MVP) visible on every authenticated route. Constraints: PrimeVue 4 (Aura, no Tailwind) is the UI library, WCAG 2.1 AA is enforced (`openspec/specs/accessibility/spec.md`), all strings live in i18n catalogs with `en`/`pl` parity, and theming uses PrimeVue tokens (WBS 7.6 — the authenticated-shell rollout is the remaining piece).

This change defines the **shell contract only**: regions, slots, responsive behavior, and a11y. The timer widget and quick-start are separate proposals; feature pages are placeholders.

## Goals / Non-Goals

**Goals:**

- A reusable authenticated shell with two regions (top bar + sidebar) wrapping `<NuxtPage />`.
- Three responsive tiers: desktop collapsible rail, tablet/narrow off-canvas drawer, very-small stacked layout with a full-width timer row.
- A persisted desktop rail state (full ⇄ icon-only) and a configurable "timer-stacks-below" breakpoint distinct from the `lg` rail→drawer threshold.
- Sidebar listing the full v1 destination skeleton with placeholder pages for unbuilt routes.
- Token-based styling (remove inline styles), full i18n labels, and WCAG 2.1 AA behaviors.

**Non-Goals:**

- The timer widget contents and quick-start behavior (region reserved only).
- Real CRUD/feature pages beyond placeholders.
- A broader design-system / component restyle.

## Decisions

### D1 — Single shell in `default.vue` vs. a dedicated `AppShell` component
Compose the shell from small components (`AppTopBar`, `AppSidebar`, `AppUtilityMenu`) mounted by `default.vue`, rather than inlining everything in the layout. **Rationale:** keeps the layout thin and components unit/component-testable. *Alternative considered:* all markup inline in `default.vue` — simpler initially but hard to test responsive states and grows unwieldy.

### D2 — Sidebar: PrimeVue `Drawer` (modal) on small screens, static rail on desktop
Use PrimeVue `Drawer` for the off-canvas mobile experience (built-in scrim, focus-trap, `Esc`-to-close → satisfies a11y) and a static rail container on desktop driven by the same nav model (a `PanelMenu`/list). **Rationale:** reuses PrimeVue's accessible overlay instead of hand-rolling a focus trap. *Alternative:* one always-present element toggled via CSS — risks leaking focus into a hidden drawer and reimplementing trap logic.

### D3 — Rail state persistence via a cookie-backed composable
A `useShellState` composable stores the desktop full/icon-only choice. Use a cookie (`useCookie`) so the choice is SSR-safe and restored without a flash, mirroring the existing color-mode pattern from `add-ui-theming`. **Rationale:** consistency with the established no-flash SSR approach. *Alternative:* `localStorage` — client-only, causes a layout flash on first paint.

### D4 — Breakpoints
`lg` (PrimeVue's standard breakpoint) governs rail → drawer. A **separate configurable token** governs timer-stacks-below; expose it as a single source of truth (CSS custom property / runtime config default) so it is tunable without a spec change. **Rationale:** the user requires the very-small behavior to be configurable and independent. *Alternative:* one hard-coded breakpoint for both — couples two unrelated layout concerns.

### D5 — Reserved timer region is a named slot
The top bar exposes a reserved timer slot/region with guaranteed placement (inline at ≥ very-small; full-width own row below it). This change renders only a placeholder/empty region; the timer proposal fills it. **Rationale:** lets the shell ship before the timer exists.

## Risks / Trade-offs

- [Two regions competing for one row on mid widths get cramped] → the utility cluster collapses into a single menu at all tiers, freeing horizontal space.
- [Placeholder routes could look broken] → ship minimal, clearly-labeled placeholder pages so nav is fully navigable.
- [Cookie-based rail state adds SSR surface] → reuse the proven color-mode cookie pattern and keep the value to a small enum.
- [Configurable breakpoint drift from PrimeVue's `lg`] → document the default and keep both thresholds named in one place.

## Open Questions

- Default value for the configurable timer-stack breakpoint (a sensible default ships; tunable later).
- Whether icon-only rail needs tooltips on by default (likely yes for a11y/discoverability) — to confirm during implementation.
