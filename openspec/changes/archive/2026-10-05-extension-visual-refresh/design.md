# Design

## Context

- `apps/extension` is a plain Vue 3 + Vite+ build. It has two HTML entries (`src/popup`, `src/options`), a module service worker and a separately built content script. Its manifest sets `content_security_policy.extension_pages` to `script-src 'self'; object-src 'self'`.
- The UI is four SFCs with native elements and roughly 20 lines of scoped CSS each: `PopupPage`, `OptionsPage`, `WebsiteApprovals`, `DestinationApprovals`. `ExtensionShell.vue` is unused. State lives in `useApprovalsEditor`, and locale in `useExtensionI18n`, a `localStorage` key synced with the `storage` event. Neither changes.
- The web app runs `@nuxt/ui` 4.11.3, `tailwindcss` 4.3.3 and `@iconify-json/lucide`, with `primary: cyan` and `neutral: slate`.
- The canonical glyph is `apps/web/app/assets/icons/app-mark.svg`. Its header comment lists hand-maintained derived assets: the favicon tiles and `favicon.ico`. The web app's `AppBrandMark.vue` is an inline copy of its geometry.
- Tests: unit specs SSR-render the approval panels (`approval-panels.spec.ts`), `unpacked-output.spec.ts` checks the built `dist`, and the browser spec `options-ui.spec.ts` drives native `<select>`s with `selectOption`.
- Visual reference: `mockups/popup.html`, `mockups/options.html`, `mockups/toolbar-icons.html`. They are static and show both themes side by side. Nuxt UI renders the real components, and the mockups show only hierarchy, spacing and colors.

## Goals / Non-Goals

**Goals:**
- The extension looks like the app, with the components and tokens the app already uses.
- No runtime network access from extension pages, and the CSP stays unchanged.
- Only presentation changes. The approval/permission flow, `data-testid`s and i18n mechanics stay as they are.

**Non-Goals:**
- A shared UI package between the web app and the extension.
- Pixel-identical reproduction of the mockups.

## Decisions

### D1. Nuxt UI in Vue mode, with explicit imports
Add `@nuxt/ui/vite` to the extension's Vite config with `router: false`, `colorMode: false`, `components: false`, `autoImport: false`, `icon.clientBundle.scan: true`, `experimental.componentDetection: true`, and `ui.colors` set to `cyan`/`slate`. Each entry calls `app.use(ui)` and wraps the page in `UApp`, passing the Nuxt UI locale (`en`/`pl`) that matches `useExtensionI18n`. Components are imported explicitly (`@nuxt/ui/components/Button.vue`). That matches the extension's existing explicit style and keeps `vue-tsc` independent of generated `components.d.ts`. Icons are `i-lucide-*` names bundled at build time, so no Iconify API request is made.
- *Alternative: Tailwind 4 only, with hand-built controls.* This is lighter, but it re-implements accessible select, tooltip and alert behavior that the app already gets from Nuxt UI.
- *Alternative: polish the current CSS.* This is cheapest, but the extension would keep drifting from the app.

### D2. Brand mark as an inline-SVG copy
`src/ui/BrandMark.vue` copies the geometry of `apps/web/app/assets/icons/app-mark.svg` into an inline `<svg>` drawn in `currentColor`, with the `text-primary` class, `role="img"` and the label "OSI Time Tracker". This is the same pattern as the web app's `AppBrandMark.vue`. A header comment names the canonical file as the source. The canonical file's "Derived assets" comment gains `apps/extension/src/ui/BrandMark.vue`.
- *Alternative: import the canonical file across apps (a CSS mask or `?raw`).* This avoids the copy, but it couples the extension build to `apps/web` paths for one small drawing. The glyph changes rarely, and the derived-assets list already covers regeneration.

### D3. Icons cut once and committed
The four icons are rasterized once from `apps/web/public/favicon.svg`, which already is the tab-icon tile composition (glyph at 88% on the `rx=8` `#06b6d4` tile). A one-off `pnpx` rasterizer produces them, as it did for `favicon.ico`. They are committed as `apps/extension/public/icons/icon-{16,32,48,128}.png`. Vite copies `public/` into `dist`. `manifest.ts` declares them under `icons` and `action.default_icon`. The canonical glyph's "Derived assets" comment lists the four PNGs and the command to re-cut them. The tab-icon scale is chosen because the 16 px toolbar slot is the main use.
- *Alternative: rasterize in the build with a Vite plugin.* The copy can never go stale, but it adds a native dependency and plugin code for four files that change only when the brand changes.

### D4. Own theme state, applied before paint
`useExtensionTheme()` mirrors `useExtensionI18n`. It stores `light | dark` under the `localStorage` key `osi-extension-theme`, falls back to `light` on a missing value, an unknown value or a storage error, syncs across pages through `storage` events, and toggles `.dark` on `<html>`. A classic, synchronous `public/theme-init.js` loads in both HTML heads as `<script src="/theme-init.js">`, which `script-src 'self'` allows. It reads the same key and adds `.dark` before first paint. Nuxt UI's `colorMode` is off, so nothing reintroduces a system default.
- *Alternative: `chrome.storage.local`.* It is async, so a dark user would see a light flash on every popup open.
- *Alternative: `@vueuse` `useColorMode` through Nuxt UI.* It is system-aware by design, and it initializes after the module script, so the flash remains.

### D5. Darker warning shade in light mode only
Extension `main.css` sets `:root { --ui-warning: var(--ui-color-warning-600); }`. Dark mode keeps Nuxt UI's lighter step. The web app is unchanged (proposal Non-goals).
- *Alternative: map `warning` to `amber`.* This changes the hue as well as the contrast, and the extension would drift from the app's warnings.

### D6. Components and layout
- **Popup:** a header with `BrandMark`, the title and a status `UBadge`. Below it, a `UAlert` for missing access or load errors, with the retry `UButton`. Then bordered `ul` lists of websites and trackers, where each tracker shows a provider `UAvatar` (`OP`/`RM`) and a "No access" `UBadge`. The footer is a full-width outline `UButton` that opens setup.
- **Options:** a header with the mark, the title and the version from `chrome.runtime.getManifest()`, plus `UFormField` + `USelect` for Language and Theme. The status line keeps `role="status"`. Each approval section is a `UCard`: an inline `UForm` row with `UInput`/`USelect` and a primary `UButton`, a list where each row has a badge, a restore `UButton` and an icon-only revoke `UButton` inside a `UTooltip`, and the refresh hint as the card footer.
- `ExtensionShell.vue` is deleted.
- *Alternative: keep native `<select>` for Language/Provider/Website.* Tests would stay simpler, but those controls would look different from the app's.

## Risks / Trade-offs

- [`vue-tsc` needs Nuxt UI's generated theme types (`#build/ui/*` under `node_modules/.nuxt-ui`)] → Add the `paths` from the Nuxt UI Vue guide and make the extension `type-check` script build first, so the types exist on a clean checkout and in CI. The extension tsconfig moves from `NodeNext` to `Bundler` resolution, because `NodeNext` reads `#`-prefixed specifiers as package `imports` and ignores `paths`. The extension is Vite-bundled, so `Bundler` is the accurate model anyway. A missing template makes every variant prop silently accept any value, so `src/ui/nuxt-ui-theme-guard.ts` fails the type-check instead.
- [Unit tests SSR-render panels that now use Nuxt UI components] → The unit Vitest project uses the same `ui()` plugin, and the render helper installs `@nuxt/ui/vue-plugin`. Assertions stay on `data-testid` and accessible names.
- [The browser spec drives native selects] → Replace `selectOption` with opening the `USelect` trigger (same `data-testid`) and choosing the option by role. No assertion is dropped.
- [Larger popup bundle] → `componentDetection` trims the CSS. The pages load from disk, and opening the popup is checked by hand against the current build.
- [The extension's glyph copy and PNGs can go stale after a glyph change] → Both are listed in the canonical file's derived-assets comment, and each copy names its source. This is the same rule as for the favicon tiles.
- [The pre-paint script duplicates the storage key] → The browser test asserts that `.dark` is present on first load after Dark is selected. A mismatch fails that test.
