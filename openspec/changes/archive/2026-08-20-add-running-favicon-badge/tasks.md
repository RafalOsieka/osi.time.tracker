## 1. Frontend — running favicon asset

- [x] 1.1 Add `public/favicon-running.svg`: compose from `app/assets/icons/app-mark.svg` the same way as `public/icon.svg`, and add a static green-500 `#22c55e` corner dot (`cx="26" cy="26" r="5"`) with a white `stroke-width="1.5"` ring (design D1)

## 2. Frontend — head wiring

- [x] 2.1 Add `faviconSvgHref(isRunning: boolean)` (shared util) returning `/favicon-running.svg` vs `/favicon.svg`
- [x] 2.2 In `app/app.vue`, drive the SVG favicon `useHead` `href` from `useTimer().running` via a **computed** `link` array (keep idle `/favicon.ico`); do not snapshot `running` once at setup

## 3. Frontend tests (unit / nuxt)

- [x] 3.1 Unit-test `faviconSvgHref` for idle vs running
- [x] 3.2 Update `test/nuxt/theme-render.spec.ts` (idle head still `/favicon.svg` + ico). Add nuxt coverage that a seeded running entry makes the SVG icon href `/favicon-running.svg`, and that `AppBrandMark` stays unbadged

## 4. E2E tests

- [x] 4.1 Extend a browser timer e2e (`timer-view-ui` or `timer-topbar-start-edit`): after start, the document icon link is `/favicon-running.svg`; after stop, it is `/favicon.svg`

## 5. Verification

- [x] 5.1 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:nuxt`, and the touched e2e file; browser-check idle vs running tab icon
