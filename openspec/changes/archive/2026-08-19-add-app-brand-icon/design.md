## Context

See `proposal.md` for motivation and the delta specs (REQ-066, REQ-060, REQ-267) for the behavior contract.

Today: `default.vue` sidebar header shows `layout.brandShort` (`OSI`) when collapsed and `layout.title` when expanded; `auth.vue` is title-only; `public/favicon.ico` is Nuxt’s default. The shell already styles with `--ui-*` tokens; primary is cyan (`app.config.ts`). No SVG loader plugin is installed.

## Goals / Non-Goals

**Goals:**

- One hand-authored Clock-O geometry reused as a `currentColor` chrome glyph and a colored rounded-square app icon.
- Wire the glyph into sidebar brand + login heading; replace the Nuxt favicon.
- Keep the glyph inside the center ~80% of the app-icon canvas so a later PWA maskable raster does not need a new drawing.

**Non-Goals:**

- PWA manifest, service worker, or extra PNG sizes (design-level restatement of proposal non-goals).
- Adding `vite-svg-loader`, Iconify custom collections, or a rasterize script in CI.
- Changing `ui.colors.primary`.

## Decisions

### D1: Clock-O geometry (ring + 2 o’clock hand + hub)

**Choice:** 24×24 Lucide-like glyph:

- Ring: center `(12,12)`, radius `8`, stroke `2.25`, round caps.
- Hand: `(12,12)` → `(16.2, 8.6)`, stroke `2.25`, round cap.
- Hub: filled circle `r=1.4`.

App icon: 32×32 viewBox, rounded square `rx=8` fill `#06b6d4` (Tailwind cyan-500), white glyph inset so the ring stays in the maskable safe zone.

**Why not a stopwatch crown:** the extra nub disappears or blobs at 16×16.

**Why not a 3/4 progress arc:** reads as a spinner, not a product mark.

**Why not “OSI” letterforms:** illegible at favicon size (REQ-267).

**Why not Imagine / raster art:** paths must be exact; author SVG by hand.

### D2: Two files, same glyph — not one SVG with CSS

| Asset | Role |
| --- | --- |
| `app/assets/icons/app-mark.svg` | Glyph only, `currentColor`. Canonical chrome drawing. |
| `public/icon.svg` | Colored app icon. Canonical favicon / future PWA source. Header comment: canvas, safe zone, cyan hex. |
| `public/favicon.svg` | Same bytes as `icon.svg`. |
| `public/favicon.ico` | Committed raster fallback generated **once** from `icon.svg` (16/32). No new production dependency. |

**Why not a single SVG for both:** tab icons cannot use CSS `currentColor`; in-chrome marks must (REQ-160 / REQ-267).

**Why not `<img src="/icon.svg">` in the sidebar:** the colored square is too heavy next to the title; the glyph needs `text-primary`.

**Why a static cyan on the favicon:** exception documented in REQ-267; do not tint the in-app glyph with a raw hex class.

### D3: Inline SVG in `AppBrandMark.vue`

**Choice:** presentational `AppBrandMark` is the glyph only (`fill="none"` / `stroke="currentColor"`), `class="size-6 text-primary"`. Layouts own the title text so the login `<h1>` has real heading content (vuejs-accessibility `heading-has-content`).

- With visible title (expanded sidebar, login heading): SVG `aria-hidden="true"`.
- Collapsed: `aria-label="t('layout.title')"`, `role="img"`.
- Keep `data-testid="app-sidebar-brand"` on the sidebar wrapper; add `data-testid="app-brand-mark"` on the SVG.

Duplicate the path into the Vue file from `app-mark.svg` (comment pointing at the asset). Do not add an SVG-component loader.

**Why not Iconify / `i-lucide-clock`:** this is a unique mark, not a stock clock.

**Why not `?raw` + `v-html`:** extra indirection for a 3-shape icon.

### D4: Favicon via `useHead` + replace `public/favicon.ico`

In `app/app.vue` `useHead` (alongside existing `htmlAttrs`):

- `{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }`
- `{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }`

Overwrite `public/favicon.ico`. Browsers still request `/favicon.ico` even when an SVG link exists.

**Why not `nuxt.config` `app.head` only:** `app.vue` already owns document head locale attrs; keep favicon links next to that.

### D5: Drop `layout.brandShort`

Collapsed accessible name is `layout.title`. Remove `brandShort` from `en.json` / `pl.json` when unused.

## Risks / Trade-offs

- **[Risk] 16×16 ring+hand turns into a blob** → Thick stroke, no extra ticks; verify the tab icon in light and dark.
- **[Risk] Glyph and app-icon paths drift** → Same numbers as D1 in both files; comment each file at the other.
- **[Risk] Aggressive favicon cache** → New SVG link (`type=image/svg+xml`) is the primary; ICO is fallback only.
- **[Risk] Hardcoded `#06b6d4` in the favicon vs REQ-160** → Allowed only on the favicon asset (REQ-267); chrome uses `text-primary`.

## Migration Plan

- Front-end assets and layouts only. No DB/API.
- Rollback: revert the commit (restores the Nuxt ICO and `brandShort` text).

## Open Questions

None — Clock-O geometry, two-variant assets, inline Vue mark, and favicon wiring are locked to the specs.
