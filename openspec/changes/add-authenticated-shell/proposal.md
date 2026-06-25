## Why

Today `app/layouts/default.vue` is a thin placeholder: a title, an empty `<nav>` "reserved for future nav items and the running-timer indicator", and a logout button using ad-hoc inline styles. As domain features land (Clients → Projects → Tasks, Reports, Settings) the authenticated surface needs a real navigation shell. Defining the shell contract now — before feature pages multiply — keeps navigation, the persistent running-timer region, and responsive behavior consistent and cheap to evolve.

## What Changes

- Introduce a **global authenticated shell**: a top bar plus a collapsible left sidebar wrapping `<NuxtPage />`, replacing the placeholder header in `default.vue`.
- **Sidebar navigation** lists the full v1 destination skeleton (Dashboard, Clients, Projects, Tasks, Reports, Settings); destinations without real pages route to placeholder pages.
- **Desktop (≥ lg)**: collapsible rail (full ⇄ icon-only) toggled by `☰`, with the collapsed/expanded choice persisted.
- **Tablet/narrow (< lg)**: sidebar becomes an off-canvas drawer (scrim, focus-trap, `Esc` to close).
- **Very small (< a configurable threshold)**: top bar holds only brand + utility menu; the **reserved timer region** drops to its own full-width row, with page content stacked below.
- **Top bar** reserves a region for the running-timer widget (contents out of scope) and collapses locale / theme / user controls into a single utility menu at every tier.
- Replace the inline styles in `default.vue` with PrimeVue theme tokens (WBS 7.6 authenticated-shell rollout).

## Capabilities

### New Capabilities
- `frontend-shell`: the authenticated app shell — top bar + collapsible sidebar regions and slots (brand, nav, reserved timer region, utility menu, page content), the three-tier responsive behavior, a persisted desktop rail state, a configurable timer-stack breakpoint, i18n nav/control labels, and a11y (nav landmark, `aria-current`, `aria-expanded`, drawer focus-trap).

### Modified Capabilities
<!-- None: frontend-pages' REQ-AUTH-008 default-layout requirements are unchanged; this adds the shell as a new capability. -->

## Impact

- **Code**: `app/layouts/default.vue` (rebuilt shell), new shell/nav components and a rail-state composable, placeholder pages under `app/pages/`, i18n catalogs (`en`/`pl`), `nuxt.config.ts` (configurable breakpoint), `docs/wbs.md` 7.6 status.
- **Tests**: `test/nuxt/` (responsive tiers, rail toggle/persistence, drawer a11y, nav `aria-current`), `test/unit/` (breakpoint/rail logic), i18n parity.
- **Backend/APIs**: none.

## Non-goals

- The **timer widget** itself and **quick-start** behavior (only the region is reserved — separate proposals).
- Real **feature pages** (Clients/Projects/Tasks/Reports/Settings) beyond placeholders.
- Restyling beyond replacing `default.vue` inline styles with tokens.
