## Why

When a timer is running, the only persistent signal is inside the page (the top-bar widget). A background tab looks idle. A static green-dot badge on the favicon makes “timer is live” visible in the tab strip without animation or a second drawing of the brand mark.

This extends the existing running-timer indicator (WBS 2.9 / REQ-146) to the document icon, using the brand assets from REQ-267.

## What Changes

- Add a second favicon SVG: the current app icon plus a **static green corner dot** (bottom-right, with a light ring so it reads on the cyan square). Composed from `app/assets/icons/app-mark.svg` the same way `public/icon.svg` was — the author does not supply a new drawing.
- Point `useHead` at `/favicon.svg` when no timer is running, and at the running variant when `useTimer().running` is set (including SSR-seeded running state on authenticated first paint).
- On stop, or when logged out / no running entry, restore the default favicon.
- Keep `/favicon.ico` as the idle raster fallback. Do not add a running `.ico`.

## Non-goals

- Pulsing, GIF/SMIL animation, or a play-triangle badge.
- Changing the document title to show elapsed time.
- Syncing the badge across other open tabs (`BroadcastChannel`).
- Badging the in-app sidebar/login mark (`AppBrandMark`).
- PWA / home-screen icons.

## Capabilities

### New Capabilities

- _(none)_

### Modified Capabilities

- `ui-theming`: the document favicon SHALL reflect idle vs running timer state (default icon vs green-dot variant). REQ-267 idle assets stay the default.

## Impact

- UI: `app/app.vue` `useHead` icon `href` derived from `useTimer().running` (small composable allowed).
- Assets: `public/favicon-running.svg` (`app-mark.svg` glyph on the cyan square + green dot). No change to `app-mark.svg` or the idle favicon.
- Tests: nuxt `theme-render` (and/or a focused favicon test) for idle vs running `href`; e2e start/stop updates the icon link. No API, schema, or i18n string changes.
