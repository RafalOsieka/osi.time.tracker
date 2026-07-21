## Why

PrimeVue was chosen before the app committed to a Nuxt-native path. Nuxt UI v4 (fully free and open-source) gives first-party Nuxt integration, auto-imports, native color-mode, Tailwind v4 utilities, and a free dashboard layout suite. Migrating now — while the app is still ~8 pages / ~25 components — is far cheaper than after more PrimeVue screens accrue.

## What Changes

- **BREAKING** Replace `primevue`, `@primevue/forms`, `@primeuix/themes`, and `primeicons` with the single `@nuxt/ui` dependency; adopt Tailwind v4 utility styling and Lucide (`i-lucide-*`) icons.
- Swap primitives mechanically (`Button`→`UButton`, `InputText`→`UInput`, `Dialog`→`UModal`, `Toast`/`useToast`, `Message`→`UAlert`, `Tag`→`UBadge`, etc.).
- Rebuild list-page tables (`DataTable`/`Column` → `UTable`) and forms (`@primevue/forms` + zod resolver → `UForm` with native zod).
- **Remove `FormFieldWrap`** — use `UFormField` directly; the wrapper and the zod-resolver glue disappear.
- Adopt the **`UDashboard*` layout** (`UDashboardGroup`/`UDashboardSidebar`/`UDashboardNavbar` + `UNavigationMenu`/`USlideover`) to replace the hand-built shell, rail-collapse, and mobile drawer logic.
- Replace `ConfirmDialog`/`useConfirm` with `useOverlay()` + a small in-house `ConfirmModal`.
- Delete the `primevue-i18n-sync` plugin — Nuxt UI ships `en`/`pl` locales; drive its locale from `@nuxtjs/i18n`.
- Rework theming: brand accent and light/dark move from Aura `--p-*` tokens to `app.config.ts` colors + `--ui-*` tokens via `@nuxtjs/color-mode`.

## Capabilities

### Modified Capabilities
- `ui-theming`: theming expressed via Nuxt UI `app.config.ts` colors + `--ui-*` tokens and `@nuxtjs/color-mode`, not Aura/PrimeVue config.
- `shared-ui-components`: `UTable`-based table pieces; `FormFieldWrap` removed in favor of `UFormField`; confirm via `useOverlay`; time input on `UInput`.
- `frontend-shell`: shell built on the `UDashboard*` suite; styling via Tailwind utilities/`--ui-*` tokens.
- `internationalization`: Nuxt UI locale (not PrimeVue) tracks the app locale.
- `authentication`, `client-management`, `project-management`: client-side validation via `UForm`'s native zod, not a PrimeVue Forms resolver.

## Non-goals

- No changes to server endpoints, API contracts, DB schema, i18n message keys, or `data-testid` contracts.
- No behavioral/feature changes; this is a UI-library swap only.

## Impact

- `app/` pages, layouts, components, plugins, `nuxt.config.ts`, `app.config.ts`, `package.json`, ESLint a11y config, `AGENTS.md`/`CODING_STANDARDS.md`.
- Tests: `test/nuxt/*` component stubs/selectors updated; `data-testid` and `test/e2e/*` assertions preserved green.
