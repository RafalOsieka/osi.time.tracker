## MODIFIED Requirements

### Requirement: REQ-064 Authenticated shell regions and slots
The `default` layout SHALL render a global authenticated shell built on the Nuxt UI dashboard suite (`UDashboardGroup` + `UDashboardSidebar` + `UDashboardNavbar`), composed of two regions — a **top bar** (navbar inside the panel) and a **full-height left sidebar** — wrapping the page outlet. The shell SHALL expose named slots/regions for: brand, primary navigation, a sidebar footer **account control** (identity + logout via menu), a reserved running-timer region in the top bar, and the page content (`<NuxtPage />`). The shell SHALL NOT render a top-bar utility menu. Logout from REQ-061 SHALL remain reachable from the sidebar footer account control on every authenticated route (open the account control, then activate Log out). Locale and theme controls SHALL NOT appear in the shell chrome; they live on the settings page (user-settings, ui-theming, internationalization).

#### Scenario: Shell renders on an authenticated route
- **WHEN** an authenticated user navigates to any page using the `default` layout
- **THEN** the top bar, the full-height sidebar, and the page content region SHALL all render, with the page content shown via `<NuxtPage />`

#### Scenario: Logout remains reachable
- **WHEN** the shell is rendered
- **THEN** the sidebar footer SHALL expose an account control that can open a menu containing Log out, and activating Log out SHALL clear the session and navigate to `/login`

#### Scenario: Utility menu excludes locale and theme
- **WHEN** the authenticated shell is rendered
- **THEN** it SHALL NOT offer locale or theme selection controls in the sidebar or top bar (there is no top-bar utility menu)

### Requirement: REQ-066 Desktop collapsible rail with persisted state
On desktop viewports (≥ the `lg` breakpoint) the sidebar SHALL render as a static full-height rail that the user can toggle between a full (labelled) state and an icon-only (collapsed) state, using `UDashboardSidebar`'s built-in `collapsible` behavior. The desktop collapse/expand control SHALL be available in the top bar (navbar) left region. The chosen state SHALL be persisted and restored on subsequent loads without a visual flash (SSR-safe, cookie-backed). When collapsed, the brand region SHALL show a short brand mark (`layout.brandShort`) centered in the header until a dedicated app icon exists; when expanded, it SHALL show the full application title.

#### Scenario: User collapses the rail
- **WHEN** a desktop user activates the top-bar collapse control while the rail is full
- **THEN** the rail SHALL collapse to icon-only and the navigation SHALL remain operable

#### Scenario: Rail state survives reload
- **WHEN** a desktop user has set the rail to icon-only and reloads the application
- **THEN** the rail SHALL render in the icon-only state on first paint without flashing the full state

### Requirement: REQ-067 Off-canvas drawer below the lg breakpoint
On viewports below the `lg` breakpoint the sidebar SHALL be hidden and presented as an off-canvas drawer (the `UDashboardSidebar` mobile slideover) opened by the top-bar menu toggle control (mobile-only), with a scrim, focus trapping while open, and dismissal via `Escape` or scrim activation. The reserved timer region SHALL remain present in the top bar at this tier. The mobile menu toggle SHALL appear in the top bar on viewports below `lg` and SHALL NOT appear on desktop. The desktop rail collapse control SHALL NOT appear below `lg`.

#### Scenario: Drawer opens and traps focus
- **WHEN** a user below the `lg` breakpoint activates the menu toggle
- **THEN** the sidebar SHALL open as a drawer with a scrim and keyboard focus SHALL be trapped within it

#### Scenario: Drawer closes on Escape
- **WHEN** the drawer is open and the user presses `Escape`
- **THEN** the drawer SHALL close and focus SHALL return to the menu toggle control

#### Scenario: Mobile drawer shows expanded footer identity
- **WHEN** the mobile drawer is open
- **THEN** the sidebar footer SHALL show the expanded account control presentation (`UUser` identity row as the menu trigger), not the desktop collapsed avatar-only trigger

### Requirement: REQ-068 Top bar hosts centered timer and right-side utility menu
The top bar (`UDashboardNavbar`) SHALL host the reserved timer region at every viewport width (a single instance — no separate stacked row beneath the bar). The timer region SHALL use the remaining width of the top bar after the left control cluster, left-aligned (not centered in a capped max-width column). The top bar's right region SHALL NOT host a utility menu or user/logout control. The left region SHALL host the mobile sidebar open control below `lg` and the desktop rail collapse control at `lg` and above.

#### Scenario: Timer stays centered in the top bar
- **WHEN** the shell is rendered at any viewport width
- **THEN** the reserved timer region SHALL render left-aligned within the remaining top-bar width (after the left control cluster) rather than in a centered capped-width column or a row beneath the bar

#### Scenario: Utility menu is on the top bar right
- **WHEN** the shell is rendered
- **THEN** the top bar's right region SHALL NOT render a utility menu or logout control

#### Scenario: Left controls are breakpoint-appropriate
- **WHEN** the shell is rendered below `lg`
- **THEN** the top bar left SHALL expose the mobile sidebar open control and SHALL NOT expose the desktop rail collapse control
- **WHEN** the shell is rendered at `lg` or above
- **THEN** the top bar left SHALL expose the desktop rail collapse control and SHALL NOT expose the mobile sidebar open control

### Requirement: REQ-069 Logout-only utility menu
The sidebar footer SHALL present a single **account control** for the authenticated user on every authenticated route (replacing the former top-bar utility menu). Primary identity text SHALL be the trimmed `displayName` when non-empty, otherwise the user's email. When a non-empty `displayName` is shown, the email SHALL appear as a secondary description line. When only email is available as the primary line, the secondary email line SHALL be omitted. Locale and theme controls SHALL NOT appear in the footer or top bar.

The account control SHALL open a dropdown menu that includes Log out (i18n label and logout icon). Activating Log out SHALL clear the session and navigate to `/login`.

On the **expanded** desktop rail and in the **mobile drawer**, the account control trigger SHALL be a user identity presentation (avatar initial plus primary name/email and optional secondary email), implemented with Nuxt UI `UUser` (or equivalent) as a button.

On the **desktop icon-only (collapsed)** rail, the account control trigger SHALL be an **avatar** (initial) control that opens the **same** account menu. It SHALL NOT require a separate always-visible logout row; identity text MAY be omitted from the collapsed trigger itself.

All footer and menu labels SHALL come from the i18n catalogs with `en`/`pl` parity.

#### Scenario: Utility menu is a single top-bar entry
- **WHEN** the shell is rendered at any viewport size
- **THEN** logout SHALL be reachable from the sidebar footer account menu (not from a top-bar utility menu)

#### Scenario: Locale and theme are not in the utility menu
- **WHEN** the sidebar footer account menu is opened
- **THEN** language and theme options SHALL be absent from that menu and from the shell chrome

#### Scenario: Expanded footer shows name and email
- **WHEN** the sidebar is expanded (or the mobile drawer is open) and the user has a non-empty display name and an email
- **THEN** the account control trigger SHALL show the display name as the primary line, the email as a secondary line, and an avatar initial, and opening the control SHALL expose Log out

#### Scenario: Expanded footer falls back to email only
- **WHEN** the sidebar is expanded and the user has no non-empty display name
- **THEN** the account control trigger SHALL show the email as the primary identity line without a duplicate secondary email line, and opening the control SHALL expose Log out

#### Scenario: Collapsed footer is logout icon only
- **WHEN** the desktop sidebar is collapsed to icon-only
- **THEN** the footer account control trigger SHALL be an avatar (initial) that opens the account menu containing Log out, and SHALL NOT show a separate full-width labelled logout row outside the menu

### Requirement: REQ-070 Reserved timer region hosts the live timer widget
The shell's reserved running-timer region SHALL host the live timer widget instead of a placeholder, left-aligned in the remaining top-bar width at every viewport width (a single instance — no separate stacked row). The widget SHALL provide a title input (autocomplete over existing tasks) that grows to fill available horizontal space within the widget, an elapsed-time display, and an icon-only start/stop control aligned to the right of the widget. Start SHALL use a play icon; stop SHALL use a square icon; both SHALL use a ghost button variant. The start/stop control SHALL remain labelled for assistive technology (`aria-label` from i18n) and SHALL expose pressed state while a timer is running. While a timer is running, the stop control SHALL present a stronger visual affordance by **animating the stop icon’s color** (not opacity-pulsing the entire button and not a background halo), and that continuous animation SHALL be omitted when the user prefers reduced motion. The elapsed display SHALL use the same button control type for idle and running states so font metrics stay consistent; when idle the elapsed control SHALL be non-activatable (disabled) and SHALL NOT open the start editor; when running it MAY open the start-time editor. Whenever a timer is running the widget SHALL display the running entry's title and live elapsed time (the persistent running indicator). The widget SHALL derive styling from Tailwind utilities and Nuxt UI `--ui-*` design tokens, meet WCAG 2.1 AA (labelled, keyboard-operable controls), and source all user-facing strings from the i18n catalogs with `en`/`pl` parity.

#### Scenario: Timer widget renders centered in the top bar
- **WHEN** an authenticated user views the shell at any viewport width
- **THEN** the reserved timer region SHALL render the live timer widget left-aligned in the remaining top-bar width rather than a centered capped-width placeholder or a row beneath the bar

#### Scenario: Utility menu renders on the top bar right
- **WHEN** the shell is rendered
- **THEN** the top bar's right region SHALL NOT render a utility menu or logout control

#### Scenario: Running indicator shown while a timer runs
- **WHEN** the authenticated user has a running entry
- **THEN** the widget SHALL display the running entry's title (or blank untitled title) and its live elapsed time

#### Scenario: Widget controls are accessible
- **WHEN** the timer widget is rendered
- **THEN** its title input and start/stop control SHALL be labelled, keyboard operable, and styled from Nuxt UI design tokens

#### Scenario: Title grows and controls sit on the right
- **WHEN** the timer widget is rendered
- **THEN** the title input SHALL grow to consume free horizontal space within the widget and the elapsed display and start/stop control SHALL sit to the right of the title input

#### Scenario: Start and stop are icon-only with accessible names
- **WHEN** the timer is idle
- **THEN** the toggle control SHALL show a play icon without a visible Start label and SHALL expose an accessible name for start
- **WHEN** the timer is running
- **THEN** the toggle control SHALL show a square icon without a visible Stop label, SHALL expose an accessible name for stop, and SHALL indicate a pressed/running state

#### Scenario: Running stop has a stronger affordance
- **WHEN** a timer is running and the user does not prefer reduced motion
- **THEN** the stop **icon** SHALL animate its color (stronger than static error styling alone)
- **WHEN** a timer is running and the user prefers reduced motion
- **THEN** the stop control SHALL remain visually distinct without requiring continuous animation

### Requirement: REQ-071 Accessible shell navigation
The shell SHALL meet WCAG 2.1 AA for its navigation chrome. The sidebar SHALL be a `<nav>` landmark with an accessible name (`aria-label`), and its links SHALL be rendered natively by `UNavigationMenu` from the `navItems` definition (icon + label) rather than through a custom per-item slot. Each navigation link SHALL be addressable by its destination `href` (e.g. `a[href="/trackers"]`) for test and automation hooks, the link matching the current route SHALL expose `aria-current="page"`, and the menu toggle SHALL expose `aria-expanded` reflecting the sidebar/drawer open state. When the desktop rail is icon-only, each primary navigation item SHALL expose a text tooltip with that item's navigation label. The shell SHALL be fully operable by keyboard.

#### Scenario: Current route is indicated
- **WHEN** the user is on a route represented in the sidebar
- **THEN** the corresponding navigation link SHALL expose `aria-current="page"`

#### Scenario: Toggle exposes expanded state
- **WHEN** the sidebar/drawer is opened or closed via the mobile menu toggle
- **THEN** the control's `aria-expanded` value SHALL reflect the current open state

#### Scenario: Links are rendered natively and addressable by href
- **WHEN** the sidebar navigation is rendered
- **THEN** each destination SHALL render as a single native `UNavigationMenu` link (icon + label) with no custom per-item slot, and SHALL be selectable by its `href` (e.g. `[data-testid="app-sidebar"] a[href="/"]` for Timer and `a[href="/trackers"]` for Trackers)

#### Scenario: Collapsed rail shows nav tooltips
- **WHEN** the desktop sidebar is collapsed to icon-only and the user focuses or hovers a primary navigation icon
- **THEN** a text tooltip SHALL present that destination's navigation label
