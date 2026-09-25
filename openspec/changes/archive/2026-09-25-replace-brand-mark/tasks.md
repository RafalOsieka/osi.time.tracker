> **Backend:** none. This change touches static assets, one presentational Vue component, and one test. No server routes, database, or shared types are affected.

## 1. Canonical glyph (frontend / assets)

- [x] 1.1 Replace `apps/web/app/assets/icons/app-mark.svg` with the D1 geometry: dial group (`fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"`, four arcs at `rotate(0|90|180|270 12 12)`), five monogram cells, eight `r 0.2` points; root keeps `viewBox="0 0 24 24" fill="currentColor"`. Verify the file contains exactly one colour literal (`currentColor`) and renders identically to the design table when opened at 400px.
- [x] 1.2 Update the file header comment to name this change and point at `design.md` D1 as the geometry source. Verify the comment lists the three derived tiles by path.

## 2. Derived tiles (frontend / assets)

- [x] 2.1 Regenerate `apps/web/public/icon.svg` — 32×32, `rect rx=8 fill="#06b6d4"`, glyph in `<g transform="translate(4 4)">` at 24×24 with `currentColor` substituted for `#fff`. Verify the glyph's outermost geometry stays inside the central 80% circle (REQ-368 maskable scenario).
- [x] 2.2 Regenerate `apps/web/public/favicon.svg` — same tile, glyph at `translate(2 2)` and 28×28 (88%). Verify it differs from `icon.svg` only in the transform and size pair.
- [x] 2.3 Regenerate `apps/web/public/favicon-running.svg` — identical to `favicon.svg` with the tile fill changed to `#16a34a` and **no** badge circle. Verify a diff against `favicon.svg` shows one changed attribute and one removed element.
- [x] 2.4 Regenerate `apps/web/public/favicon.ico` (32×32) from the 88% tab tile using a one-off `pnpx` rasterizer; add no dependency to `package.json`. Verify `git diff --stat` shows no `package.json` change and the `.ico` opens as the new mark.

## 3. Component (frontend)

- [x] 3.1 Replace the inline paths in `apps/web/app/components/AppBrandMark.vue` with the same elements as 1.1, keeping `data-testid`, the `collapsed` prop, `role`/`aria-label` wiring, and `class="size-6 shrink-0 text-primary"` untouched. Verify `pnpm lint` passes and the rendered markup carries no hex colour.
- [x] 3.2 Confirm no state prop is introduced (REQ-369: the in-app mark never signals running state). Verify by grepping the component for `running`, `green`, and `#` and finding no match.
- [x] 3.3 Update the stale traceability comment in `apps/web/app/utils/favicon.ts` from `REQ-268` to `REQ-369`. Comment only — verify `git diff` shows no change to the exported functions and that `pnpm test:unit` still passes.

## 4. Tests (frontend)

- [x] 4.1 Restate the brand-mark invariant in `apps/web/test/nuxt/theme-render.spec.ts`: drop `not.toMatch(/<circle/i)`, keep `not.toContain('#22c55e')`, and add an assertion that the component's rendered HTML is identical with `runningState` set and unset. Verify `pnpm test:nuxt` passes and that the new assertion fails if a state-dependent element is deliberately added.
- [x] 4.2 Run `pnpm test:unit` to confirm `favicon-svg-href.spec.ts` still passes unchanged (href contract untouched by this change).
- [x] 4.3 Run `pnpm test:e2e:ui -t "swaps the document favicon"` to confirm the idle/running href swap still works against the new assets.

## 5. Visual verification

- [x] 5.1 Check the mark in the expanded and collapsed sidebar and on the login heading, in light and dark mode. Verify the glyph takes the `primary` colour in all four combinations and is not clipped when collapsed.
- [x] 5.2 Check the tab icon in a fresh browser profile (favicons cache aggressively) at idle and with a timer running, on a light and a dark tab strip. Verify the running state is recognisable without comparing side by side.

## 6. Cleanup

- [x] 6.1 Remove `docs/brand/logo-proposals/` and unstage it (the directory is currently staged in git). Do this only after task 1.1 has landed, since it holds the only other copy of the chosen geometry. Verify `git status` shows no remaining `docs/brand` entries.
- [x] 6.2 Run `pnpm lint`, `pnpm format:check`, and `pnpm type-check`. Verify all three pass before opening the PR.
