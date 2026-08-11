## 1. Frontend — sidebar footer & utility menu removal

- [ ] 1.1 Add `AppUserFooter` (or equivalent) for sidebar `#footer`: expanded/mobile shows display name (or email fallback), secondary email when display name is set, labelled logout with `data-testid="logout-button"`; desktop collapsed shows logout icon only (`i-lucide-log-out`) with `aria-label` + tooltip (no avatar, no dropdown)
- [ ] 1.2 Wire footer into `default.vue` `UDashboardSidebar` `#footer` using slot `collapsed`; remove `AppUtilityMenu` from the navbar `#right` and delete `AppUtilityMenu.vue`
- [ ] 1.3 Clean unused `utilityMenu.*` i18n keys (or retarget logout strings) keeping `en`/`pl` parity for remaining logout labels

## 2. Frontend — navbar rail controls & full-width timer chrome

- [ ] 2.1 Place `UDashboardSidebarCollapse` in navbar `#left` (desktop); keep mobile `UDashboardSidebarToggle` via navbar `toggle`; ensure only one is visible per breakpoint
- [ ] 2.2 Re-layout timer region to full remaining navbar width, left-aligned (drop centered `max-w-3xl`); empty navbar right
- [ ] 2.3 Update `AppTimer`: title input grows (`flex-1`); elapsed + icon-only toggle on the right; idle `play` / running `square`; i18n `aria-label`s; running pulse/ring with reduced-motion-safe behavior
- [ ] 2.4 Enable collapsed nav tooltips on `AppSidebar` (`UNavigationMenu` tooltip when vertical + collapsed)

## 3. Frontend tests (nuxt / unit)

- [ ] 3.1 Update `test/nuxt/shell.spec.ts` and `test/nuxt/page-render.spec.ts`: logout in sidebar footer; no top-bar utility menu; collapse control present; drop `AppUtilityMenu` coverage
- [ ] 3.2 Update `test/nuxt/AppTimer.spec.ts`: icon-only toggle via `aria-label` / `aria-pressed` (not Start/Stop text); cover running vs idle icon affordance as practical
- [ ] 3.3 Add/adjust nuxt coverage for footer identity rules (name+email, email-only fallback, collapsed logout icon)

## 4. E2E tests

- [ ] 4.1 Update `test/e2e/shell.spec.ts` and `test/e2e/auth-ui.spec.ts` for footer logout (no utility-menu open step) and identity display where asserted
- [ ] 4.2 Update timer e2e that assert Start/Stop button text to use `aria-label` / `data-testid="timer-toggle-button"` pressed state instead

## 5. Verification

- [ ] 5.1 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:nuxt`, and relevant e2e (`shell`, `auth-ui`, timer suites) and fix regressions
