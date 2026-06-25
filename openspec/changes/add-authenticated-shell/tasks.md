## 1. Foundations (config + state)

- [ ] 1.1 Add a configurable very-small "timer-stack" breakpoint (runtime config default + CSS custom property) distinct from the `lg` rail→drawer threshold
- [ ] 1.2 Implement a `useShellState` composable for the desktop rail state (full ⇄ icon-only) backed by an SSR-safe cookie (no-flash), mirroring the color-mode pattern
- [ ] 1.3 Unit test `useShellState` (default value, toggle, persistence read/write) and the breakpoint resolution logic

## 2. Shell components (frontend)

- [ ] 2.1 Create `AppSidebar` rendering the nav skeleton (Dashboard, Clients, Projects, Tasks, Reports, Settings) as a `<nav>` landmark with i18n labels and `aria-current` on the active route
- [ ] 2.2 Create `AppTopBar` with brand, `☰` toggle (`aria-expanded`), reserved timer region slot, and the utility-menu slot
- [ ] 2.3 Create `AppUtilityMenu` collapsing locale, theme, and user/logout (preserving the `logout-button` hook) into a single menu
- [ ] 2.4 Implement desktop collapsible rail (full ⇄ icon-only) driven by `useShellState`, with tooltips in icon-only mode
- [ ] 2.5 Implement the off-canvas `Drawer` for `< lg` (scrim, focus-trap, `Esc`/scrim dismissal, focus return to `☰`)
- [ ] 2.6 Implement the very-small stacked layout (timer region on its own full-width row, content stacked below) gated by the configurable breakpoint
- [ ] 2.7 Rebuild `app/layouts/default.vue` to compose the shell using PrimeVue tokens, removing all inline styles

## 3. Placeholder pages (frontend)

- [ ] 3.1 Add placeholder pages under `app/pages/` for unbuilt destinations (Clients, Projects, Tasks, Reports, Settings) routing without errors, keeping `/` as the existing authenticated home/Dashboard
- [ ] 3.2 Wire sidebar links to these routes

## 4. i18n

- [ ] 4.1 Add nav and utility-menu label keys to `i18n/locales/en.json` and `pl.json`
- [ ] 4.2 Confirm `en`/`pl` catalog parity (existing parity spec)

## 5. Tests (frontend)

- [ ] 5.1 `test/nuxt/`: shell renders top bar + sidebar + page outlet, logout reachable (REQ-AUTH-010)
- [ ] 5.2 `test/nuxt/`: sidebar lists all skeleton destinations and unbuilt links resolve to placeholders (REQ-AUTH-011)
- [ ] 5.3 `test/nuxt/`: desktop rail toggle + persisted/no-flash state (REQ-AUTH-012)
- [ ] 5.4 `test/nuxt/`: `< lg` drawer opens, focus-trapped, closes on `Esc`, focus returns (REQ-AUTH-013)
- [ ] 5.5 `test/nuxt/`: very-small tier moves timer region to its own full-width row with content below (REQ-AUTH-014)
- [ ] 5.6 `test/nuxt/`: utility controls reachable via a single menu (REQ-AUTH-015)
- [ ] 5.7 `test/nuxt/`: a11y assertions — `<nav>` landmark, `aria-current`, `aria-expanded` (REQ-NFR-020)
- [ ] 5.8 E2E (`test/e2e/`): authenticated user navigates the sidebar across desktop and mobile drawer flows

## 6. Docs

- [ ] 6.1 Update `docs/wbs.md` 7.6 note to reflect the authenticated-shell rollout landing
