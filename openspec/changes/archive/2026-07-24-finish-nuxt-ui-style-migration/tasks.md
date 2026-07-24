# Tasks — finish-nuxt-ui-style-migration

## 1. Sidebar cleanup (frontend-shell / REQ-071)
- [x] 1.1 Remove the custom `#item` slot from `AppSidebar.vue`; let `UNavigationMenu` render icon + label natively from `navItems`.
- [x] 1.2 Delete the dead `ui: undefined` line; keep the outer `<nav aria-label="Main navigation">` landmark and the `app-sidebar` container `data-testid`.
- [x] 1.3 Re-point e2e selectors to href-based locators: `test/e2e/shell.spec.ts`, `test/e2e/clients-remote-config-ui.spec.ts`, `test/e2e/projects-ui.spec.ts` → `[data-testid="app-sidebar"] a[href="…"]`.
- [x] 1.4 Confirm nuxt tests (`shell.spec.ts` REQ-065/REQ-071) still pass unchanged.

## 2. Inline-edit affordance (shared-ui-components / REQ-175)
- [x] 2.1 Replace the ghost-`UButton`-styled-as-text edit trigger for the entry title in `TimerEntryRow.vue` with a `UInput` (`variant="none"` display → `variant="ghost"` edit), commit on blur/Enter, revert on Escape/invalid.
- [x] 2.2 Do the same for the project selector affordance in `TimerEntryRow.vue` / `TimerTaskGroup.vue`.
- [x] 2.3 Preserve each control's accessible label and `data-testid`; keep the dynamic `ch`-based widths as inline `:style`.
- [x] 2.4 Delete the `.timer-entry__edit-trigger` (and equivalent) button-reset CSS rather than porting it.

## 3. Scoped CSS → Tailwind migration (CODING_STANDARDS §4)
- [x] 3.1 `TimerEntryRow.vue`: convert `<style scoped>` layout/color to Tailwind utilities + `--ui-*` tokens; keep only dynamic `:style`.
- [x] 3.2 `TimerTaskGroup.vue`: same.
- [x] 3.3 `app/pages/index.vue`: same (trivial style block).
- [x] 3.4 `app/pages/sync/[date].vue`: migrate the ~100-line style block (template/markup only — do NOT touch script logic; that is the separate composables change).
- [x] 3.5 Verify no `<style scoped>` blocks remain on these files except genuinely unavoidable rules (document any that survive).

## 4. Verification
- [x] 4.1 `pnpm lint` and `pnpm format:check` clean.
- [x] 4.2 `pnpm type-check` clean.
- [x] 4.3 `pnpm test:nuxt` green.
- [x] 4.4 `pnpm test:e2e` green (validates the re-pointed selectors).
- [x] 4.5 Manual smoke: sidebar navigation, current-route indication, and inline title/project editing (edit, commit, Escape-revert) behave as before.
