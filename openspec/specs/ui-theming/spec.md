# ui-theming Specification

## Purpose
Define the application's visual identity and theming: one brand accent, light and dark mode that follow the operating system unless the user chooses, no flash of the wrong theme, the default font stack, and the brand mark and favicon — all within the `ui-accessibility` WCAG 2.1 AA standard.

## Requirements

### Requirement: REQ-160 Brand accent palette
The application SHALL define one brand `primary` color on the **cyan** family, so every primary-colored element (buttons, links, focus rings, active states) inherits it in light and dark mode. The effective shade SHALL be chosen per mode (darker on light surfaces, lighter on dark) to keep contrast. The brand accent SHALL NOT be expressed through component-level hardcoded colors, inline color styles or raw hex values.

#### Scenario: Primary controls use the brand accent
- **WHEN** a primary button or link is rendered in either light or dark mode
- **THEN** its accent color SHALL derive from the configured `primary` color, not from per-component CSS

#### Scenario: Accent meets AA contrast in both modes
- **WHEN** brand-accent text or an essential accent UI element is rendered against its surface in light and in dark mode
- **THEN** the contrast ratio SHALL meet WCAG 2.1 AA (≥ 4.5:1 normal text, ≥ 3:1 large text / essential non-text UI), per REQ-004

#### Scenario: Accent shade adapts automatically between modes
- **WHEN** the active mode switches between light and dark
- **THEN** the effective accent shade derived from the `cyan` ramp SHALL adjust automatically (darker on light surfaces, lighter on dark surfaces) without hardcoding a single static hue for both modes

### Requirement: REQ-161 Light/dark mode with system default and manual override
The application SHALL support three theme states — `light`, `dark`, and `system` — where `system` follows the operating-system `prefers-color-scheme`. The default SHALL be `system`. A manual selection SHALL override the system preference and SHALL persist across reloads in a cookie.

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
The effective theme SHALL be determined before first paint, so the server-rendered HTML already reflects the correct mode and no flash of the wrong theme occurs on load or reload. Resolving it during server rendering SHALL NOT use browser-only APIs (`window`, `localStorage`).

#### Scenario: Stored dark choice renders dark on the server
- **WHEN** a user whose color-mode cookie stores `dark` requests a page
- **THEN** the server-rendered `<html>` SHALL already carry the dark mode before hydration

#### Scenario: No browser APIs during SSR
- **WHEN** the theme is resolved on the server
- **THEN** the resolution SHALL NOT access `window` or `localStorage`

### Requirement: REQ-164 Tokenized auth surface
The `auth` layout and login page SHALL show the login form in a centered card whose layout and colors come from theme tokens and adapt to the active mode, never from inline color styles. The login `data-testid` hooks and accessibility wiring (associated `<label>`s, `role="alert"` error, `aria-describedby`, `aria-invalid`) SHALL be preserved.

#### Scenario: Login renders in a centered themed card
- **WHEN** the login page is rendered in light or dark mode
- **THEN** the form SHALL appear in a centered card whose colors come from theme design tokens and adapt to the active mode

#### Scenario: Existing test hooks and a11y preserved
- **WHEN** the auth surface is restyled
- **THEN** the `login-form`, `email`, `password`, `login-button`, and `login-error` hooks and the announced/associated error behavior SHALL remain intact

### Requirement: REQ-175 Default font stack (no manual font loading)
The application SHALL NOT load a custom webfont or inject an external font stylesheet. Sans-serif text SHALL use the framework's default font stack, with no project-level font-family override.

#### Scenario: No manual font-family override
- **WHEN** any page is rendered
- **THEN** the effective sans-serif family SHALL come from framework defaults, not from a manual `:root { font-family }` rule or a project `--font-sans` override

#### Scenario: No manual external font stylesheet link
- **WHEN** the app document head is produced
- **THEN** it SHALL NOT contain a hand-injected external font stylesheet `<link>` (e.g. rsms.me Inter)

### Requirement: REQ-368 SVG-first brand mark and favicon
The application SHALL have an original vector brand mark, unlike any framework icon, built from constructed geometry on a grid, never traced type. It is an **open dial** — one stroke from a bar at 6 o'clock clockwise to 3, leaving the 3–6 quadrant empty — around a constructed "T" whose crossbar is heavier than the dial and whose stem tapers to 6 o'clock. It SHALL hold no words, abbreviations, play triangle or detail finer than the dial, and stay legible at 16 and 24 px.

#### Scenario: Mark is constructed, not typeset
- **WHEN** the brand mark or favicon is rendered
- **THEN** every drawn element SHALL come from the mark's declared geometry and SHALL NOT be an outline traced from a typeface, and no readable word or multi-character abbreviation SHALL appear

#### Scenario: Dial is open in one quadrant
- **WHEN** the brand mark is rendered at any size
- **THEN** the dial stroke SHALL run from the bar at 6 o'clock clockwise to 3 o'clock, and the quadrant between 3 and 6 o'clock SHALL be free of dial stroke

#### Scenario: Monogram is a single constructed T
- **WHEN** the brand mark is inspected
- **THEN** its monogram SHALL be one letter "T" whose crossbar is heavier than the dial stroke and whose stem tapers toward 6 o'clock, and the mark SHALL contain no lattice points

#### Scenario: Mark survives the favicon size
- **WHEN** the tab icon is rasterized at 16×16
- **THEN** the open dial, including its open quadrant, and the "T" monogram SHALL both remain distinguishable

#### Scenario: Generated documents use the current mark
- **WHEN** a client report PDF is generated
- **THEN** the mark on its title page SHALL match the in-app mark and favicon rather than an earlier version of the drawing

### Requirement: REQ-436 Brand mark in application chrome
In the sidebar brand region, the auth-layout heading and the browser extension's popup and options headers, the mark SHALL be a background-free glyph drawn entirely in one inherited color, the brand `primary` (REQ-160), so it adapts between light and dark mode. It SHALL NOT use a raw hex class and SHALL NOT tint any part of the glyph to convey state.

#### Scenario: In-chrome mark follows the brand accent
- **WHEN** the brand mark is rendered in the sidebar or on the login heading in light or dark mode
- **THEN** its color SHALL derive from the configured `primary` token rather than a hardcoded hex class

### Requirement: REQ-437 App icon tiles and favicon
The favicon SHALL be the app icon — a rounded square with a white glyph on a static brand-ramp fill — advertised as SVG with an `.ico` fallback, never a framework default, and not inverted in dark mode. A maskable source tile SHALL keep the glyph inside the central 80% safe circle with margin to spare; the tab-icon tile SHALL enlarge it (to ~88%) for legibility and SHALL NOT be a maskable source. No PWA manifest, service worker or extra raster sizes are provided.

#### Scenario: Favicon is the app icon, not a framework default
- **WHEN** a browser loads any application page
- **THEN** the document favicon SHALL be the application brand app icon (SVG and `.ico` fallback) and SHALL NOT be a third-party framework default

#### Scenario: Maskable source keeps its safe zone
- **WHEN** the maskable-source app icon is cropped to the circular safe area used by adaptive icons
- **THEN** no part of the glyph SHALL be clipped, and the mark SHALL still show visible margin inside that circle rather than meeting its edge

#### Scenario: Tab icon is scaled for legibility, not for masking
- **WHEN** the tab-icon tile is authored
- **THEN** its glyph SHALL be enlarged relative to the maskable source so the mark reads at 16×16, and that tile SHALL NOT be used as the source for adaptive or maskable rasters even where it would also satisfy the safe circle

#### Scenario: Dark mode does not invert the favicon fill
- **WHEN** the user is in dark mode
- **THEN** the favicon SHALL remain the rounded-square app icon with a white glyph on the brand fill (the in-chrome glyph still follows `primary`)

### Requirement: REQ-369 Favicon reflects idle vs running timer
The favicon SHALL follow the shared running-timer state (REQ-146, REQ-258). Without a running entry, including logged-out visits, it SHALL be the default app icon (REQ-437). With one, it SHALL be a **static** variant whose tile fill changes from brand cyan to a status green while the glyph, its geometry and its white color stay identical, with no badge, dot, ring, animation or play control, and at least the idle fill's contrast. The in-app mark SHALL NOT signal running state.

#### Scenario: Idle and logged-out use the default favicon
- **WHEN** there is no running entry (logged-out visitor, or authenticated user with an idle timer)
- **THEN** the document favicon SHALL be the default brand app icon on the cyan fill

#### Scenario: Running entry turns the tile green
- **WHEN** the authenticated user has a running entry
- **THEN** the document favicon SHALL be the same brand app icon with a green tile fill and an unchanged white glyph

#### Scenario: Running variant adds no elements
- **WHEN** the running favicon is rendered
- **THEN** it SHALL contain exactly the elements of the idle icon, with no status dot, ring, or badge, and SHALL NOT animate

#### Scenario: Running fill keeps the glyph readable
- **WHEN** the running tile is compared with the idle tile
- **THEN** the contrast ratio between the white glyph and the running fill SHALL be no lower than that of the white glyph against the idle fill

#### Scenario: In-app mark is not tinted
- **WHEN** a timer is running
- **THEN** the sidebar and login brand mark SHALL remain the unmodified glyph in the `primary` color, with no green element and no added shape

### Requirement: REQ-438 Running favicon timing
The running favicon SHALL apply as soon as running state is known, including first paint of an authenticated page whose SSR seed already holds a running entry. Stopping or clearing the running entry SHALL restore the default favicon in that tab. Other open tabs need not update until they next resolve running state.

#### Scenario: Stop restores the default favicon
- **WHEN** the user stops the running timer in that tab
- **THEN** the document favicon SHALL return to the default brand app icon

#### Scenario: Reloading a running timer shows the running favicon on first paint
- **WHEN** an authenticated user with a running entry performs a full document load
- **THEN** the initial document favicon SHALL be the running (green-tile) variant rather than flashing the idle icon until a client-only fetch

### Requirement: REQ-402 Accessible theme control in the account menu
The theme control SHALL be a **Theme** submenu of the account menu (REQ-405), reachable on the expanded and collapsed rail and the mobile drawer; it SHALL NOT be on `/profile` and is not required on the `auth` layout. It SHALL offer `light`, `dark` and `system` directly, apply the choice immediately and persist it (REQ-161). The current choice SHALL be a checked item exposed to assistive tech, not color alone. Items SHALL be keyboard operable, named, and translated with `en`/`pl` parity.

#### Scenario: Theme control is in the account menu
- **WHEN** an authenticated user opens the sidebar footer account menu
- **THEN** a Theme submenu SHALL be present, offering Light, Dark, and System

#### Scenario: Theme is not on the profile page
- **WHEN** an authenticated user opens `/profile`
- **THEN** no theme control SHALL be rendered on the page

#### Scenario: Current theme is indicated
- **WHEN** the active preference is `dark` and the Theme submenu is opened
- **THEN** the Dark item SHALL be shown and exposed as checked, and Light and System as unchecked

#### Scenario: Submenu is keyboard operable
- **WHEN** a user opens the account menu and the Theme submenu using only the keyboard
- **THEN** each item SHALL be focusable with a visible focus indicator, expose an accessible name, and apply its theme on Enter/Space

#### Scenario: All three states are directly reachable
- **WHEN** a user opens the Theme submenu
- **THEN** each of `light`, `dark`, and `system` SHALL be selectable directly from it

#### Scenario: Available on the collapsed rail
- **WHEN** the desktop sidebar is collapsed and the user opens the avatar account menu
- **THEN** the same Theme submenu SHALL be available

#### Scenario: Manual override persists after change
- **WHEN** a user selects Light or Dark in the Theme submenu and reloads the page
- **THEN** the app SHALL render in the selected mode regardless of the OS preference

#### Scenario: Toggle label is internationalized
- **WHEN** the submenu renders its label and item labels
- **THEN** the strings SHALL come from the i18n catalogs with `en` and `pl` in parity
