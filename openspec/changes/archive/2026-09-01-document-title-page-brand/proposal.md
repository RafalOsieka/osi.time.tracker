## Why

Browser tabs fall back to the request hostname because `app.vue` never sets `<title>`. Locally that is `localhost`; in production it is whatever host serves the app. Chrome already uses `layout.title` ("OSI Time Tracker"); the tab should too, with a per-page prefix so multiple tabs are distinguishable.

## What Changes

- Set the document title on every route to `{page} | {layout.title}` (English example: `Timer | OSI Time Tracker`).
- Page segment is the same i18n label as the destination (nav / page heading), including login and sync-day.
- Title is set on first SSR paint and updates on client navigation and locale change.
- Favicon running-timer swap is unchanged; the title does not include elapsed time.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `frontend-shell`: document title template `{page} | {brand}` for all layouts/routes, using i18n (not hostname).
- `internationalization`: title strings stay in `en`/`pl` catalogs (reuse existing keys where they already name the page).

## Impact

- **Code**: `app/app.vue` (title template), pages or a small composable for the page segment, `i18n/locales` if a route lacks a label.
- **Tests**: `test/nuxt` (useHead / title template; locale), optional UI e2e on one journey.
- **Backend/APIs**: none.

## Non-goals

- Putting the running timer or elapsed time in the tab.
- Changing the product name or sidebar brand.
- Static `nuxt.config` `app.head.title` (bypasses i18n).
- Open Graph / social meta beyond the document title.
