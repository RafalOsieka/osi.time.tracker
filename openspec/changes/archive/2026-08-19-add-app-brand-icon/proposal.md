## Why

The authenticated shell still substitutes the letters `OSI` for a missing app icon when the sidebar is collapsed, the login heading is title-only, and the browser tab still shows Nuxt's default favicon. REQ-066 already deferred a dedicated mark. The product needs a simple original icon that reads next to the title, at favicon size, and can later be rasterized for PWA without a redesign.

## What Changes

- Add a hand-authored **Clock-O** SVG mark: thick ring (clock + letter O), one hand at ~2 o'clock, small hub. No letters, ticks, or play triangle.
- Show the glyph beside `layout.title` in the expanded sidebar brand region and on the auth-layout login heading; when the desktop rail is collapsed, show the glyph only (replace `layout.brandShort` text).
- Ship a colored rounded-square SVG as the app icon and wire it as the favicon, replacing `public/favicon.ico`. Keep SVG as the source of truth for later PWA sizes.
- Remove unused `layout.brandShort` from `en`/`pl` once the collapsed mark no longer uses it.

## Non-goals

- PWA manifest, service worker, apple-touch, or rasterizing 192/512/maskable PNGs now.
- A new site footer or placing the mark in `AppUserFooter`.
- Using the current Nuxt favicon as a visual reference.
- Changing the cyan primary token, font stack, or other theming.

## Capabilities

### New Capabilities

- _(none)_

### Modified Capabilities

- `frontend-shell`: collapsed brand region shows the app mark (not `layout.brandShort`); expanded brand shows the mark beside the full title.
- `frontend-pages`: auth-layout login heading shows the same mark beside the application title.
- `ui-theming`: SVG-first brand assets and document favicon (glyph + colored app icon), replacing the default Nuxt favicon.

## Impact

- UI: `AppBrandMark.vue`, `app/layouts/default.vue`, `app/layouts/auth.vue`, `app/app.vue` (or `nuxt.config` head links).
- Assets: `app/assets/icons/app-mark.svg`, `public/icon.svg`, `public/favicon.svg`, replacement `public/favicon.ico`.
- i18n: drop `layout.brandShort`; keep `layout.title` as the collapsed mark's accessible name.
- Tests: nuxt shell + auth layout; e2e shell/login brand presence. No API, schema, or session changes.
