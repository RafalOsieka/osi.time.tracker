## 1. Title template (frontend)

- [x] 1.1 Frontend: In `app/app.vue`, add an Unhead `titleTemplate` that suffixes the page title with ` | ` and `t('layout.title')`. Default title when a page omits `%s` MUST still include the brand and MUST NOT be the hostname. Verify via the existing `test/nuxt/theme-render.spec.ts` (or a sibling) that `useHead` receives `titleTemplate` / default title.
- [x] 1.2 Frontend: Set `useHead`/`useSeoMeta` `title` on each page from existing i18n keys: `/` `timerView.pageTitle`, `/trackers` `trackers.pageTitle`, `/projects` `projects.pageTitle`, `/reports/monthly` `reports.monthly.pageTitle`, `/settings` `nav.settings`, `/sync/[date]` `remoteSync.pageTitle` with date. Add a login page-title key in `en`/`pl` if needed. Verify titles in `test/nuxt` (mount or head mock) for at least timer, settings, login, and sync.

## 2. Tests

- [x] 2.1 Frontend unit/nuxt: Cover locale change updating both segments (`en` vs `pl`) without asserting hostname. Verify `pnpm test:nuxt` for the new/updated specs.
- [x] 2.2 Frontend e2e: Assert `document.title` on login and one authenticated page (e.g. `/`) matches `{page} | OSI Time Tracker` (or Polish if the test locale is `pl`). Verify `pnpm test:e2e:ui` for that spec.

## 3. Verification

- [x] 3.1 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:nuxt`, and the targeted UI e2e file.
