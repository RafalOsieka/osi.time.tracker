## 1. Sidebar Reports group

- [x] 1.1 Frontend: Update `app/components/AppSidebar.vue` so Reports is a `type: 'trigger'` item with no `to`, `open: true`, and a Monthly child (`to: '/reports/monthly'`, label from `reports.monthly.pageTitle`). Enable collapsed-rail popover for that item; keep tooltips on other primary items. Verify `pnpm type-check` and that the labelled menu shows Monthly without a `/reports` href.
- [x] 1.2 Frontend tests: Update `test/nuxt/shell.spec.ts` (REQ-065) so the nav stub walks `children`: hrefs include `/reports/monthly` and not `/reports`; Reports group is not treated as a link. Verify `pnpm test:nuxt` for that file.

## 2. Remove hub page

- [x] 2.1 Frontend: Delete `app/pages/reports/index.vue`. Remove hub-only i18n keys (`reports.hubTitle`, `reports.monthly.cardTitle`, `reports.monthly.cardDescription`) from `en` and `pl` in parity. Delete `test/nuxt/reports-hub.spec.ts`. Verify `/reports/monthly` still resolves and no hub test file remains.
- [x] 2.2 Frontend e2e: Update `test/e2e/ui/shell.spec.ts` — `a[href="/reports/monthly"]` is visible; `a[href="/reports"]` count is 0; activating Monthly opens the monthly timesheet, not a hub. Verify `pnpm test:e2e:ui` for that file.
- [x] 2.3 Frontend e2e: Add (or extend) a UI spec so an authenticated visit to `/reports` is 404 (REQ-300), not the hub or monthly page. Verify `pnpm test:e2e:ui` for that case.

## 3. Verification

- [x] 3.1 Frontend: `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:nuxt` stay green (no backend or API changes).
