## 1. Frontend — sidebar footer & utility menu removal

- [x] 1.1 Add `AppUserFooter` for sidebar `#footer`: expanded/mobile `UUser` account trigger (display name or email fallback, secondary email when display name is set, avatar initial); desktop collapsed avatar trigger; both open `UDropdownMenu` with Log out (no separate always-visible logout row)
- [x] 1.2 Wire footer into `default.vue` `UDashboardSidebar` `#footer` using slot `collapsed`; remove `AppUtilityMenu` from the navbar `#right` and delete `AppUtilityMenu.vue`
- [x] 1.3 Clean unused `utilityMenu.*` i18n keys; keep `layout.logoutButton` / `layout.brandShort` with `en`/`pl` parity

## 2. Frontend — navbar rail controls & full-width timer chrome

- [x] 2.1 Place `UDashboardSidebarCollapse` in navbar `#left` (desktop); keep mobile `UDashboardSidebarToggle` via navbar `toggle`; ensure only one is visible per breakpoint
- [x] 2.2 Re-layout timer region to full remaining navbar width, left-aligned (drop centered `max-w-3xl`); empty navbar right; collapsed brand shows `layout.brandShort` centered
- [x] 2.3 Update `AppTimer`: title input grows (`flex-1`); elapsed always link-style `UButton` (disabled when idle); icon-only ghost play/square toggle; i18n `aria-label`s; running stop icon color pulse with reduced-motion-safe behavior
- [x] 2.4 Enable collapsed nav tooltips on `AppSidebar` (`UNavigationMenu` tooltip when vertical + collapsed)

## 3. Frontend tests (nuxt / unit)

- [x] 3.1 Update `test/nuxt/shell.spec.ts` and `test/nuxt/page-render.spec.ts`: account footer + no top-bar utility menu; collapse control present; drop `AppUtilityMenu` coverage
- [x] 3.2 Update `test/nuxt/AppTimer.spec.ts`: icon-only toggle via `aria-label` / `aria-pressed` (not Start/Stop text); cover running vs idle icon affordance as practical
- [x] 3.3 Add/adjust nuxt coverage for footer identity rules (name+email, email-only fallback, collapsed avatar account trigger + menu logout)

## 4. E2E tests

- [x] 4.1 Update `test/e2e/shell.spec.ts` and `test/e2e/auth-ui.spec.ts` for account footer (open trigger → Log out menuitem) and identity display where asserted
- [x] 4.2 Update timer e2e that assert Start/Stop button text to use `aria-pressed` / `data-testid="timer-toggle-button"` instead

## 5. Verification

- [x] 5.1 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:nuxt`, and relevant e2e (`shell`, `auth-ui`, timer suites as applicable) and fix regressions
