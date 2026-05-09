## 1. State & Store

- [ ] 1.1 Create `src/Web/src/stores/layout.ts` with `useLayoutStore` — `sidebarCollapsed` ref initialized from and synced to `localStorage`

## 2. Layout & Sidebar Components

- [ ] 2.1 Create `src/Web/src/layouts/DefaultLayout.vue` — flex container with `AppSidebar` on the left and `<RouterView />` filling the rest
- [ ] 2.2 Create `src/Web/src/components/AppSidebar.vue` — logo + app name at top, nav links (Tracker, Reports, Publish, Settings) using `RouterLink`, collapse toggle button at bottom
- [ ] 2.3 Implement desktop collapse: sidebar transitions between `w-56` (expanded) and `w-14` (collapsed); labels hidden when collapsed
- [ ] 2.4 Implement mobile overlay: hamburger button visible below `lg` breakpoint opens PrimeVue `Drawer` containing the sidebar nav; closes on nav link click or backdrop tap

## 3. Page Promotion

- [ ] 3.1 Create `src/Web/src/views/ReportsPage.vue` wrapping `ReportsPanel.vue`
- [ ] 3.2 Create `src/Web/src/views/PublishPage.vue` wrapping `PublishPanel.vue`
- [ ] 3.3 Create `src/Web/src/views/SettingsPage.vue` wrapping `SettingsPanel.vue`

## 4. Tracker Page Refactor

- [ ] 4.1 Rename `TrackerView.vue` to `TrackerPage.vue`
- [ ] 4.2 Remove `activeView` ref, nav buttons, and `PublishPanel` / `ReportsPanel` / `SettingsPanel` imports from `TrackerPage.vue`
- [ ] 4.3 Remove the outer `min-h-screen` wrapper div from `TrackerPage.vue` (layout is now owned by `DefaultLayout`)

## 5. Router Update

- [ ] 5.1 Update `src/Web/src/router/index.ts`: add `DefaultLayout` as parent route with child routes for `/tracker`, `/reports`, `/publish`, `/settings`; redirect `/` to `/tracker`

## 6. App.vue Simplification

- [ ] 6.1 Simplify `src/Web/src/App.vue` to render only `<RouterView />`

## 7. Verification

- [ ] 7.1 Run `pnpm lint` and `pnpm build` — no errors
- [ ] 7.2 Run `pnpm test` — all existing tests pass
- [ ] 7.3 Manually verify: sidebar visible on desktop, collapse/expand works, state persists on reload
- [ ] 7.4 Manually verify: mobile hamburger opens overlay, nav links close it, all four pages render correctly
- [ ] 7.5 Manually verify: browser back/forward navigates between pages; direct URL `/reports` loads correctly
