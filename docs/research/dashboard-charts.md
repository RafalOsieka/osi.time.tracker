# Dashboard charts: how to render them

Research, 2026-11-24. Question: how should a new server-rendered Dashboard page draw stacked bars with a share breakdown, a 12-month calendar heatmap, a weekday x hour heatmap, and stat tiles?

## Recommendation

**Write small Vue components of our own: HTML and CSS grid for bars, shares and heatmaps, inline SVG only where a path is needed (sparkline). Install nothing.** Reuse `StatCard` for tiles (`apps/web/app/components/StatCard.vue`) and `UTooltip` for hints.

**Fallback: Nuxt UI's `UChart`**, which is already in the installed 4.12.0 and needs one optional peer, `@tanstack/charts`. Switch the bar chart to it if the page grows real axes, lines, areas or brushing. It was not on the original list; it beats every library that was.

Why:

1. **Server markup equals final markup.** Percentages and grid tracks need no measured width, so nothing is hidden, resized or drawn after hydration. Unovis, Chart.js, vue-echarts and nuxt-charts bars all sent an empty host from the server in our test; `UChart` sends a real SVG, but hides it until measured when `height` is fixed.
2. **The heatmaps are ours to build either way.** Two of the three charts are plain grids of cells, and no option gives us calendar semantics, translated labels, keyboard cells and a text alternative out of the box. A library would then serve one chart, for 45-197 kB gzip (b, d3, excepted at 13 kB).

Main risk: we own the interaction and accessibility code (roving focus, tooltip, text alternative), and it must be tested. Second: nobody can tell nine series apart by color alone (see Colors), whichever option we pick.

## Evidence labels

- **[M]** measured here. Scratch Nuxt app outside the repository: Nuxt 4.6.4, Vue 3.5.45, `@nuxt/ui` 4.12.0, nuxt-security 2.7.0 with our CSP overrides; `nuxt build`, then each page fetched from the built server.
- **[S]** package source, as installed. **[D]** official documentation. **[R]** npm registry or GitHub API on 2026-11-24.

Size [M] is the JS a page needs beyond a baseline page with a `UTooltip` and a link: gzip of every statically imported chunk. One build for all rows; one-off imports and shared chunks make it accurate to a few kB. Each library page draws two to four bars and registers the pieces named in the table.

## Comparison

|                                                       | (a) own HTML/SVG            | (b) own + d3                                     | (f) `UChart`                                   | (c) Unovis         | (c') nuxt-charts 3                   | (d) Chart.js                                       | (e) ECharts                                        |
| ----------------------------------------------------- | --------------------------- | ------------------------------------------------ | ---------------------------------------------- | ------------------ | ------------------------------------ | -------------------------------------------------- | -------------------------------------------------- |
| Server markup [M]                                     | full                        | full                                             | SVG; hidden until measured with fixed `height` | empty divs         | bars: empty div; heatmap: full HTML  | empty `<canvas>`                                   | empty host                                         |
| Added JS, min / gzip [M]                              | 0.6 / 0.4 kB (trivial page) | 39.8 / 13.3 kB                                   | 158.4 / 53.0 kB                                | 136.1 / 45.1 kB    | not measured                         | 160.8 / 55.2 kB                                    | 588.3 / 196.8 kB                                   |
| Fits our CSP (from source and header, no browser run) | yes                         | yes                                              | yes                                            | yes                | yes                                  | yes                                                | yes                                                |
| Stacked bars / calendar / 7x24                        | build each                  | build each                                       | yes / via `definition` / via `definition`      | yes / yes / yes    | yes / build / yes                    | yes / plugin / plugin                              | yes / yes / yes                                    |
| Theme by CSS variables                                | yes                         | yes                                              | yes                                            | yes, own names     | yes                                  | no (canvas)                                        | partial                                            |
| Keyboard and names built in                           | none                        | none                                             | focus, arrow keys, name                        | name only          | heatmap: grid, arrows, sr-only table | none                                               | name text only                                     |
| License [R]                                           | -                           | ISC                                              | MIT                                            | Apache-2.0         | MIT                                  | MIT                                                | Apache-2.0 (wrapper MIT)                           |
| Version, published [R]                                | -                           | d3-scale 4.0.3, d3-shape 3.2.1 (both 2026-11-03) | charts 1.5.0 (2026-11-07)                      | 1.8.1 (2026-11-10) | 3.3.0 (2026-11-17)                   | 4.6.2 (2026-11-23), vue-chartjs 5.3.7 (2026-11-20) | 6.1.0 (2026-05-19), vue-echarts 8.3.2 (2026-10-09) |
| Vue / Nuxt support [R]                                | -                           | none needed                                      | peer Vue >=3.5                                 | peer Vue ^3        | peer Vue ^3.5.0                      | peer Vue ^3                                        | peer Vue ^3.3, `@nuxt/kit` ^4.5.2                  |

All listed repositories are unarchived and were pushed to in October or November 2026 [R]. Every page built and rendered on the server with Nuxt 4.6.4 and Vue 3.5.45 [M]. Browser hydration was **not** tested (see Not verified).

### (a) Own components

- Stacked bar: a flex column of segments with percentage heights. Share: one horizontal bar plus a list of name, hours and percent. Heatmaps: CSS grid, 7 rows by 53-54 columns and 7 by 24. A few hundred elements.
- Axis: hours only, so a short helper rounding the maximum up to a 1/2/4/8 step replaces `scale.nice()`.
- Tooltip: **one** `UTooltip` per chart, moved with its `reference` prop and `open`, not 365 instances. Nuxt UI does this itself in `UChart` (`@nuxt/ui/dist/runtime/components/Chart.vue:304-310`; prop at `Tooltip.vue:24,58`).
- Keyboard: one tab stop per chart, arrow keys between cells. nuxt-charts' heatmap is a useful reference: `role="grid"`, one `tabindex="0"` cell with the rest `-1`, an `aria-label` per cell, and a visually hidden table [M].
- Text alternative: a table of the same numbers, visually hidden or behind a toggle.
- Dynamic geometry as `:style` has precedent (`apps/web/app/components/ColumnList.vue:44,57`). Color stays in classes.

### (b) Own plus d3-scale and d3-shape

Same markup as (a), server-renders [M]. We need one linear scale and one running sum; 13 kB gzip buys little. `d3-shape` helps only with curves or arcs.

### (f) Nuxt UI `UChart` (added)

- Added in 4.12.0; `line`, `area`, `bar`, `donut`, plus `stacked` ([release](https://github.com/nuxt/ui/releases/tag/v4.12.0), [docs](https://ui.nuxt.com/docs/components/chart), `Chart.d.vue.ts:24-55`). Optional peer `@tanstack/charts` ^1 (`@nuxt/ui/package.json:209`).
- SSR [M]: complete SVG with axes. With fixed `height` the host is `opacity-0` until measured (`Chart.vue:255,262`; theme `base: "opacity-0 in-data-measured:opacity-100"`); with `aspect-ratio` it shows at once ([docs, Size](https://ui.nuxt.com/docs/components/chart), [PR 7022](https://github.com/nuxt/ui/pull/7022)). The server draws at `initialWidth` 640, so the plot is laid out again at the real width and with browser text metrics ([SSR guide](https://tanstack.com/charts/latest/docs/guides/ssr-and-hydration)).
- CSP: inline `style` attributes (8 on the test page) [M]; no `eval` or `new Function` found in its `dist` [S].
- Accessibility: `role="img"`, `aria-label`, `tabindex="0"`; marks and axes are `aria-hidden` [M]. Arrow, Home and End move focus (`@tanstack/charts/dist/interaction.js:52-72`). Hence no text alternative: TanStack says the application owns the exact-value alternative ([guide](https://tanstack.com/charts/latest/docs/guides/accessibility)).
- Theming: series read `--ui-chart-1..6`; a seventh series repeats as a lighter tint (`Chart.vue:60,74-82`).
- Heatmaps: no `heatmap` type; a TanStack `cell` mark through `definition` server-renders with our token colors [M] ([`cell`](https://tanstack.com/charts/latest/docs/reference/marks/bar-and-rect)). Calendar placement stays ours.
- Maturity [R]: npm package created 2026-07-29 (under four months old), 1.0.0 on 2026-10-03 and six releases since. Pulls 13 d3 packages at install. Nuxt UI 4.13.0 already changed it ([#7234](https://github.com/nuxt/ui/pull/7234), animated data changes).
- Install note [M]: pnpm 12 listed the package under "awaiting approval: skills". We approved nothing.

### (c) Unovis 1.8.1

- Server output is the container and empty component divs, no SVG [M].
- Has `StackedBar`, `Axis`, `Tooltip` and a `Heatmap` with 7 rows and column fill for a calendar ([config](https://unpkg.com/@unovis/ts@1.8.1/components/heatmap/config.d.ts)).
- CSP: injects a `<style>` element at run time, with an optional `UNOVIS_NONCE` ([css.js](https://unpkg.com/@unovis/ts@1.8.1/styles/css.js)). Allowed by our policy.
- Theming by `--vis-*` variables ([guide](https://unovis.dev/docs/guides/theming/)). Its dark variants bind to `theme-dark`, `dark-theme` or `data-theme="dark"`, **not** `.dark` ([theme.js](https://unpkg.com/@unovis/ts@1.8.1/utils/theme.js)), so we would map every variable.
- Accessibility: the container takes `ariaLabel` ([core](https://unpkg.com/@unovis/ts@1.8.1/core/container/index.js)); no key handling or `tabindex` found in the parts checked (containers, core, bar, heatmap, tooltip) [S].
- `@unovis/ts` depends on three, leaflet, maplibre-gl and elkjs [R]: install weight, tree-shaken from the page.

### (c') nuxt-charts

**3.x is no longer built on Unovis**; it uses vccs, a Vue port of Recharts ([README](https://unpkg.com/nuxt-charts@3.3.0/README.md), dependencies [R]). Unovis remains under `vue-chrts` 2.2.4 [R]. Only `HeatmapChart` and the two maps are registered for SSR; every other chart has `mode: "client"` ([module.mjs:24-35](https://unpkg.com/nuxt-charts@3.3.0/dist/module.mjs)), confirmed by an empty bar page [M]. The heatmap colors with `color-mix` in inline styles and defaults to quantile bins, and is not a calendar. Its README says it follows Nuxt UI tokens and the install command still uses `@next`.

### (d) Chart.js with vue-chartjs

`<canvas role="img">` and nothing else on the server [M]. Canvas content is not accessible to screen readers ([docs](https://www.chartjs.org/docs/latest/general/accessibility.html)). Colors are passed as values ([docs](https://www.chartjs.org/docs/latest/general/colors.html)), so tokens must be resolved in the browser and charts updated on theme change. Heatmaps need [`chartjs-chart-matrix`](https://github.com/kurkle/chartjs-chart-matrix) 3.1.0. No `eval` or `new Function` found in `chart.js/dist/*.js` [S]. Vue 3.5 peer OK. The version measured was 4.6.1.

### (e) ECharts with vue-echarts / nuxt-echarts

- `VChart` renders only the host on the server ([README](https://unpkg.com/vue-echarts@8.3.2/README.md)) [M]. nuxt-echarts can send SVG through server components ([README](https://unpkg.com/nuxt-echarts@1.1.0/README.md)); not tested.
- ECharts' own SVG string needs a given width and height; it carries a `<style>` element and inline styles, default colors are literal hex, and `aria.enabled` added no `aria-label` to the string [M]. A `var(--ui-primary)` series color passed through as a `fill` [M]; canvas and derived colors are not verified.
- In the browser `aria` yields one generated label ([handbook](https://echarts.apache.org/handbook/en/best-practices/aria/)); translating it to Polish is unverified.
- `new Function` exists only as a fallback when `JSON` is undefined, for GeoJSON strings (`echarts/lib/coord/geo/GeoJSONResource.js:143`) [S].
- Largest by far; calendar and heatmap are first class.

## CSP

**nuxt-security's default `style-src` is `'self' https: 'unsafe-inline'`** (`nuxt-security/dist/defaultConfig.mjs:17`, [docs](https://nuxt-security.vercel.app/headers/csp)). **Our config does not change it.** It sets only `img-src` (same as the default) and `connect-src` (`apps/web/nuxt.config.ts:113-124`), and does not enable `strict`, whose `style-src` would be nonce-only (`defaultConfig.mjs:105`). The built test server sent:

```
style-src 'self' https: 'unsafe-inline'; script-src 'self' https: 'unsafe-inline' 'strict-dynamic' 'nonce-…'; img-src 'self' data:; …
```

- Inline `style` attributes and injected `<style>` elements work today, so CSP separates none of the options. `script-src` has no `'unsafe-eval'`; no option needs it on the paths we would use.
- "Strict CSP" therefore describes scripts, not styles. If `style-src` is ever tightened, server-rendered `style="…"` attributes are blocked ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src)). That would hit Nuxt UI and `ColumnList` as well. SVG geometry attributes (`x`, `width`, `height`) are not style attributes, so an SVG bar would survive it.
- `img-src` allows `data:` but not `blob:`, which matters only for exporting a chart as an image.

## Colors

### What we have

- Nuxt UI 4.12: `--ui-chart-1..6` = primary, blue, violet, amber, rose, cyan; 500 in light, 400 in dark ([docs](https://ui.nuxt.com/docs/getting-started/theme/css-variables), `@nuxt/ui/dist/runtime/index.css:1`). No sequential scale is documented there.
- Tailwind 4 ramps from 50 to 950 (`tailwindcss/theme.css`), semantic `--ui-*`, and `cyan`/`slate` as `primary`/`neutral` (`apps/web/app/app.config.ts:24-28`).
- No project color in the database schema (`apps/web/server/db/schema`).

### Caveats, computed [M]

WCAG contrast from the oklch values in `tailwindcss/theme.css`: light on white, dark on our dark card (`oklch(25% 0.02 262)`, `apps/web/app/assets/css/main.css:107`). Color distance is OKLab Euclidean; protan and deutan use Machado severity-1 matrices.

1. **`--ui-chart-1` and `--ui-chart-6` collide here.** Primary is cyan; in dark mode both are exactly `cyan-400`. In light mode they are `cyan-700` and `cyan-500`.
2. **Defaults miss 3:1 in light mode:** `amber-500` 2.15, `cyan-500` 2.36 (blue 3.76, violet 4.40, rose 3.76, primary 5.28 pass). On our slate canvas amber-600 (2.94) and lime-600 (2.81) fail too. All default dark values pass (5.6-9.3).
3. **`blue-500`/`violet-500` are nearly one color for deutan viewers** (distance 0.014; 0.003 for the 400s), and adjacent in the default order.
4. **Eight hues plus "other" cannot be told apart by color alone.** A randomized search over Tailwind 500-800 (light) and 300-600 (dark) at 3:1 found at best 0.019 (light) and 0.090 (dark) for the worst pair under normal, protan and deutan vision. It is a heuristic, not a proof.

### Proposal

- Define our own `--chart-1..8` and `--chart-other` in `main.css`, in `:root` and `.dark`, and expose them with `@theme inline` as classes (`bg-chart-1`). Pick classes from a static map, never an inline color. This keeps the "no inline colors" rule and flips with `.dark` without JavaScript.
- Candidate light set: `cyan-700, amber-700, violet-600, emerald-600, rose-600, blue-600, orange-600, fuchsia-700`, other `slate-500`: at least 3.59:1 on white. Dark: the `400` of each hue, other `slate-500` (3.36). Neighbors in this order are at least 0.067 (light) and 0.053 (dark) apart for protan and deutan viewers, but a segment missing on a day brings others together, and `blue`/`violet` are 0.004 apart for deutan. Review it when designed.
- Do not rely on it: 2 px surface-colored gap between segments, names and hours beside the bar, tooltip and table. Cap at fewer series if eight proves unreadable; the share list needs no color to be read.
- Assign a color by a stable key, not by rank, or colors jump when the period changes.
- Sequential (both heatmaps): one hue, zero = neutral, then four `cyan` steps. Light `200/400/600/800`, dark `900/700/500/300`. The palest steps are below 3:1 (light 200: 1.25, 400: 1.81; dark 900: 1.76). Give each cell a `ring`, the same width in every state, plus a legend with hour ranges and text on focus. W3C lists color gradients that represent a measurement, such as heat maps, as an example of the WCAG 1.4.11 "essential" exception ([Understanding 1.4.11](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html)); the text alternative is still required.

## Repository constraints used

- WCAG 2.1 AA, non-color status: `docs/behavior/ui-accessibility.md:53`; keyboard `:39`; themed tooltip on hover and focus `:76`.
- No component-level hardcoded or inline colors: `docs/behavior/ui-theming.md:11,63` (stated for the accent and the auth surface); tokens: `docs/coding-standards.md:60`. No flash under SSR: `ui-theming.md:49`.
- Tooltips are `UTooltip`: `docs/coding-standards.md:59`. Timezone formatting: `:113-114`.
- Installed versions: nuxt 4.6.4, vue 3.5.45, @nuxt/ui 4.12.0, tailwindcss 4.3.5, nuxt-security 2.7.0.

## Not verified

- No browser run: hydration warnings, layout shift, and live CSP enforcement of each library were not seen. SSR markup and the response header were.
- No screen reader run of any option, nor WCAG conformance of any library.
- nuxt-charts 3 bundle size, nuxt-echarts server components, ECharts keyboard behavior, Nuxt UI 4.13.1.
- Size of option (a) is a trivial page; the real components will be larger, all first-party code.
- The candidate palette with real users or a rendered page; only the computed distances above.

## Open questions

1. Should projects keep a stable color (a stored field, or a hash of the id)? Otherwise it needs a rule that survives changing the period.
2. Is the visible table behind a toggle, or a visually hidden one enough?
3. Maximum number of series before "other": eight, or fewer (five or six read better)?
4. Is the Dashboard meant to grow lines, areas or zoom? If so, take `UChart` for those.
