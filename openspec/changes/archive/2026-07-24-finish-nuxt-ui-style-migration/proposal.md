## Why

The PrimeVue → Nuxt UI migration finished the CRUD pages (`clients.vue`, `projects.vue` carry zero `<style scoped>`) but left the timer/sync surface on legacy patterns: hand-rolled BEM stylesheets on `TimerEntryRow`, `TimerTaskGroup`, `index.vue`, and `sync/[date].vue`, a ghost-`UButton`-styled-as-text inline-edit trick, and a redundant custom `#item` slot in `AppSidebar`. Finishing the migration removes convention drift and aligns the whole app with `CODING_STANDARDS.md §4` (Tailwind utilities + `--ui-*` tokens; residual scoped CSS only when utilities are insufficient).

## What Changes

- Migrate residual `<style scoped>` on `TimerEntryRow`, `TimerTaskGroup`, `index.vue`, and `sync/[date].vue` to Tailwind utilities + `--ui-*` tokens; keep only genuinely dynamic inline `:style` (the `ch`-based title/select widths).
- Replace the ghost-`UButton`-styled-as-inline-text edit triggers in the timer components with a Nuxt UI `UInput` inline-edit affordance (`variant="none"` display → `variant="ghost"` edit), removing the CSS overrides that reset button chrome.
- Remove `AppSidebar`'s custom `#item` slot and let `UNavigationMenu` render icon + label natively; keep the outer `<nav aria-label="Main navigation">` landmark; delete the dead `ui: undefined` line.
- Re-point the 3 e2e specs that depend on `nav-link-*` testids to href-based selectors (`[data-testid="app-sidebar"] a[href="…"]`).

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `frontend-shell`: REQ-071 clarified — sidebar links render natively via `UNavigationMenu` (no custom per-item slot) and are addressable by their `href`, while the `<nav>` landmark and `aria-current` are preserved.
- `shared-ui-components`: new inline-edit affordance requirement — click-to-edit text fields use a `UInput` (display `variant="none"` → edit `variant="ghost"`) instead of a button styled to look like editable text, preserving revert/commit and a11y contracts.

## Impact

- Code: `app/components/AppSidebar.vue`, `app/components/TimerEntryRow.vue`, `app/components/TimerTaskGroup.vue`, `app/pages/index.vue`, `app/pages/sync/[date].vue`.
- Tests: `test/e2e/shell.spec.ts`, `test/e2e/clients-remote-config-ui.spec.ts`, `test/e2e/projects-ui.spec.ts` (selector re-point); nuxt component tests unaffected.
- No API, DB, or i18n-catalog changes; purely presentational + test-selector.
