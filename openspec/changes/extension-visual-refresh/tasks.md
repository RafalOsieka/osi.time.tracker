# Tasks

All work is frontend (`apps/extension`). There are no backend or API changes. The extension browser specs (`test/browser`) are the E2E suite for its forms and flows.

## 1. Nuxt UI toolchain (frontend setup)

- [ ] 1.1 Add `@nuxt/ui` (4.11.3, as in web), `tailwindcss` and `@iconify-json/lucide` to `apps/extension`. Register `ui()` in `vite.config.ts` with the D1 options. Add `src/assets/css/main.css` with the Tailwind and Nuxt UI imports and the D5 light-mode warning override. Add the `isolate` root class and `app.use(ui)` plus `UApp` (with the Nuxt UI locale following `useExtensionI18n`) to both entries. Verify that `pnpm --filter @osi/extension build` succeeds and that the existing unit and browser specs still pass.
- [ ] 1.2 Add the `#build/ui` `paths` to `apps/extension/tsconfig.json` and make the extension `type-check` script build first (design Risks). Verify that `pnpm type-check` passes from a clean `node_modules/.nuxt-ui`.
- [ ] 1.3 Register the same `ui()` plugin in the unit Vitest project and install `@nuxt/ui/vue-plugin` in the SSR render helper used by `approval-panels.spec.ts`. Extend `unpacked-output.spec.ts` to assert that no built file references `api.iconify.design` or another remote origin. Verify with `pnpm --filter @osi/extension test:unit`.

## 2. Brand mark and icons (frontend)

- [ ] 2.1 Rasterize `apps/web/public/favicon.svg` once with a `pnpx` CLI into `apps/extension/public/icons/icon-{16,32,48,128}.png` (D3), and declare them under `icons` and `action.default_icon` in `manifest.ts`. Extend `unpacked-output.spec.ts` so that every manifest icon path exists in `dist` as a PNG with the declared pixel size, and fails otherwise (REQ-410). Verify with `pnpm --filter @osi/extension build` and that spec, plus a visual check of the 16 px icon in the Chrome toolbar.
- [ ] 2.2 Add `src/ui/BrandMark.vue` (D2: an inline copy of the glyph in `currentColor`, `text-primary`, `role="img"` labelled "OSI Time Tracker", and a header comment naming the canonical file). Verify with a unit SSR test of the role, the accessible name and the `text-primary` class.
- [ ] 2.3 Add the extension's `BrandMark.vue` and the four PNGs, with the command used to cut them, to the "Derived assets" comment in `apps/web/app/assets/icons/app-mark.svg`. Verify by reading the comment against the ui-theming REQ-368 scenario "Extension copies are traceable to the glyph".

## 3. Theme (frontend)

- [ ] 3.1 Implement `src/composables/use-extension-theme.ts` (D4) and `public/theme-init.js`, and reference the script from both HTML heads. Verify with a unit spec: the default is `light`, an unknown stored value or a throwing storage falls back to `light`, `setTheme('dark')` persists the value and toggles `.dark`, and a `storage` event switches the theme.
- [ ] 3.2 Add the Theme `USelect` (Light/Dark, `data-testid="theme"`) to the options header, with `app.theme`, `app.themeLight` and `app.themeDark` in `en`/`pl`. Extend `options-ui.spec.ts`: with `colorScheme: 'dark'` emulated and no stored theme, `<html>` has no `.dark`. After Dark is selected, a newly opened popup and a reloaded options page have `.dark` at `DOMContentLoaded`. Verify with `pnpm test:extension` and `pnpm lint` (i18n parity).

## 4. Popup (frontend)

- [ ] 4.1 Rebuild `PopupPage.vue` per D6 and `mockups/popup.html`, keeping `saved-websites`, `saved-trackers` and `open-options`. Add a `popup-status` badge, the missing-access alert, the error alert with retry, and the provider avatar plus the "No access" badge on rows. Add the new `en`/`pl` keys (`app.statusOk`, `app.statusAttention`, `approvals.noAccess`, and the shortened popup texts). Update `options-ui.spec.ts` popup assertions for the new list markup and add one asserting the badge text with a revoked host permission. Verify with `pnpm test:extension` and `pnpm lint`.

## 5. Options page (frontend)

- [ ] 5.1 Rebuild `WebsiteApprovals.vue` and `DestinationApprovals.vue` per D6 and `mockups/options.html`. Use `UCard`, `UForm`, `UFormField`, `UInput` and `USelect`; per-row `UBadge`; a restore `UButton`; and an icon-only revoke `UButton` inside a `UTooltip`. Keep every `data-testid`, `aria-invalid`, the error ids and the origin-bearing accessible names. Update `approval-panels.spec.ts` to the new markup without dropping an assertion. Verify with `pnpm --filter @osi/extension test:unit`.
- [ ] 5.2 Rebuild the `OptionsPage.vue` header (`BrandMark`, title, manifest version, Language `USelect`) and the status, error and missing-access alerts. Delete the unused `ExtensionShell.vue`. Replace the `selectOption` steps in `options-ui.spec.ts` with opening the `USelect` and choosing the option by role, keeping every existing assertion. Verify with `pnpm test:extension`, including the keyboard approve and revoke journey.

## 6. Integration

- [ ] 6.1 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit` and `pnpm test:extension`. Then load `apps/extension/dist` unpacked and compare the popup, options page and toolbar icon in light and dark theme with `mockups/popup.html`, `mockups/options.html` and `mockups/toolbar-icons.html`. Also check keyboard-only operation and that an offline popup renders all icons.
