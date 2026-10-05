# ui-theming Specification

## Purpose
Define the application's visual theming standard: a single brand accent, a user-controllable light/dark mode that defaults to the operating-system preference, no flash of the wrong theme under SSR, and a tokenized (inline-style-free) auth surface — all consistent with the `ui-accessibility` capability (WCAG 2.1 AA).

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

### Requirement: REQ-368 SVG-first brand mark and favicon
The application SHALL provide an original brand mark as scalable vector graphics, distinct from any third-party framework default icon. The mark SHALL be built from constructed geometry — circular arcs, straight segments, and filled polygons placed on a declared grid — and SHALL NOT embed outlines traced from a typeface. The mark SHALL be an **open dial** enclosing a single-letter monogram, and SHALL remain legible at favicon size (~16×16) and at sidebar size (~24px).

The open dial SHALL be one continuous stroke that leaves exactly one quadrant of the circle open: it starts as a short straight bar at the 6 o'clock position, joins the circle tangentially, runs clockwise through 9 and 12, and ends at 3 o'clock. The 3-to-6 quadrant SHALL contain no dial stroke, so the dial reads as a clock face with time elapsed rather than a closed ring.

The monogram SHALL be the single letter "T" constructed from strokes and filled polygons rather than set in a font: a crossbar drawn heavier than the dial stroke, and a stem that tapers toward its end like a clock hand pointing at 6 o'clock. Type traced at 16×16 loses its stroke modulation and terminals; a letter constructed from a few heavy strokes has neither problem. The mark SHALL NOT contain a lattice of grid points or other decoration finer than the dial stroke. Readable words, brand abbreviations of more than one character, and a play triangle SHALL NOT appear in the mark.

In application chrome (sidebar brand region, auth-layout heading, and the browser extension's popup and options headers) the mark SHALL be a background-free glyph that inherits the configured brand `primary` color (REQ-160) so its effective shade adapts between light and dark mode. The in-app mark SHALL express its entire drawing through a single inherited color; it SHALL NOT use a raw hex class and SHALL NOT tint any part of the glyph to convey state.

The document favicon SHALL be a colored rounded-square app icon with a white glyph on a fill matching the brand ramp. Because a tab icon cannot inherit CSS color tokens, that fill MAY be a static color in the favicon asset.

The app-icon assets SHALL be separated by destination:

- The **maskable source** tile SHALL keep the drawn mark inside the central 80% safe circle **with margin to spare**, so that a future adaptive or maskable raster can be cut from it without redrawing and without looking cramped once the platform crops it.
- The **tab icon** tile SHALL scale the same glyph up (to ~88% of the canvas) to maximize legibility at 16×16, and SHALL be the asset used for the browser tab and its raster fallback.

Both tiles SHALL be generated from the same canonical glyph geometry so the two drawings cannot drift apart.

Every other rendering of the app icon, including the mark printed in generated documents such as the client report PDF title page (tracking-client-report), SHALL be derived from that same canonical glyph at build or render time rather than kept as a separate hand-copied drawing, so a change to the glyph reaches every copy without editing it. The browser extension is the one exception: it is built separately from the application, so it keeps its own copy of the glyph and a raster icon set cut once from the tab-icon tile (see below).

The document head SHALL advertise the app icon as the favicon (SVG plus a raster `.ico` fallback). A third-party framework default favicon SHALL NOT be the tab icon.

The browser extension SHALL keep a copy of the canonical glyph for its page headers, and a committed raster icon set (16, 32, 48 and 128 px) rasterized from the tab-icon tile. Both are derived assets, in the same way as the favicon tiles. The canonical glyph file SHALL list them among the assets to regenerate, and each extension copy SHALL name the canonical file it was derived from. Apart from that set, this requirement does not add a PWA manifest, service worker, or additional raster sizes (apple-touch, 192/512, maskable). Those remain a later PWA change; the maskable-source SVG app icon SHALL remain the source for those sizes.

#### Scenario: In-chrome mark follows the brand accent
- **WHEN** the brand mark is rendered in the sidebar or on the login heading in light or dark mode
- **THEN** its color SHALL derive from the configured `primary` token rather than a hardcoded hex class

#### Scenario: Favicon is the app icon, not a framework default
- **WHEN** a browser loads any application page
- **THEN** the document favicon SHALL be the application brand app icon (SVG and `.ico` fallback) and SHALL NOT be a third-party framework default

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

#### Scenario: Maskable source keeps its safe zone
- **WHEN** the maskable-source app icon is cropped to the circular safe area used by adaptive icons
- **THEN** no part of the glyph SHALL be clipped, and the mark SHALL still show visible margin inside that circle rather than meeting its edge

#### Scenario: Tab icon is scaled for legibility, not for masking
- **WHEN** the tab-icon tile is authored
- **THEN** its glyph SHALL be enlarged relative to the maskable source so the mark reads at 16×16, and that tile SHALL NOT be used as the source for adaptive or maskable rasters even where it would also satisfy the safe circle

#### Scenario: The two tiles share one geometry
- **WHEN** the glyph geometry changes
- **THEN** the maskable-source tile and the tab-icon tile SHALL both be regenerated from it, differing only in the glyph's scale within the canvas

#### Scenario: Generated documents use the current mark
- **WHEN** a client report PDF is generated
- **THEN** the mark on its title page SHALL be drawn from the canonical glyph, so it matches the in-app mark and favicon rather than an earlier version of the drawing

#### Scenario: Dark mode does not invert the favicon fill
- **WHEN** the user is in dark mode
- **THEN** the favicon SHALL remain the rounded-square app icon with a white glyph on the brand fill (the in-chrome glyph still follows `primary`)

#### Scenario: Extension copies are traceable to the glyph
- **WHEN** the canonical glyph file is inspected
- **THEN** its list of derived assets SHALL include the extension's glyph copy and its four PNG icons, and each of those copies SHALL reference the canonical file as its source

#### Scenario: A glyph change regenerates the extension copies
- **WHEN** the canonical glyph geometry changes
- **THEN** the same change SHALL update the extension's glyph copy and re-cut its four PNG icons from the updated tab-icon tile

### Requirement: REQ-369 Favicon reflects idle vs running timer
The document favicon SHALL follow the shared running-timer state (the same `running` entry used by the shell widget, REQ-146 / REQ-258). When there is no running entry (including unauthenticated visits and an authenticated idle timer), the favicon SHALL be the default brand app icon from REQ-368. When a running entry is present, the favicon SHALL be a **static** variant of that same app icon in which the **tile fill changes from the brand cyan to a status green** while the glyph, its geometry, and its white color stay identical. The running variant SHALL NOT add a badge, dot, ring, or any other extra element, SHALL NOT pulse or animate, and SHALL NOT replace the brand glyph with a play control.

The signal SHALL be carried by the tile fill rather than by a corner badge, because at 16×16 a badge occupies a small fraction of the icon and is not reliably noticed in a crowded tab strip, whereas a fill change alters the entire icon while leaving the mark recognizable. The running fill SHALL provide at least as much contrast against the white glyph as the idle fill does, so the mark does not become harder to read in the running state.

The running variant SHALL apply as soon as running state is known, including first paint of an authenticated page whose SSR seed already contains a running entry. Stopping the timer, or otherwise clearing the running entry, SHALL restore the default favicon in that tab. Other open tabs are not required to update until they next resolve running state. The in-app brand mark (sidebar and login heading) SHALL remain the unmodified glyph and SHALL NOT signal running state by color or by any added element.

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

#### Scenario: Stop restores the default favicon
- **WHEN** the user stops the running timer in that tab
- **THEN** the document favicon SHALL return to the default brand app icon

#### Scenario: Reloading a running timer shows the running favicon on first paint
- **WHEN** an authenticated user with a running entry performs a full document load
- **THEN** the initial document favicon SHALL be the running (green-tile) variant rather than flashing the idle icon until a client-only fetch

#### Scenario: In-app mark is not tinted
- **WHEN** a timer is running
- **THEN** the sidebar and login brand mark SHALL remain the unmodified glyph in the `primary` color, with no green element and no added shape

### Requirement: REQ-402 Accessible theme control in the account menu
The application SHALL provide an authenticated theme control as a **Theme** submenu of the sidebar footer account menu (ui-shell REQ-405). The control SHALL NOT be on the `/profile` page and SHALL NOT be required on the `auth` layout. The submenu SHALL be a **3-way control** exposing `light`, `dark`, and `system` directly as items; `system` SHALL be reachable without a separate reset affordance. Selecting an item SHALL apply the theme immediately and persist it via the existing color-mode cookie mechanism (REQ-161). The current state SHALL be shown by a means other than color alone (a checked indicator with checked state exposed to assistive technology). The submenu SHALL be reachable on the expanded rail, the collapsed rail, and the mobile drawer. It SHALL be fully keyboard operable, and every item SHALL expose an accessible name, consistent with REQ-001 and REQ-003. All labels SHALL come from the i18n catalogs with `en`/`pl` parity.

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
