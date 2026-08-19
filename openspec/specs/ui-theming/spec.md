# ui-theming Specification

## Purpose
Define the application's visual theming standard: a single brand accent, a user-controllable light/dark mode that defaults to the operating-system preference, no flash of the wrong theme under SSR, and a tokenized (inline-style-free) auth surface — all consistent with the `accessibility` capability (WCAG 2.1 AA).

## Requirements

### Requirement: REQ-160 Brand accent palette
The application SHALL define a single custom brand `primary` color anchored on the **cyan** family, configured through Nuxt UI's `app.config.ts` (`ui.colors.primary`) and its `--ui-*` design tokens, so that all primary-colored UI (buttons, links, focus rings, active states) inherits it in both light and dark mode. The effective accent shade SHALL be selected automatically per mode (a darker step on light surfaces, a lighter step on dark surfaces) so that contrast is preserved in each mode. Component-level hardcoded colors and inline color styles SHALL NOT be used to express the brand accent; Tailwind utilities SHALL reference the `primary` alias rather than raw hex values.

#### Scenario: Primary controls use the brand accent
- **WHEN** a primary `UButton` or link is rendered in either light or dark mode
- **THEN** its accent color SHALL derive from the configured `primary` color, not from per-component CSS

#### Scenario: Accent meets AA contrast in both modes
- **WHEN** brand-accent text or an essential accent UI element is rendered against its surface in light and in dark mode
- **THEN** the contrast ratio SHALL meet WCAG 2.1 AA (≥ 4.5:1 normal text, ≥ 3:1 large text / essential non-text UI), per REQ-004

#### Scenario: Accent shade adapts automatically between modes
- **WHEN** the active mode switches between light and dark
- **THEN** the effective accent shade derived from the `cyan` ramp SHALL adjust automatically (darker on light surfaces, lighter on dark surfaces) without hardcoding a single static hue for both modes

### Requirement: REQ-161 Light/dark mode with system default and manual override
The application SHALL support three theme states — `light`, `dark`, and `system` — where `system` follows the operating-system `prefers-color-scheme`. The default SHALL be `system`. A user manual selection SHALL override the system preference and SHALL persist across reloads via a cookie. Dark mode SHALL be applied through `@nuxtjs/color-mode` (the module bundled with Nuxt UI), which toggles a `.dark` class on the root `<html>` element.

#### Scenario: Defaults to operating-system preference
- **WHEN** a user with no stored theme choice loads the app and their OS prefers dark
- **THEN** the app SHALL render in dark mode

#### Scenario: Manual override persists
- **WHEN** a user explicitly selects light or dark and reloads the page
- **THEN** the app SHALL render in the selected mode regardless of the OS preference

#### Scenario: Returning to system
- **WHEN** a user selects the `system` state
- **THEN** the app SHALL again follow the current OS `prefers-color-scheme`

### Requirement: REQ-162 No flash of incorrect theme under SSR
The effective theme SHALL be determined before first paint so that the initial server-rendered HTML reflects the correct mode and no flash of the wrong theme occurs on load or reload. Resolution SHALL rely on `@nuxtjs/color-mode`'s SSR-safe cookie/inline-script mechanism and SHALL NOT reference browser-only APIs (`window`, `localStorage`) during server-side rendering.

#### Scenario: Stored dark choice renders dark on the server
- **WHEN** a user whose color-mode cookie stores `dark` requests a page
- **THEN** the server-rendered `<html>` SHALL already carry the `.dark` class before hydration

#### Scenario: No browser APIs during SSR
- **WHEN** the theme is resolved on the server
- **THEN** the resolution SHALL NOT access `window` or `localStorage`

### Requirement: REQ-163 Accessible theme control on Settings
The application SHALL provide an authenticated theme control on the `/settings` page (not in the top-bar utility menu and not required on the `auth` layout). The control SHALL be a **3-way control** exposing the `light`, `dark`, and `system` states directly (the `system` state SHALL be reachable without an additional separate reset affordance). Changing the selection SHALL apply immediately and persist via the existing color-mode cookie mechanism (REQ-161). The control SHALL expose a programmatic accessible name (visible text or `aria-label`), be fully keyboard operable with a visible focus indicator, and communicate the current state by means other than color alone (text, icon, or `aria-pressed`/equivalent), consistent with REQ-001 and REQ-003. All labels SHALL come from the i18n catalogs with `en`/`pl` parity.

#### Scenario: Theme control is on Settings
- **WHEN** an authenticated user opens `/settings`
- **THEN** a 3-way theme control SHALL be present on that page

#### Scenario: Theme is not in the utility menu
- **WHEN** the authenticated utility menu is opened
- **THEN** theme options SHALL NOT appear there

#### Scenario: Toggle is named and keyboard operable
- **WHEN** a user reaches the theme control using only the keyboard
- **THEN** it SHALL be focusable with a visible focus indicator, expose an accessible name, and switch the theme on Enter/Space (or equivalent selection)

#### Scenario: All three states are directly reachable
- **WHEN** a user operates the theme control
- **THEN** each of `light`, `dark`, and `system` SHALL be selectable directly from the control

#### Scenario: Manual override persists after change on Settings
- **WHEN** a user selects light or dark on `/settings` and reloads the page
- **THEN** the app SHALL render in the selected mode regardless of the OS preference

#### Scenario: Toggle label is internationalized
- **WHEN** the control renders its accessible name or option labels
- **THEN** the strings SHALL come from the i18n catalogs with `en` and `pl` in parity

### Requirement: REQ-164 Tokenized auth surface
The `auth` layout and the login page SHALL present the login form within a centered Nuxt UI surface (e.g. `UCard` / `UPageCard`) and SHALL express layout and color through Tailwind utilities and `--ui-*` design tokens rather than ad-hoc inline `style` color values. All existing login `data-testid` hooks and the accessibility wiring (associated `<label>`s, `role="alert"` error, `aria-describedby`, `aria-invalid`) SHALL be preserved.

#### Scenario: Login renders in a centered themed card
- **WHEN** the login page is rendered in light or dark mode
- **THEN** the form SHALL appear in a centered card whose colors come from Nuxt UI design tokens and adapt to the active mode

#### Scenario: Existing test hooks and a11y preserved
- **WHEN** the auth surface is restyled
- **THEN** the `login-form`, `email`, `password`, `login-button`, and `login-error` hooks and the announced/associated error behavior SHALL remain intact

### Requirement: REQ-175 Default font stack (no manual font loading)
The application SHALL NOT load a custom webfont or inject an external font stylesheet. Sans-serif typography SHALL use the Nuxt UI / Tailwind default font stack (no project-level `--font-sans` override and no hand-written `:root { font-family }` rule). `@nuxt/fonts` remains available only via auto-registration by `@nuxt/ui` if a future `@theme` font token is introduced; it MUST NOT be listed again in `modules` or added as a direct dependency solely for defaults.

#### Scenario: No manual font-family override
- **WHEN** any page is rendered
- **THEN** the effective sans-serif family SHALL come from framework defaults, not from a manual `:root { font-family }` rule or a project `--font-sans` override

#### Scenario: No manual external font stylesheet link
- **WHEN** the app document head is produced
- **THEN** it SHALL NOT contain a hand-injected external font stylesheet `<link>` (e.g. rsms.me Inter)

#### Scenario: Auto-registered fonts module only
- **WHEN** Nuxt modules are configured
- **THEN** `@nuxt/fonts` SHALL NOT appear as an explicit `modules` entry; configuration (if any) goes through the root `fonts` key or a future `@theme` token

### Requirement: REQ-267 SVG-first brand mark and favicon
The application SHALL provide an original brand mark as scalable vector graphics, distinct from any third-party framework default icon. The mark SHALL be a circular clock ring with a single hand and a hub, without letterforms, tick marks, or a play triangle, so it remains legible at favicon size (~16×16) and at sidebar size (~24px).

In application chrome (sidebar brand region and auth-layout heading) the mark SHALL be a background-free glyph that inherits the configured brand `primary` color (REQ-160) so its effective shade adapts between light and dark mode. The document favicon SHALL be a colored rounded-square app icon with a white glyph on a cyan fill matching the brand ramp. Because a tab icon cannot inherit CSS color tokens, that fill MAY be a static color in the favicon asset; in-app chrome SHALL NOT use a raw hex class to tint the glyph.

The document head SHALL advertise the app icon as the favicon (SVG plus a raster `.ico` fallback). The previous third-party default favicon SHALL NOT remain the tab icon.

This requirement does not add a PWA manifest, service worker, or additional raster sizes (apple-touch, 192/512, maskable). Those remain a later PWA change; the SVG app icon SHALL remain the source for those sizes.

#### Scenario: In-chrome mark follows the brand accent
- **WHEN** the brand mark is rendered in the sidebar or on the login heading in light or dark mode
- **THEN** its color SHALL derive from the configured `primary` token rather than a hardcoded hex class

#### Scenario: Favicon is the app icon, not a framework default
- **WHEN** a browser loads any application page
- **THEN** the document favicon SHALL be the application brand app icon (SVG and `.ico` fallback) and SHALL NOT be a third-party framework default

#### Scenario: Mark has no letterforms
- **WHEN** the brand mark or favicon is rendered
- **THEN** it SHALL not contain readable letters (including a short brand abbreviation)

#### Scenario: Dark mode does not invert the favicon fill
- **WHEN** the user is in dark mode
- **THEN** the favicon SHALL remain the cyan rounded-square app icon with a white glyph (the in-chrome glyph still follows `primary`)

### Requirement: REQ-268 Favicon reflects idle vs running timer
The document favicon SHALL follow the shared running-timer state (the same `running` entry used by the shell widget, REQ-146 / REQ-258). When there is no running entry (including unauthenticated visits and an authenticated idle timer), the favicon SHALL be the default brand app icon from REQ-267. When a running entry is present, the favicon SHALL be a **static** variant of that same app icon with a green status dot in the bottom-right corner and a contrasting ring so the dot remains visible on the cyan square. The variant SHALL NOT pulse, animate, or replace the brand glyph with a play control.

The running variant SHALL apply as soon as running state is known, including first paint of an authenticated page whose SSR seed already contains a running entry. Stopping the timer, or otherwise clearing the running entry, SHALL restore the default favicon in that tab. Other open tabs are not required to update until they next resolve running state. The in-app brand mark (sidebar and login heading) SHALL remain the unbadged glyph.

#### Scenario: Idle and logged-out use the default favicon
- **WHEN** there is no running entry (logged-out visitor, or authenticated user with an idle timer)
- **THEN** the document favicon SHALL be the default brand app icon

#### Scenario: Running entry shows a green-dot favicon
- **WHEN** the authenticated user has a running entry
- **THEN** the document favicon SHALL be the brand app icon with a static green corner dot

#### Scenario: Stop restores the default favicon
- **WHEN** the user stops the running timer in that tab
- **THEN** the document favicon SHALL return to the default brand app icon

#### Scenario: Reloading a running timer shows the badged favicon on first paint
- **WHEN** an authenticated user with a running entry performs a full document load
- **THEN** the initial document favicon SHALL be the running (green-dot) variant rather than flashing the idle icon until a client-only fetch

#### Scenario: In-app mark is not badged
- **WHEN** a timer is running
- **THEN** the sidebar and login brand mark SHALL remain the unbadged glyph
