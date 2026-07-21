## Context

The app currently renders its UI with PrimeVue 4 (Aura theme, `@primevue/forms`, PrimeIcons) on Nuxt 4. Styling is BEM-scoped CSS referencing Aura `--p-*` tokens; the authenticated shell (`app/layouts/default.vue`) hand-builds a top bar, a collapsible desktop rail with SSR-safe cookie state, and a below-`lg` off-canvas drawer. Forms wrap fields in a shared `FormFieldWrap` driven by a zod resolver; list pages (`clients`, `projects`, remote sync) use `DataTable`/`Column`; confirmations go through `ConfirmDialog` + `useConfirm`; a `primevue-i18n-sync` plugin keeps PrimeVue's locale aligned with `@nuxtjs/i18n`.

Nuxt UI v4 is now fully free/open-source, requires Nuxt 4 (already satisfied — `nuxt ^4.5.0`), and covers every component in use, including the previously-Pro dashboard suite. The user has decided: **big-bang swap**, **Tailwind utilities** (not BEM+tokens), **Lucide** icons, **adopt `UDashboard*`**, and **remove `FormFieldWrap`**.

## Goals / Non-Goals

**Goals:**
- Single UI dependency (`@nuxt/ui`) replacing four PrimeVue packages.
- Nuxt-native theming/color-mode via `app.config.ts` colors + `--ui-*` tokens.
- Shell rebuilt on `UDashboard*`; forms on `UForm` + `UFormField` with native zod.
- Preserve all behavior, i18n keys, and `data-testid` contracts; suite stays green.

**Non-Goals:**
- No server/API/DB changes; no new features; no redesign of information architecture.
- No incremental coexistence period (both libraries installed at once).
- No move away from `@nuxtjs/i18n` for message catalogs.

## Decisions

### D1: Big-bang swap over incremental coexistence
Migrate everything in one change. **Alternative considered:** run PrimeVue and Nuxt UI side by side, page by page. Rejected — the app is small (~8 pages), and dual UI systems mean clashing base styles (Tailwind reset vs. PrimeVue CSS), doubled bundle, and a long-lived half-migrated state. One swap is cleaner and cheaper here.

### D2: Tailwind utilities over BEM + `--ui-*` tokens
Express layout/spacing/color through Tailwind v4 utilities and component props; drop `<style scoped>` BEM blocks where a utility suffices. **Alternative considered:** keep BEM classes but re-point them at `--ui-*` tokens (closest to today's `CODING_STANDARDS.md`). Rejected per user preference — utilities are the idiomatic Nuxt UI path and remove a translation layer. `CODING_STANDARDS.md` must be updated to bless utility-first styling.

### D3: Adopt the `UDashboard*` shell wholesale
Replace the hand-built shell with `UDashboardGroup` + `UDashboardSidebar` (`collapsible`, mobile slideover built in) + `UDashboardNavbar`, navigation via `UNavigationMenu`. **Alternative considered:** keep the current shell and only swap primitives inside it. Rejected — the shell's rail-collapse, cookie persistence, and drawer/focus-trap logic is exactly what `UDashboard*` provides for free; keeping it forfeits the biggest "Nuxt fit" win. The reserved running-timer region is slotted into the navbar (and a full-width row at the very-small tier).

### D4: Remove `FormFieldWrap`; use `UFormField` + native zod
`UForm` validates a zod schema directly and renders per-field errors through `UFormField`, so the wrapper and the `@primevue/forms` resolver glue both disappear. **Alternative considered:** keep a thin wrapper over `UFormField`. Rejected per user preference against wrapper components. Field error `data-testid`, `aria-invalid`, and `aria-describedby` wiring is reproduced via `UFormField` props/slots.

### D5: `useOverlay()` + `ConfirmModal` for confirmations
Nuxt UI has no `ConfirmDialog` service equivalent; mount nothing globally and open a small in-house `ConfirmModal` component through `useOverlay()`, returning a promise resolved by the accept/reject buttons. **Alternative considered:** a bespoke reactive confirm composable. Rejected — `useOverlay` is the first-party pattern and handles teardown.

### D6: Drive Nuxt UI locale from `@nuxtjs/i18n`; delete the sync plugin
Nuxt UI ships `en` and `pl`; bind its `locale` to the active `@nuxtjs/i18n` locale in `app.config.ts`/`UApp`. **Alternative considered:** keep a plugin mirroring locale. Rejected — redundant; the current plugin is a TODO stub anyway.

### D7: Icons → Lucide (`i-lucide-*`)
Map every `pi pi-*` string to its Lucide equivalent. **Alternative considered:** Heroicons. Deferred — Lucide is Nuxt UI's default and adequate now.

## Risks / Trade-offs

- **Tailwind base reset changes spacing/typography app-wide** → land the dependency + `@nuxt/ui` CSS first, then fix pages screen-by-screen behind the same `data-testid`s; rely on e2e for regressions.
- **`UTable` (TanStack) is a different mental model** (column defs in script, cell slots) → treat table pages as the highest-effort items; port one page fully as the template for the rest.
- **`data-testid` placement drift** when markup changes → assert the existing ids explicitly while porting each component; keep e2e green as the gate.
- **`UForm` validation semantics differ** from the resolver (timing, error shape) → cover empty/invalid/server-error paths in nuxt specs before deleting `FormFieldWrap`.
- **i18n lint / a11y ESLint rules tuned for PrimeVue inputs** → update `eslint.config.mjs` rules for Nuxt UI component output.
- **Spec drift**: many specs mention PrimeVue by name → deltas in this change retarget them; remaining prose mentions get cleaned during apply.

## Migration Plan

1. Tooling: add `@nuxt/ui`, remove PrimeVue packages, register the module, wire Tailwind v4, adjust `optimizeDeps`, ESLint, and the MCP/docs config.
2. Theme: define brand color + color-mode in `app.config.ts`; wrap the app in `UApp`; remove Aura config and `--p-*` styles.
3. Shared components: port forms to `UForm`/`UFormField` (delete `FormFieldWrap`), tables to `UTable`, confirm to `useOverlay`+`ConfirmModal`, time input to `UInput`.
4. Shell: rebuild `default.vue` on `UDashboard*`; delete rail/drawer logic and the i18n-sync plugin.
5. Pages: migrate `login`, `settings`, list pages, timer view, remote sync.
6. Tests/docs: update `test/nuxt/*` stubs/selectors, keep e2e green, update `AGENTS.md`/`CODING_STANDARDS.md`.

**Rollback:** the change is a single logical swap; revert the branch. No data/schema migration is involved, so rollback is code-only.

## Open Questions

- Exact Lucide mapping for a few PrimeIcons without a 1:1 match (pick nearest during apply).
- Whether the very-small "timer on its own full-width row" tier is expressed via `UDashboardNavbar` slots or a custom breakpoint wrapper.
- Whether any residual `<style scoped>` is still warranted for the timer widget, or fully utility-driven.
