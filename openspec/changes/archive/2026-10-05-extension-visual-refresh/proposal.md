# Proposal

## Why

The extension popup and options page are bare HTML with system fonts. They have no brand, no dark mode, and Chrome shows a generic letter tile as the toolbar icon. They do not look like they belong to OSI. The roadmap lists "further UI development" for the extension, and this change is its visual first step.

## What Changes

- Both extension pages are rebuilt with Nuxt UI 4 in plain Vue + Vite mode (no Nuxt). They use the same components and `cyan`/`slate` palette as the app: `UCard`, `UFormField`, `UInput`, `USelect`, `UButton`, `UBadge`, `UAlert`, `UAvatar`, `UTooltip`. Icons are bundled at build time, never fetched.
- Both page headers show the app brand mark (open dial), tinted `primary`. It comes from an extension copy of the canonical glyph that references its source.
- The extension gets toolbar and extensions-page icons (16/32/48/128 PNG). They are cut once from the tab-icon tile and committed. The canonical glyph lists them as derived assets to regenerate.
- A **Theme** select (Light / Dark) sits next to Language in the options header. Light is the default and there is no "system" option. The choice persists across popup and options and applies before first paint.
- In light mode, warnings use the darker `yellow-600` step for readability.
- Popup: a status badge (Ready / Needs attention), a short missing-access alert, bordered lists with provider tiles, and a full-width "Open setup" button.
- Options: an approval card per section with an inline add form, per-row access badge, restore and revoke actions, and the refresh hint as the card footer.
- Copy updates in `en`/`pl` for the new labels (status badge, theme, access badge, shorter popup texts).
- Visual reference: `mockups/popup.html`, `mockups/options.html`, `mockups/toolbar-icons.html`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `remote-browser-extension`: new requirements for the extension pages' visual language and the extension theme control.
- `ui-theming`: REQ-368 lets the extension keep its own glyph copy and a committed PNG icon set, both listed as derived assets.

## Non-goals

- Any behavior change to approvals, permissions, the bridge or the worker (badge on the toolbar icon, "approve this site" shortcut).
- A "system" theme option in the extension, or syncing the theme with the web app.
- Changing the web app's warning shade or primary button contrast.
- Publishing the extension to a store.

## Impact

- `apps/extension`: Vite config (Nuxt UI plugin), the `manifest.ts` icons, committed `public/icons/*.png`, the popup and options pages, a brand-mark copy, a theme composable and pre-paint script, and the `en`/`pl` catalogs.
- `apps/web/app/assets/icons/app-mark.svg`: the derived-assets comment gains the extension entries.
- Dependencies: `@nuxt/ui`, `tailwindcss` and `@iconify-json/lucide`. The PNGs come from a one-off `pnpx` rasterizer, as `favicon.ico` did, so no dependency is added for them.
- Extension browser tests: language and select steps move from native `<select>` to the Nuxt UI select. Assertions stay keyed on `data-testid`.
