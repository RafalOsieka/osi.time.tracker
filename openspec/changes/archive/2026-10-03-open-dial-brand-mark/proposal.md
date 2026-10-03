# Proposal

## Why

The current brand mark is a closed dial of four arcs around a five-cell pixel "T" and a lattice of tiny points. At sidebar and tab sizes the thin 1.3 dial stroke and the sub-pixel lattice read as noise, and the mark does not say "time tracking" clearly. Design review picked a simpler drawing, candidate B7 (kept in `docs/brand/app-mark-b7.svg`). REQ-368 currently mandates a closed dial, a grid-cell monogram and a lattice, so the spec has to change before the asset can.

## What Changes

- Replace the canonical glyph with the B7 geometry:
  - **Open dial.** One stroke runs from a short horizontal bar at 6 o'clock, clockwise through 9 and 12, and ends at 3 o'clock. The 3–6 quadrant stays open, like elapsed time on a clock face.
  - **Stroke-built "T".** The crossbar is heavier than the dial stroke. The stem tapers like a clock hand pointing at 6.
- Drop the lattice points.
- Regenerate the three derived tiles (`icon.svg`, `favicon.svg`, `favicon-running.svg`) and the `favicon.ico` raster from the new glyph.
- Update the inline copy in `AppBrandMark.vue`.
- Amend REQ-368 so it describes the new mark:
  - An open dial that leaves one quadrant open.
  - A single-letter monogram constructed from strokes and filled polygons.
  - No lattice.
- Remove the `docs/brand/` candidate file once the canonical glyph has landed.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ui-theming`: REQ-368 changes its description of the mark's shape. It moves from a closed dial with a grid-cell monogram and lattice to an open dial with a stroke-built single-letter monogram. These rules stay unchanged:
  - Constructed geometry only, with no font outlines.
  - No words or multi-character abbreviations.
  - A single inherited colour in chrome.
  - Tile split and favicon rules.

  REQ-369 (running favicon) is unchanged.

## Non-goals

- No change to tile colours, tile shape, the idle/running favicon swap, or `favicon.ts`.
- No PWA manifest or additional raster sizes.
- No wordmark or "OSI" lettering in the mark.
- No change to where the mark appears (sidebar, login heading) or its accessible naming (ui-shell, ui-routing).

## Impact

- Assets:
  - `apps/web/app/assets/icons/app-mark.svg`
  - `apps/web/public/icon.svg`, `favicon.svg`, `favicon-running.svg`, `favicon.ico`
- Component: `apps/web/app/components/AppBrandMark.vue`, geometry only. The props, test id and ARIA wiring stay the same.
- Tests: the existing nuxt and e2e brand-mark and favicon tests should pass unchanged. One comment in `theme-render.spec.ts` mentions lattice `<circle>` elements and needs updating.
- Backend, API, database: none.
