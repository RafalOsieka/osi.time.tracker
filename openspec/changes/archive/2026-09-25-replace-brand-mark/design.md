## Context

See `proposal.md` — Why. Design-relevant state:

- The canonical glyph is a hand-authored 24×24 SVG (`app/assets/icons/app-mark.svg`) drawn entirely in `currentColor`. Three derived assets and one Vue component restate the same paths; the archived design kept them in sync by comment, not by tooling.
- `public/icon.svg` and `public/favicon.svg` are currently byte-identical. Nothing in the app distinguishes them — one is simply a copy.
- `public/favicon.ico` was generated once from the SVG with a one-off CLI; there is no rasterizer dependency and no CI step, and this change keeps it that way.
- The head wiring (`app/utils/favicon.ts`, `app/app.vue`) switches only between two static hrefs. It needs no change, which bounds the blast radius to assets plus one component plus one test.

## Goals / Non-Goals

**Goals:**

- Record the new geometry numerically, so the four assets can be regenerated from the document rather than traced from each other.
- Keep the single-`currentColor` contract intact, so every derived file is produced by one colour substitution.
- Make the running-state signal survive a 16×16 tab strip.

**Non-Goals:**

- No build step, SVG loader, sprite system, or rasterizer dependency to keep the assets in sync. Four files stay hand-maintained; the mitigation is a shared geometry table here, not tooling.
- No change to running-state resolution, SSR seeding, or head-link keys.

## Decisions

### D1: Mark geometry — quadrant dial, grid monogram, axis points

All coordinates on the 24×24 canvas, centre `(12,12)`:

| element | geometry |
| --- | --- |
| Dial | four arcs, r `9.5`, `stroke-width 1.3`, round caps, each spanning 62°, gaps of 28° centred on the diagonals. Base arc `M16.89 3.86A9.5 9.5 0 0 0 7.11 3.86`, then `rotate(90|180|270 12 12)` |
| Monogram | five `2.5 × 2.5` cells, `rx 0.8`, on a `3.65` pitch — top row at `x = 7.1 / 10.75 / 14.4`, `y = 7.1`; stem at `x = 10.75`, `y = 10.75` and `14.4` |
| Inner grid | four `r 0.2` dots at `(8.35,12) (15.65,12) (8.35,15.65) (15.65,15.65)` |
| Axis grid | four `r 0.2` dots at `(12,4.7) (12,19.3) (4.7,12) (19.3,12)`, radius `7.3`, clearance `1.35` to the dial |

Thirteen elements total. The lattice is a 5×5 grid cropped by the circle; the eight flanking points of its outer ring would land at radius `8.16`–`8.94` and are omitted, which is why only the axis points remain.

**Alternatives considered.** A solid disc with a knocked-out letter was the strongest at 16 px but read far heavier than the 2px-stroke Lucide icons beside it in the sidebar. A dial made only of dots removed the merging problem but gave up the closed silhouette. A denser 5×5 lattice at `0.4` merged with the dial below 24 px — the spacing was widened to `3.65` and the points reduced to `0.2` precisely to stop that. Cutting the dial at 12/3/6/9 instead of the diagonals was tighter compositionally but split the mark along the monogram's own axis.

**Trade-off accepted:** widening the pitch to `3.65` opened the gaps between the monogram cells from `0.8` to `1.15`, so the letter is slightly looser than at the original spacing. Enlarging the cells to ~`2.85` would restore the old density and is deliberately deferred rather than bundled here.

### D2: Two tiles with different glyph scale

| file | glyph box | role |
| --- | --- | --- |
| `public/icon.svg` | `x/y 4`, 24/32 = **75%** | maskable source for future PWA rasters |
| `public/favicon.svg` | `x/y 2`, 28/32 = **88%** | tab icon |
| `public/favicon-running.svg` | as `favicon.svg`, green fill | tab icon |
| `public/favicon.ico` | rasterized from the **88%** tile | tab icon fallback |

The glyph is placed with a nested `<svg x y width height viewBox="0 0 24 24">` rather than `<g transform>`. The 88% tile needs a scale of 28/24 = 1.1666…, a repeating decimal in a transform attribute; the nested viewport expresses the same mapping exactly, and its `width`/`height` state the tile fraction directly.

**Why not one shared file.** Keeping both at 75% wastes the only size where legibility is scarce — 16×16 is where this mark has the least room, and the tab tile is the only asset rendered there.

Note what does *not* justify the split: the glyph does not fill its own box. The mark's outermost element is the dial's outer stroke edge at radius `10.15` of `12`, i.e. 84.6% of the box half-width. The drawn ink therefore covers **63.4%** of the tile at 75% and **74.0%** at 88%, and the maskable safe circle is 80% — so *both* tiles clear it. An earlier draft of this design claimed the 88% tile would be clipped when masked; that was measured against the glyph box instead of the ink, and is wrong.

The real reason to keep the maskable source smaller is headroom rather than clipping: Android crops adaptive icons into a circle, squircle or teardrop, and a ring reaching 74% of the tile sits close to that crop edge and reads cramped even when nothing is lost. 63.4% leaves the future PWA raster comfortable. The split costs one extra file and is recorded in REQ-368 so the divergence stays intentional rather than drifting.

The `.ico` is cut from the tab tile, not the maskable one, because its only consumer is the same tab strip.

### D3: Running state is a fill change, not a badge

Running tile fill `#16a34a` (green-600), glyph unchanged and still white.

**Why not the existing corner dot.** At 16×16 the dot plus its ring covers roughly 6% of the icon — smaller than one monogram cell — which is why it reads as invisible in practice.

**Why not tinting the monogram or the dial.** The monogram is ~5% of the tile and the dial's stroke is `1.3`, which lands under one device pixel at 16 px. Both also swap cyan for green, and those hues sit close enough together that the change is weak at icon size.

**Why green-600 rather than green-500.** Against the white glyph, `#16a34a` measures 3.26:1 where `#22c55e` measures 2.26:1 and the idle cyan `#06b6d4` measures 2.41:1. Green-600 therefore satisfies the "no worse than idle" scenario in REQ-369 with margin; green-500 would fail it.

### D4: The in-app mark stays stateless

The sidebar and auth-heading mark keeps a single inherited colour and gains no state prop. Running state is already carried closer to the action by the top-bar timer, and a second, weaker signal on the logo would compete with it. This preserves the existing invariant that `theme-render.spec.ts` was written to protect.

### D5: One colour substitution per derived file

`app-mark.svg` stays the canonical drawing in `currentColor`. Because the dial is stroked while the monogram and points are filled, the root element cannot carry a single `fill="currentColor"`: the dial sits in a group with `fill="none" stroke="currentColor"`, and everything else inherits the root fill. Every derived tile is then produced by replacing the literal `currentColor` with `#fff` — no per-element edits, no second colour inside the glyph.

### D6: Restate the brand-mark test invariant

`theme-render.spec.ts` asserts `not.toMatch(/<circle/i)`, which was a safe proxy for "no status badge" while the glyph was two `<path>`s. The new glyph contains eight legitimate `<circle>` elements, so the proxy breaks. Replace it with the invariant it stood for: the component renders identical markup with and without a running entry, and contains no status colour. That is stronger than the original — it catches any future state leak, not just circular ones — and does not weaken the test to accommodate the art.

## Risks / Trade-offs

- **[Risk] Four hand-maintained copies of one drawing drift apart.** → The geometry table in D1 is the single source; each file keeps a header comment pointing at this change, and the tab tiles differ from the canonical glyph only by the `translate`/size pair.
- **[Risk] Browsers cache favicons aggressively, so the old icon lingers after deploy.** → Filenames are unchanged by design (the head-link contract and its tests depend on them); accept the lag rather than introduce hashed icon names. Verify with a hard reload in a fresh profile.
- **[Risk] The `0.2` lattice points fall below one device pixel at 16 px and render as tone.** → Accepted and written into REQ-368 as expected behaviour; the dial and monogram carry legibility at that size.
- **[Risk] Green-600 on a dark tab strip is less luminous than the cyan it replaces.** → The signal is the hue change across the whole tile, not its brightness; checked against both light and dark tab strips before commit.
- **[Trade-off] The monogram is looser than at the previous pitch (D1).** → Deliberately deferred; the cell size is a single number to revisit once the mark has been lived with.

## Migration Plan

1. Land the canonical glyph, then the component, then the three tiles, then the `.ico` — so no intermediate commit ships a tile whose geometry disagrees with the glyph.
2. Remove `docs/brand/logo-proposals/` only after the geometry exists in `app-mark.svg`; it currently holds the only copy of the chosen drawing. The directory is staged in git today and must be unstaged as well as deleted.
3. Rollback is a straight revert: every changed file is a static asset, a presentational component, or a test. No data, no migration, no head-link contract change.
