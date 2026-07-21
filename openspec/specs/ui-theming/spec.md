# ui-theming Specification

## Purpose
Define the application's visual theming standard: a single brand accent, a user-controllable light/dark mode that defaults to the operating-system preference, no flash of the wrong theme under SSR, and a tokenized (inline-style-free) auth surface — all consistent with the `accessibility` capability (WCAG 2.1 AA).

## Requirements

### Requirement: REQ-160 Brand accent palette
The application SHALL define a single custom brand `primary` palette built on the **cyan** family and anchored at **`cyan.400`**, overriding the Aura preset default, applied via the PrimeVue theme configuration so that all primary-colored UI (buttons, links, focus rings, active states) inherits it in both light and dark mode. The effective accent shade SHALL be selected automatically per mode (a darker step on light surfaces, a lighter step on dark surfaces) so that contrast is preserved in each mode. Component-level hardcoded colors and inline color styles SHALL NOT be used to express the brand accent.

#### Scenario: Primary controls use the brand accent
- **WHEN** a primary `Button` or link is rendered in either light or dark mode
- **THEN** its accent color SHALL derive from the configured brand `primary` token, not from per-component CSS

#### Scenario: Accent meets AA contrast in both modes
- **WHEN** brand-accent text or an essential accent UI element is rendered against its surface in light and in dark mode
- **THEN** the contrast ratio SHALL meet WCAG 2.1 AA (≥ 4.5:1 normal text, ≥ 3:1 large text / essential non-text UI), per REQ-004

#### Scenario: Accent shade adapts automatically between modes
- **WHEN** the active mode switches between light and dark
- **THEN** the effective accent shade derived from the `cyan` ramp SHALL adjust automatically (darker on light surfaces, lighter on dark surfaces) without hardcoding a single static hue for both modes

### Requirement: REQ-161 Light/dark mode with system default and manual override
The application SHALL support three theme states — `light`, `dark`, and `system` — where `system` follows the operating-system `prefers-color-scheme`. The default SHALL be `system`. A user manual selection SHALL override the system preference and SHALL persist across reloads via a cookie. Dark mode SHALL be applied through Aura's `darkModeSelector` (a `.dark` class on the root `<html>` element).

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
The effective theme SHALL be determined before first paint so that the initial server-rendered HTML reflects the correct mode and no flash of the wrong theme occurs on load or reload. The resolution logic SHALL NOT reference browser-only APIs (`window`, `localStorage`) during server-side rendering; the persisted choice SHALL be read from the SSR-readable cookie.

#### Scenario: Stored dark choice renders dark on the server
- **WHEN** a user whose cookie stores `dark` requests a page
- **THEN** the server-rendered `<html>` SHALL already carry the `.dark` class before hydration

#### Scenario: No browser APIs during SSR
- **WHEN** the theme is resolved on the server
- **THEN** the resolution SHALL NOT access `window` or `localStorage`

### Requirement: REQ-163 Accessible theme toggle
The application SHALL provide a theme toggle control on the `auth` layout. The control SHALL be a **3-way control** exposing the `light`, `dark`, and `system` states directly (the `system` state SHALL be reachable without an additional separate reset affordance). The control SHALL expose a programmatic accessible name (visible text or `aria-label`), be fully keyboard operable with a visible focus indicator, and communicate the current state by means other than color alone (text, icon, or `aria-pressed`/equivalent), consistent with REQ-001 and REQ-003.

#### Scenario: Toggle is named and keyboard operable
- **WHEN** a user reaches the theme toggle using only the keyboard
- **THEN** it SHALL be focusable with a visible focus indicator, expose an accessible name, and switch the theme on Enter/Space

#### Scenario: All three states are directly reachable
- **WHEN** a user operates the theme control
- **THEN** each of `light`, `dark`, and `system` SHALL be selectable directly from the control

#### Scenario: Toggle label is internationalized
- **WHEN** the toggle renders its accessible name
- **THEN** the string SHALL come from the i18n catalogs with `en` and `pl` in parity

### Requirement: REQ-164 Tokenized auth surface
The `auth` layout and the login page SHALL present the login form within a centered PrimeVue surface (e.g. `Card`) and SHALL express layout and color through theme tokens / component props rather than ad-hoc inline `style` color values. All existing login `data-testid` hooks and the accessibility wiring (associated `<label>`s, `role="alert"` error, `aria-describedby`, `aria-invalid`) SHALL be preserved.

#### Scenario: Login renders in a centered themed card
- **WHEN** the login page is rendered in light or dark mode
- **THEN** the form SHALL appear in a centered card whose colors come from theme tokens and adapt to the active mode

#### Scenario: Existing test hooks and a11y preserved
- **WHEN** the auth surface is restyled
- **THEN** the `login-form`, `email`, `password`, `login-button`, and `login-error` hooks and the announced/associated error behavior SHALL remain intact
