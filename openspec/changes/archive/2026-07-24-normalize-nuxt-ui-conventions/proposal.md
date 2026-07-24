## Why

A Nuxt UI compliance review found the app is highly compliant, but three localized spots still bypass the library's conventions: a native `<button>` result list and raw `<form>` elements in overlay dialogs, and manually loaded fonts. Normalizing them now — while the surface area is tiny — keeps the UI layer internally consistent (the list/settings pages already use `UForm` + zod) and avoids the deviations spreading as more dialogs are added.

## What Changes

- Replace the native `<button>` result list in `RemoteIssuePicker.vue` (and the native `<button>` inside the `UInputMenu` `#item-label` slots of the two timer dialogs) with `UButton variant="ghost"`, preserving all `data-testid`, `aria-label`, and click behavior.
- Convert the raw `<form @submit.prevent>` in `TimerAddEntryDialog.vue`, `TimerBulkAssignDialog.vue`, and `RemoteIssuePicker.vue` to `UForm` bound to a zod `:schema`, matching the client/project/login/settings pages and the skill's forms guidance; keep existing field ids, labels, error wiring, and test hooks intact.
- Remove manual Inter font loading (`useHead` stylesheet link + `:root { font-family }` / legacy stacks) and rely on Nuxt UI / Tailwind default typography; keep `@nuxt/fonts` only as auto-registered by `@nuxt/ui` (no custom `--font-sans` until a brand typeface is chosen).

## Capabilities

### New Capabilities
<!-- None: this change normalizes existing UI surfaces, not new behavior. -->

### Modified Capabilities
- `shared-ui-components`: add a requirement that overlay dialog forms use `UForm` (Standard Schema validation) and that interactive list/result items use Nuxt UI button components rather than native `<button>`/`<form>` elements.
- `ui-theming`: add a requirement that the app does not inject custom webfonts/manual font CSS; typography uses framework defaults, with `@nuxt/fonts` available only via `@nuxt/ui` auto-registration.

## Impact

- Components: `app/components/RemoteIssuePicker.vue`, `app/components/TimerAddEntryDialog.vue`, `app/components/TimerBulkAssignDialog.vue`.
- Styling/config: `app/assets/css/main.css`, `app/app.vue` (drop the manual `<link>` and custom font rules); no direct `@nuxt/fonts` dependency.
- Tests: existing `nuxt`/`e2e` suites that assert against the stable `data-testid` hooks must stay green; no `data-testid` values change.
- No API, database, or i18n-catalog changes (labels are reused).
