## 1. Theme configuration (frontend)

- [x] 1.1 Define a custom Aura preset via `definePreset(Aura, ...)` overriding the `primary` semantic token with a **cyan** ramp (50…950) anchored at `cyan.400`; register it in `nuxt.config.ts` under `primevue.options.theme`.
- [x] 1.2 Enable `darkModeSelector: '.dark'` in the theme options.
- [x] 1.3 Configure per-mode accent selection (Aura `primary.color`/`primary.contrastColor` light vs dark token sets) so the effective accent auto-adjusts (darker on light, lighter on dark); verify and record WCAG 2.1 AA contrast ratios for the chosen shades in both modes (REQ-NFR-021 / REQ-NFR-019) and adjust ramp if any value is below threshold.

## 2. Color-mode logic (frontend, non-UI)

- [x] 2.1 Implement a pure `resolveEffectiveMode(stored, systemPrefersDark)` helper mapping `light|dark|system` → effective `light|dark`.
- [x] 2.2 Add a `useColorMode` composable that reads/writes the choice via an SSR-readable `useCookie`, exposes the current state and a setter, and applies the `.dark` class (no `window`/`localStorage` during SSR).
- [x] 2.3 Ensure the effective mode is applied to `<html>` before first paint (server-side from cookie; pre-hydration handling for the `system` case) to prevent flash.
- [x] 2.4 **Unit test** `resolveEffectiveMode` covering all three states and both system preferences (`test/unit/`).

## 3. Theme toggle UI (frontend, form/flow)

- [x] 3.1 Add an accessible **3-way** theme control (`light`/`dark`/`system` all directly selectable; accessible name, keyboard operable, state conveyed non-visually) and place it on `app/layouts/auth.vue`.
- [x] 3.2 Add i18n keys for the toggle accessible name to `i18n/locales/en.json` and `i18n/locales/pl.json` (keep parity).
- [x] 3.3 **Nuxt test** (`test/nuxt/`): all three states (`light`/`dark`/`system`) are selectable, switching updates the mode, the choice persists via cookie, and the control exposes an accessible name and is keyboard operable.

## 4. Tokenized auth surface (frontend, form/flow)

- [x] 4.1 Reshape `app/layouts/auth.vue` into a centered container using theme tokens (remove inline color styles); keep the title.
- [x] 4.2 Wrap the login form in `app/pages/login.vue` in a PrimeVue `Card`, replacing inline styles with tokens/props; preserve all `data-testid` hooks and the `role="alert"` + `aria-describedby` + `aria-invalid` error wiring.
- [x] 4.3 **Nuxt test** (`test/nuxt/`): login renders inside the card, all test hooks present, error still announced/associated; assert the initial HTML carries the correct theme class for a stored `dark` cookie (REQ-NFR-023).

## 5. Verification

- [x] 5.1 Run `pnpm lint` and `pnpm format:check` (a11y gate must pass; icon toggle has an accessible name).
- [x] 5.2 Run `pnpm test:unit` and `pnpm test:nuxt`; confirm i18n catalog parity test passes.
- [x] 5.3 Manual pass of `/login` in light, dark, and system modes: reload shows no flash, override persists, keyboard reaches and operates the toggle with visible focus.

## 6. Documentation

- [x] 6.1 Update `docs/wbs.md` 7.6 status to reflect the theming foundation (auth-scoped) landed; note the authenticated-shell follow-up.
- [x] 6.2 Add a short "Theming" note to `AGENTS.md` (brand `primary` token is the single source of truth; use tokens, not inline colors).
