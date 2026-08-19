## 1. Frontend — brand assets

- [x] 1.1 Hand-author `app/assets/icons/app-mark.svg` (24×24 Clock-O glyph, `currentColor`, geometry from design D1)
- [x] 1.2 Hand-author `public/icon.svg` (32×32 cyan rounded-square app icon, white glyph, maskable inset, conversion comment); copy to `public/favicon.svg`; generate and commit `public/favicon.ico` from `icon.svg` (replace the Nuxt default; no new production dependency)

## 2. Frontend — chrome wiring

- [x] 2.1 Add `AppBrandMark.vue`: inline glyph from `app-mark.svg`, `size-6 text-primary`; with title → SVG `aria-hidden`; collapsed → `aria-label` from `layout.title`; `data-testid="app-brand-mark"`
- [x] 2.2 Wire `AppBrandMark` into `default.vue` sidebar `#header` (expanded: mark + `layout.title`; collapsed: mark only, centered). Keep `data-testid="app-sidebar-brand"`
- [x] 2.3 Wire `AppBrandMark` into `auth.vue` beside the existing title heading
- [x] 2.4 Add favicon `link`s in `app/app.vue` `useHead` (`/favicon.svg` + `/favicon.ico`); remove unused `layout.brandShort` from `en.json` and `pl.json`

## 3. Frontend tests (nuxt)

- [x] 3.1 Update `test/nuxt/shell.spec.ts`: expanded brand shows mark + title; collapsed shows mark, not `OSI`/full title; collapsed mark exposes the title as its accessible name
- [x] 3.2 Update `test/nuxt/page-render.spec.ts` (auth layout): heading shows mark + title; existing login testids unchanged

## 4. E2E tests

- [x] 4.1 Extend `test/e2e/auth-ui.spec.ts` (or login coverage): login heading shows the brand mark beside the application title
- [x] 4.2 Extend `test/e2e/shell.spec.ts`: authenticated sidebar brand region shows the mark and the application title at desktop expanded width

## 5. Verification

- [x] 5.1 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:nuxt`, and the touched e2e files; fix regressions. Browser-check login, expanded/collapsed sidebar, and the tab favicon in light and dark
