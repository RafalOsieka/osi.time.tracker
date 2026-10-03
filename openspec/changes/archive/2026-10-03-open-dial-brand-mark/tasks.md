# Tasks

> **Backend:** none. This change touches static assets, one presentational Vue component, the client-side PDF builder, and their tests. No server routes, database, or shared types are affected.

## 1. Canonical glyph (frontend / assets)

- [x] 1.1 Replace the body of `apps/web/app/assets/icons/app-mark.svg` with the D1 elements: the dial path and crossbar in a `fill="none" stroke="currentColor"` group with round caps and joins (strokes `2` and `2.6`), plus the filled stem polygon with a `0.4` stroke. Keep `viewBox="0 0 24 24" fill="currentColor"` on the root. Verify that the file's only colour is `currentColor` and that it renders identically to `docs/brand/app-mark-b7.svg` side by side.
- [x] 1.2 Rewrite the header comment so it names this change and points to `design.md` D1 as the geometry source. Verify that it still lists the three derived tiles and the `.ico` by path.

## 2. Derived tiles (frontend / assets)

- [x] 2.1 Regenerate `apps/web/public/icon.svg`, `favicon.svg` and `favicon-running.svg` by placing the new glyph inside each file's existing nested `<svg>`, with `#fff` substituted for `currentColor`. Keep the `rect` fills and the glyph boxes (75% / 88% / 88%). Update each header comment to point to D1. Verify that `favicon-running.svg` differs from `favicon.svg` only in the tile fill and comment, and that `icon.svg` differs only in the glyph box and comment.
- [x] 2.2 Regenerate `apps/web/public/favicon.ico` (32×32) from `favicon.svg` with a one-off `pnpx` rasterizer. Verify that `git diff --stat` shows no `package.json` or lockfile change and that the `.ico` opens as the new mark.

## 3. Component (frontend)

- [x] 3.1 Replace the inline elements in `apps/web/app/components/AppBrandMark.vue` with the D1 elements. Leave the `collapsed` prop, `data-testid`, `role`/`aria-label` wiring and `class="size-6 shrink-0 text-primary"` unchanged. Update the template comment to point to this change's D1. Verify that the rendered markup has no hex colour and that grepping the file for `running` and `green` finds nothing.
- [x] 3.2 In `apps/web/test/nuxt/theme-render.spec.ts`, update the REQ-369 comment that mentions lattice `<circle>` elements so it describes the new glyph. Change no assertion. Verify that `pnpm test:nuxt` passes.
- [x] 3.3 In `apps/web/app/layouts/auth.vue`, wrap the title in a span trimmed to cap height (`text-box: trim-both cap alphabetic`), so the heavier mark centres on the letters rather than on the line box. Verify on the login page that the mark's centre and the caps' centre coincide.

## 4. PDF logo from the canonical glyph (frontend / utility)

- [x] 4.1 In `apps/web/test/unit/build-client-report-pdf.spec.ts`, add a title-page test that imports `app-mark.svg?raw`. It must check that every `d` path from the glyph appears in the PDF logo SVG and that the logo contains no `currentColor`. Verify that it fails against the current pasted `LOGO_SVG`.
- [x] 4.2 Replace `LOGO_SVG` in `apps/web/app/utils/client-report/build-client-report-pdf.ts` with a tile built from the `?raw` import, as described in design D3. Verify that the new unit test and the rest of `pnpm test:unit` pass.
- [ ] 4.3 Export a client report PDF in the app and compare its title-page mark with `public/icon.svg`. Verify that the dial, its open quadrant and the "T" match.

## 5. Integration checks

- [x] 5.1 Run `pnpm test:unit` (favicon href contract) and `pnpm test:e2e:ui -t "swaps the document favicon"` against the new assets. Verify that both pass unchanged.
- [ ] 5.2 Check the mark in the expanded and collapsed sidebar and on the login heading, in light and dark mode. Verify that it takes the `primary` colour in all four cases and is not clipped when collapsed.
- [ ] 5.3 Check the tab icon in a fresh browser profile at idle and with a timer running, on light and dark tab strips. Verify that the open quadrant and the stem tip of the "T" are still distinguishable at 16 px. If the tip disappears, widen it to `1.0` in D1 and in every asset.
- [x] 5.4 Delete `docs/brand/` (the B7 working copy, never committed) once task 1.1 has landed. Verify that `git status` shows no `docs/brand` entry.
- [x] 5.5 Run `pnpm lint`, `pnpm format:check` and `pnpm type-check`. Verify that all three pass before opening the PR.
