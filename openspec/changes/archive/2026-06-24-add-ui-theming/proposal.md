## Why

`docs/wbs.md` 7.6 commits the product to a **light/dark theme**, and `docs/vision.md` fixes the stack as **PrimeVue (+ optional Tailwind)**. Today there is no theming layer at all: `nuxt.config.ts` loads the Aura preset with defaults (stock sky/blue primary, light only), and `app/layouts/auth.vue` + `app/pages/login.vue` use ad-hoc inline styles. Deciding the visual direction now — while the only "ready" surface is the login page — lets us validate dark mode, the brand accent, and an accessible layout pattern cheaply before domain pages multiply the cost.

## What Changes

- Establish a **UI theming** capability built on the existing Aura styled preset (no Tailwind): a custom **cyan** brand `primary` palette anchored at **`cyan.400`** overriding the Aura default, with the effective accent shade auto-selected per mode (darker on light, lighter on dark) and verified to meet WCAG 2.1 AA (REQ-NFR-019) in both modes.
- Add **light/dark mode** with three states (`light`, `dark`, `system`): default to OS `prefers-color-scheme`, allow a persisted manual override, applied via Aura's `darkModeSelector` (`.dark` on `<html>`) with **SSR-safe, no-flash** initialization from a cookie.
- Add an accessible **3-way theme control** (`light`/`dark`/`system` all directly selectable), placed on the `auth` layout for this iteration.
- Reshape the login surface into a **centered PrimeVue Card**, replacing inline styles in `app/layouts/auth.vue` and `app/pages/login.vue` with theme tokens (preserving existing `data-testid` hooks and the a11y guarantees from the `accessibility` capability).

## Capabilities

### New Capabilities
- `ui-theming`: cyan brand palette (anchored at `cyan.400`, auto per-mode accent), light/dark mode with system + manual override and no-flash SSR, an accessible 3-way theme control, and a tokenized (inline-style-free) login surface.

### Modified Capabilities
<!-- None at the spec level; complements `accessibility` (REQ-NFR-019) and `frontend-pages` (auth layout) without changing their requirements. -->

## Impact

- **Code**: `nuxt.config.ts` (theme options + `darkModeSelector`), a color-mode composable/plugin, `app/layouts/auth.vue`, `app/pages/login.vue`, i18n catalogs (`en`/`pl`) for the toggle label, `docs/wbs.md` 7.6 status.
- **Tests**: `test/nuxt/` for the toggle + persisted mode + no-flash; `test/unit/` for the color-mode resolution logic; i18n parity.
- **Backend/APIs**: none.

## Non-goals

- Theming the authenticated app shell / `default.vue` (deferred to a follow-up).
- Adding Tailwind CSS.
- Per-entity color labels (WBS 3.5), high-contrast mode, or user-DB-persisted theme preference (cookie-only this iteration).
- A full design system / component restyling beyond the brand `primary` token.
