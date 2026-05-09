## 1. State & Store

- [x] 1.1 Create `src/Web/src/stores/layout.ts` with `useLayoutStore` — `sidebarCollapsed` ref initialized from and synced to `localStorage`

## 2. Layout & Sidebar Components

- [x] 2.1 Create `src/Web/src/layouts/DefaultLayout.vue` — flex container with `AppSidebar` on the left and `<RouterView />` filling the rest
- [x] 2.2 Create `src/Web/src/components/AppSidebar.vue` — logo + app name at top, nav links (Tracker, Reports, Publish, Settings) using `RouterLink`, collapse toggle button at bottom
- [x] 2.3 Implement desktop collapse: sidebar transitions between `w-56` (expanded) and `w-14` (collapsed); labels hidden when collapsed
- [x] 2.4 Implement mobile overlay: hamburger button visible below `lg` breakpoint opens PrimeVue `Drawer` containing the sidebar nav; closes on nav link click or backdrop tap

## 3. Page Promotion

- [x] 3.1 Create `src/Web/src/views/ReportsPage.vue` wrapping `ReportsPanel.vue`
- [x] 3.2 Create `src/Web/src/views/PublishPage.vue` wrapping `PublishPanel.vue`
- [x] 3.3 Create `src/Web/src/views/SettingsPage.vue` wrapping `SettingsPanel.vue`

## 4. Tracker Page Refactor

- [x] 4.1 Rename `TrackerView.vue` to `TrackerPage.vue`
- [x] 4.2 Remove `activeView` ref, nav buttons, and `PublishPanel` / `ReportsPanel` / `SettingsPanel` imports from `TrackerPage.vue`
- [x] 4.3 Remove the outer `min-h-screen` wrapper div from `TrackerPage.vue` (layout is now owned by `DefaultLayout`)

## 5. Router Update

- [x] 5.1 Update `src/Web/src/router/index.ts`: add `DefaultLayout` as parent route with child routes for `/tracker`, `/reports`, `/publish`, `/settings`; redirect `/` to `/tracker`

## 6. App.vue Simplification

- [x] 6.1 Simplify `src/Web/src/App.vue` to render only `<RouterView />` (was already done)

## 7. Verification

- [x] 7.1 Run `pnpm lint` and `pnpm build` — no errors (3 pre-existing any errors in publishers.ts not introduced by this change)
- [x] 7.2 Run `pnpm test` — no test files exist (pre-existing condition)
- [x] 7.3 Manually verify: sidebar visible on desktop, collapse/expand works, state persists on reload
- [x] 7.4 Manually verify: mobile hamburger opens overlay, nav links close it, all four pages render correctly
- [x] 7.5 Manually verify: browser back/forward navigates between pages; direct URL `/reports` loads correctly
