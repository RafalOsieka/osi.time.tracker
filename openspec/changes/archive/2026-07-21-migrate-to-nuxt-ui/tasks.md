## 1. Tooling and dependencies

- [x] 1.1 Add `@nuxt/ui` (v4) and remove `primevue`, `@primevue/forms`, `@primeuix/themes`, and `primeicons` from `package.json`; update the lockfile via `pnpm install`.
- [x] 1.2 Register the `@nuxt/ui` module in `nuxt.config.ts`, wire Tailwind v4, and remove the PrimeVue module/theme configuration.
- [x] 1.3 Update `optimizeDeps`, the MCP/docs config entry, and any PrimeVue-specific `vite`/build settings.
- [x] 1.4 Update `eslint.config.mjs` accessibility and i18n rules for Nuxt UI component output; ensure `pnpm lint` passes on unchanged code paths.
- [x] 1.5 Remove the PrimeVue global CSS/import and confirm the app boots with the Nuxt UI base styles.

## 2. Theme and app root

- [x] 2.1 Define the brand `primary` (cyan) color and neutral in `app.config.ts` (`ui.colors`).
- [x] 2.2 Wrap the app in `UApp`, binding its `locale` to the active `@nuxtjs/i18n` locale.
- [x] 2.3 Confirm `@nuxtjs/color-mode` provides SSR-safe light/dark/system with no flash; delete Aura `darkModeSelector` config.
- [x] 2.4 Remove all `--p-*` token references and ad-hoc inline color styles across `app/`.

## 3. Shared components and composables

- [x] 3.1 Convert all forms to `UForm` with `:schema` bound to the shared zod schemas; replace `FormFieldWrap` with `UFormField` and delete `FormFieldWrap` (satisfies removed REQ-035/REQ-128).
- [x] 3.2 Migrate table-template components (header, empty state, row actions) to work with `UTable` (REQ-127).
- [x] 3.3 Implement `ConfirmModal` + a `useOverlay()`-based confirm helper; remove `ConfirmDialog`/`useConfirm` usage (REQ-129).
- [x] 3.4 Port the smart time input to `UInput`, preserving the normalization function and its unit tests (REQ-131).
- [x] 3.5 Replace every `pi pi-*` icon string with its `i-lucide-*` equivalent.

## 4. Shell and layout

- [x] 4.1 Rebuild `app/layouts/default.vue` on `UDashboardGroup`/`UDashboardSidebar`/`UDashboardNavbar` with `UNavigationMenu` (REQ-064, REQ-065).
- [x] 4.2 Use `UDashboardSidebar` `collapsible` + mobile slideover for rail-collapse and drawer; delete the hand-built rail/drawer/focus-trap logic (REQ-066, REQ-067).
- [x] 4.3 Slot the live timer widget into the navbar and the very-small full-width row (REQ-068, REQ-070).
- [x] 4.4 Verify shell a11y: `<nav>` landmark, `aria-current="page"`, toggle `aria-expanded` (REQ-071).
- [x] 4.5 Delete the `primevue-i18n-sync` plugin (REQ-075).

## 5. Pages

- [x] 5.1 Migrate `login.vue` and the `auth` layout to `UForm`/`UCard` (REQ-013, REQ-164).
- [x] 5.2 Migrate `settings.vue` to `UForm`/`UFormField`.
- [x] 5.3 Migrate the Clients page to `UTable` + `UModal` (REQ-033, REQ-034).
- [x] 5.4 Migrate the Projects page to `UTable` + `UModal`, including the client select (REQ-091, REQ-092).
- [x] 5.5 Migrate the timer view, its dialogs (`TimerAddEntryDialog`, `TimerBulkAssignDialog`), and `RemoteIssuePicker` to `UForm`/`UModal`/`UInputMenu`.
- [x] 5.6 Migrate the remote sync page/table to `UTable`.
- [x] 5.7 Confirm every user-facing string still resolves from the i18n catalogs with `en`/`pl` parity.

## 6. Tests and docs

- [x] 6.1 Update `test/nuxt/*` stubs/mocks and selectors from PrimeVue to Nuxt UI; keep all `data-testid` assertions intact.
- [x] 6.2 Run `pnpm test:unit`, `pnpm test:nuxt`, and `pnpm test:e2e`; fix regressions until green.
- [x] 6.3 Run `pnpm lint`, `pnpm format:check`, and `pnpm type-check`.
- [x] 6.4 Update `AGENTS.md` and `CODING_STANDARDS.md` (UI library, Tailwind-utility styling policy, icon set, form pattern).
