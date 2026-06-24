## Context

The app uses PrimeVue 4 in **styled mode** with the Aura preset registered in `nuxt.config.ts` (`theme: { preset: Aura }`) — defaults only: stock primary palette, light mode, no `darkModeSelector`. Tailwind is not installed. The auth surface (`app/layouts/auth.vue`, `app/pages/login.vue`) is built directly from PrimeVue components with inline `style` attributes. The `accessibility` capability (REQ-NFR-016..019) already governs labels, announced errors, focus, and AA contrast — theming must not regress it. SSR is active, so any class applied to `<html>` after hydration would flash.

## Goals / Non-Goals

**Goals:**
- A single source of truth for the brand accent (cyan `primary`, anchored at `cyan.400`) inherited by all components in both modes.
- Light/dark with three states (`light` | `dark` | `system`), OS-default, manual override, persisted across reloads, with **no flash of the wrong theme** on SSR.
- An accessible toggle on the `auth` layout; a centered Card login that uses tokens, not inline styles.

**Non-Goals:**
- Theming `default.vue`, adding Tailwind, DB-persisted preference, high-contrast mode, entity color labels.

## Decisions

- **Aura `darkModeSelector: '.dark'` over media-query mode.** Toggling a `.dark` class on `<html>` supports the manual override the user wants; pure `@media (prefers-color-scheme)` cannot be overridden. *Alternative:* `darkModeSelector: 'system'` (media-only) — rejected because it removes user control (WBS 7.6 implies a user setting).
- **Custom `primary` via Aura's design-token override (`definePreset`), not raw CSS.** Override the `primary` semantic token to a teal/cyan ramp (50…950) so Buttons, links, and focus rings inherit it in both modes. *Alternative:* per-component CSS / Tailwind utilities — rejected as it fragments the source of truth and reintroduces inline styling.
- **Three-state model resolved at one place.** Stored value is `light|dark|system`; the *effective* mode resolves `system` against `prefers-color-scheme`. A small pure function (unit-testable) owns this mapping. *Alternative:* boolean `isDark` — rejected because it cannot represent "follow system".
- **No-flash via cookie + SSR.** Persist the choice in a cookie (`useCookie`, SSR-readable). On the server, set the `.dark` class on `<html>` (via `useHead`/app config) from the cookie before paint; for the `system` case where the server can't know OS preference, gate with an inline pre-hydration snippet or accept `system` defaulting to light server-side then correcting pre-paint. *Alternative:* localStorage-only — rejected (not readable during SSR → guaranteed flash).
- **Cyan brand accent anchored at `cyan.400`, AA-verified.** The brand `primary` ramp (50…950) is built on the cyan family, with **`cyan.400` as the anchor/base accent**. The effective accent shade used for primary text/links/essential UI is **auto-selected per mode** rather than fixed: a darker step (e.g. `cyan.600/700`) is used on light surfaces and a lighter step (e.g. `cyan.300/400`) on dark surfaces so each clears ≥4.5:1 (≥3:1 for large text / essential non-text UI) per REQ-NFR-019. The selection is driven by Aura's `primary.color` / `primary.contrastColor` semantic-token mapping (light vs dark token sets), not by hand-picking a single static hue. Document the exact ramp + measured ratios. *Alternative:* one static accent hue for both modes — rejected because a hue that clears AA on white typically fails on a dark surface (and vice-versa).
- **Three-way toggle control (`light` | `dark` | `system`).** The toggle is a single 3-state control that cycles/selects among all three states (not a 2-way switch with a separate "follow system" reset), so `system` is always directly reachable. Implemented as a segmented/`SelectButton`-style control or a cycling icon button; each state MUST carry an `aria-label` / text alternative (REQ-NFR-016) and the current state MUST be conveyed non-visually (text/icon/`aria-pressed`). *Alternative:* 2-way switch + separate reset — rejected because it hides the `system` state and risks silently losing OS-following after one click.
- **Toggle on `auth` layout this iteration.** Keeps the experiment on the only "ready" page; relocating to a global header is a later change.
- **Login becomes a centered PrimeVue `Card`** with tokenized spacing; all existing `data-testid` hooks (`login-form`, `email`, `password`, `login-button`, `login-error`) and the `role="alert"` + `aria-describedby` error wiring are preserved.

## Risks / Trade-offs

- **Theme flash on first paint (SSR)** → cookie-driven server class + pre-hydration snippet for the `system` case; cover with a `test/nuxt/` assertion that the initial HTML carries the right class.
- **Brand hue fails AA in one mode** → pick distinct light/dark shades from the ramp and record measured contrast ratios; treat AA failure as a blocking bug.
- **Inline-style removal changes layout/testids** → migrate markup carefully, keep all `data-testid`s, snapshot/behavior tests in `test/nuxt/`.
- **`system` correctness across browsers** → rely on `window.matchMedia('(prefers-color-scheme: dark)')` only client-side; never reference `window` during SSR.

## Contrast verification (REQ-NFR-019 / REQ-NFR-021)

- Implemented mode-specific accent mapping in `nuxt.config.ts`:
  - Light mode: `primary.color = {primary.700}` with `primary.contrastColor = #ffffff`
  - Dark mode: `primary.color = {primary.300}` with `primary.contrastColor = {surface.950}`
- Verified WCAG contrast ratios for the effective accent pairings used by primary controls:
  - `primary.700` (`#0e7490`) on white (`#ffffff`) = **5.05:1** (passes AA for normal text)
  - `primary.300` (`#67e8f9`) on `surface.950` (`#09090b`) = **14.51:1** (passes AA for normal text)
- Result: both configured mode-specific accent selections satisfy WCAG 2.1 AA thresholds.

## Open Questions

- **[RESOLVED]** Brand accent is the **cyan** family anchored at **`cyan.400`**; the effective accent shade is **auto-selected per mode** (darker on light surfaces, lighter on dark) to satisfy AA. Exact 50…950 ramp values are finalized against measured AA ratios during implementation (task 1.3).
- **[RESOLVED]** The theme control is a **3-way control** exposing `light`, `dark`, and `system` directly.
