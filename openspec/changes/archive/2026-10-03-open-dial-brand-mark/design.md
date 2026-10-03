# Design

## Context

See `proposal.md` (Why). Design-relevant state:

- The canonical glyph is `apps/web/app/assets/icons/app-mark.svg`. It is a hand-authored 24×24 SVG drawn entirely in `currentColor`.
- Three tiles in `apps/web/public/` and `AppBrandMark.vue` repeat the same elements. They are kept in sync by header comments, not by tooling.
- The tiles embed the glyph with a nested `<svg x y width height viewBox="0 0 24 24">`:
  - `icon.svg`: 75% scale, the maskable source.
  - `favicon.svg`: 88% scale.
  - `favicon-running.svg`: 88% scale, green fill.
- `favicon.ico` is rasterized once from the 88% tile with a one-off `pnpx` CLI. It adds no dependency.
- The head wiring (`app/utils/favicon.ts`) swaps only between static hrefs. It needs no change.
- The client report PDF (`app/utils/client-report/build-client-report-pdf.ts`) prints the mark on its title page. It holds its own hand-pasted copy of the old 75% tile as an SVG string constant, and nothing ties that copy to the canonical glyph. See D3.
- The approved geometry already exists as `docs/brand/app-mark-b7.svg`. That file is a working copy only and is not referenced by the app.

## Goals / Non-Goals

**Goals:**

- Record the new geometry numerically, so every asset can be regenerated from this document.
- Keep the single-`currentColor` contract, so each tile is still one colour substitution of the canonical glyph.

**Non-Goals:**

- No build step, SVG loader or rasterizer dependency to sync the assets. They stay hand-maintained, as before.
- No change to tile scales, tile fills or corner radius.

## Decisions

### D1: Mark geometry (candidate B7)

All coordinates are on the 24×24 canvas with centre `(12,12)`:

| element | geometry |
| --- | --- |
| Dial | one path `M15.6 21.5H12A9.5 9.5 0 1 1 21.5 12`, `stroke-width 2`, round caps and joins. A bar from x `15.6` to the 6 o'clock point, then an arc of r `9.5` clockwise through 9 and 12 to 3 o'clock (270°). |
| T crossbar | `M8.5 9.3H15.5`, `stroke-width 2.6`, round caps |
| T stem | filled polygon `M10.7 9.3H13.3L12.4 16.9H11.6Z`, with a `0.4` stroke and round joins to soften the corners. It is 2.6 wide under the crossbar, 0.8 wide at the tip and points at 6 o'clock. |

That makes three elements, down from thirteen.

- **Bar and arc share one path.** At `(12,21.5)` the bar's direction matches the arc's tangent, so drawing them as one path gives a seamless join. Two overlapping round caps would leave a visible bump.
- **The crossbar is heavier than the dial (2.6 vs 2).** This makes "T" the focal point and the dial its frame. The T sits 0.5 below the earlier B7 draft, so it looks centred inside the open dial.

**Alternatives considered:**

- *Keep the five-cell pixel T inside the open dial.* This is the smallest change, but the cells at `2.5` with `1.15` gaps blur into a blob at 16 px, and the cell motif no longer matches a stroke-drawn dial.
- *"SI" letters cut into the bar so the dial reads as "OSI".* This was explored at length. The letters disappear below 32 px, and REQ-368 rules out multi-character abbreviations, so it was dropped.
- *Closed or segmented dials, tick marks, an inner track, double rings.* These add detail that becomes tone at 16 px. The open quadrant gives the "time" reading with no extra elements.

### D2: Tiles keep their scales; the margin is checked against the new extent

The furthest ink from the centre is now the bar's end cap at `(15.6,21.5)`, at radius `10.16 + 1 = 11.16`. That is further than the dial's outer edge at `10.5`.

| tile | scale | ink radius / tile half-width | 80% safe circle |
| --- | --- | --- | --- |
| `icon.svg` (75%) | 1.0 | 11.16 / 16 = **69.8%** | clears, with 1.64 to spare |
| `favicon.svg` (88%) | 1.1667 | 13.02 / 16 = **81.4%** | does not clear. That is allowed, because the tab tile is never masked (REQ-368). |

At 88%, the bar cap lands at `(21.4, 28.3)` on the 32 px tile. It stays outside the `rx 8` corner zone, so the rounded corner does not clip it.

**Alternative considered:** shrink the glyph so that the 88% tile also clears 80%. This costs legibility in the one place where space is scarcest, and buys nothing, because the tab tile is never masked.

### D3: The PDF logo is built from the canonical glyph at import time

The PDF builder imports `app/assets/icons/app-mark.svg` with Vite's `?raw` suffix. It then builds the tile in code: a `rect rx 8` in `#06b6d4`, with the glyph at 75% (`translate(4 4)`) and `currentColor` replaced by `#fff`. The glyph's own `<!-- -->` header comment is stripped first. pdfmake receives a plain SVG string, as before. The import uses a relative path so it resolves the same way in the Nuxt app and in the plain unit-test project.

A unit test checks two things: every `d` path from `app-mark.svg` appears in the PDF logo, and the logo contains no `currentColor`. That fails if someone pastes a static copy back in.

**Alternatives considered:**

- *Import `public/icon.svg?raw` as is.* It is simpler, but it ties the PDF to a hand-maintained tile instead of the source glyph. It also keeps the nested `<svg>` viewport, which pdfmake's SVG renderer handles less predictably than a `<g transform>`.
- *Keep a pasted copy and add a "keep in sync" comment.* That is how the drift happened in the first place.

## Risks / Trade-offs

- [pdfmake's SVG renderer may draw round caps, round joins or the stem polygon differently from browsers] → Export a real PDF and compare its title page with `icon.svg`.

- [The open quadrant and the taper of the stem may smear at 16 px] → Visual check in a fresh browser profile at idle and running, on light and dark tab strips. If the tip disappears, widen it from `0.8` to `1.0` before release. That only changes numbers in D1, not the spec.
- [Four hand-synced copies of the geometry can drift] → Each asset's header comment points to D1, and every task verifies its file against this table.
- [Favicons are cached aggressively, so reviewers may see the old icon] → Check in a fresh profile, as the previous change did.

## Migration Plan

This changes static assets only. Deploying ships the new files. Rolling back means reverting the commit, with no data or config involved.
