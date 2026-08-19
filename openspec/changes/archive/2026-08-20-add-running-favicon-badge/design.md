## Context

See `proposal.md` for motivation and REQ-268 for the behavior contract.

Today `app/app.vue` sets a static pair of favicon links (`/favicon.svg` + `/favicon.ico`). Shared timer state is `useTimer().running` (`useState('timer-running-entry')`), SSR-seeded in `default.vue` (REQ-258) and mutated on start/stop. The in-app mark (`AppBrandMark`) is a separate `currentColor` glyph and must stay unbadged.

## Goals / Non-Goals

**Goals:**

- Two static SVG URLs; `useHead` picks by `running != null`.
- Running asset is the same composition as `public/icon.svg` (cyan square + white `app-mark.svg` glyph) plus a green corner dot, authored in-repo (no new drawing from the product owner).
- First HTML of an authenticated running session already references the running SVG (no idle flash).

**Non-Goals:**

- Design-level restatement of proposal non-goals (pulse, title, other tabs, PWA, badging `AppBrandMark`).
- A running `.ico` or dropping the idle `.ico` fallback.

## Decisions

### D1: Second file, not canvas / data URL

**Choice:** `public/favicon-running.svg` — same recipe as `public/icon.svg` from add-app-brand-icon: 32×32 cyan square, white glyph copied from `app/assets/icons/app-mark.svg` and translated `(4,4)`, plus:

```svg
<circle cx="26" cy="26" r="5" fill="#22c55e" stroke="#fff" stroke-width="1.5" />
```

(`#22c55e` = Tailwind green-500, same family as the live/continue control. Static hex is allowed on favicon assets, same exception as cyan on `icon.svg`.)

**Why not canvas/`toDataURL`:** extra client work, worse cache behavior, harder to snapshot in tests.

**Why not one SVG mutated in place:** browsers (Safari especially) cache by URL; a second href is the reliable swap.

**Why not a play triangle:** unreadable at 16×16 on the existing mark.

### D2: `app.vue` owns both links; href is computed from `running`

**Choice:** keep favicon `useHead` in `app.vue` (single owner). Drive the SVG `href` from `useTimer().running` via a computed `link` array:

- idle / logged-out: `/favicon.svg` + `/favicon.ico`
- running: `/favicon-running.svg` + `/favicon.ico` (ico stays the idle fallback)

Extract a tiny `faviconSvgHref(isRunning: boolean)` helper so the mapping is unit-tested without mounting `UApp`.

**Why not `useHead` in `default.vue` only:** login would need the idle links from `app.vue` anyway; two owners duplicate `rel=icon`.

**SSR order:** `app.vue` setup runs before the layout seeds `running`. The `link` entry MUST be a computed/ref so Unhead serializes the value **after** `seedRunning` in `default.vue` on the same request. Do not snapshot `running` into a one-shot plain object in `app.vue` setup.

### D3: No running `.ico`

Live tabs that honor SVG get the badge. Clients that only read `/favicon.ico` stay idle. Generating a second ICO is extra raster work for little gain.

## Risks / Trade-offs

- **[Risk] SSR head still serializes idle because `running` was read once in `app.vue`** → Mitigation: computed `link`; nuxt test with a seeded running entry on an authenticated layout asserts `/favicon-running.svg` in head.
- **[Risk] Browser keeps the idle icon after href change** → Distinct path (`favicon-running.svg`), not a query-string on the same file.
- **[Risk] Other tabs stay idle** → Accepted (REQ-268).
- **[Risk] ICO-only clients never show the badge** → Accepted (D3).

## Migration Plan

- Add one public SVG; change `app.vue` head. No DB/API.
- Rollback: delete `favicon-running.svg` and restore static `useHead` links.

## Open Questions

None — green-dot geometry, two-file swap, and `app.vue` computed head are locked to the specs.
