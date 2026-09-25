## Why

The shipped brand mark is an arc plus a "T" traced from a font outline: uneven stroke weight, angled terminals, and a glyph that is optically off-centre in its ring. It also never matched its own specification — REQ-267 has described a "circular clock ring with a single hand and a hub, without letterforms" since the first commit, while the asset in `apps/web` has always contained a letterform. This change replaces the drawing with hand-built geometry and retires the two requirements that describe the old one, so the capability finally matches what the product ships.

## What Changes

- Replace the glyph with a constructed mark: a dial split into four quadrant segments (r 9.5, stroke 1.3, 28° gaps on the diagonals) around a "T" monogram built from five 2.5 grid cells on a 3.65 pitch, plus eight r 0.2 lattice points. Pure geometry, single colour, no font outlines.
- Split the two app-icon files that are byte-identical today: `icon.svg` keeps the glyph at 80% of the tile so it stays inside the maskable safe zone for future PWA rasters, while `favicon.svg` grows to 88% because a tab icon is never masked.
- **BREAKING (visual contract)**: the running-timer favicon stops using a green corner dot. The whole tile turns green (`#16a34a`) with the glyph left white. At 16 px the dot covers ~6% of the icon; the tile covers 100%, and white-on-green measures 3.26:1 against white-on-cyan's 2.41:1.
- The in-app mark stays stateless and stays `currentColor`: no running-state tint in the sidebar or auth heading.

## Non-goals

- No PWA manifest, service worker, or new raster sizes (apple-touch, 192/512, maskable) — still a later change.
- No change to how running state is resolved, seeded, or swapped (`favicon.ts`, `app.vue` untouched).
- No new brand colour: the accent stays the configured cyan `primary`.
- No wordmark, no logotype, no marketing assets.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ui-theming`: REQ-267 and REQ-268 are **removed and replaced** by REQ-368 and REQ-369 rather than amended. REQ-267's hand-and-hub geometry and its blanket ban on letterforms, and REQ-268's corner-dot mechanism, are inverted by this change rather than refined, so a MODIFIED delta would leave scenarios in the spec that assert the opposite of the shipped behaviour. The replacements carry every clause that still holds; see the delta's Migration notes.

## Impact

- Assets: `app/assets/icons/app-mark.svg`, `public/icon.svg`, `public/favicon.svg`, `public/favicon-running.svg`, `public/favicon.ico`.
- Components: `app/components/AppBrandMark.vue` (inline geometry only; props, classes, and test hooks unchanged).
- Tests: `test/nuxt/theme-render.spec.ts` asserts the mark contains no `<circle>`; the new glyph legitimately contains eight, so that assertion must be restated against its real invariant. `favicon-svg-href.spec.ts` and `timer-view-ui.spec.ts` assert hrefs only and are unaffected.
- Housekeeping: the exploratory `docs/brand/logo-proposals/` directory is removed once the geometry lives in `app-mark.svg`.
