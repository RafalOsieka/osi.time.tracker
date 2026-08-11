# frontend-shell Specification

## Purpose
Define the global authenticated application shell rendered by the `default` layout — a top bar and a left sidebar wrapping the page outlet — together with its responsive behavior, navigation skeleton, accessibility guarantees, and tokenized styling. The shell exposes named regions for brand, primary navigation, a reserved running-timer region (centered in the top bar), a utility menu (locale, theme, user/logout), and the page content. It adapts across a desktop collapsible rail with persisted SSR-safe state and an off-canvas drawer below the `lg` breakpoint, while meeting WCAG 2.1 AA for its navigation chrome and deriving all styling from Tailwind utilities and Nuxt UI `--ui-*` design tokens.

## Requirements
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

### Requirement: REQ-065 Sidebar navigation skeleton with placeholder routes
The sidebar SHALL present the v1 destination skeleton — Timer, Trackers, Projects, Reports, Settings — as navigation links. The Timer link SHALL route to `/`, which renders the timer view (the main working page); the Trackers link SHALL route to `/trackers`, which renders the Trackers management page; the Settings link SHALL route to `/settings`, which renders the preferences page (REQ-167, user-settings) rather than a placeholder; there SHALL be no Clients navigation entry, no Tasks navigation entry, and no Dashboard entry. Destinations that do not yet have a real feature page SHALL route to a placeholder page rather than a broken route. All navigation labels SHALL come from the i18n catalogs with `en`/`pl` parity.

#### Scenario: All skeleton destinations are listed
- **WHEN** the sidebar is rendered
- **THEN** it SHALL list links for Timer, Trackers, Projects, Reports, and Settings — and SHALL NOT list Clients, Tasks, or Dashboard

#### Scenario: Timer link opens the timer view
- **WHEN** the user activates the Timer link
- **THEN** the application SHALL navigate to `/` and render the timer view page

#### Scenario: Trackers link opens the trackers page
- **WHEN** the user activates the Trackers link
- **THEN** the application SHALL navigate to `/trackers` and render the Trackers management page

#### Scenario: Settings link opens the preferences page
- **WHEN** the user activates the Settings link
- **THEN** the application SHALL navigate to `/settings` and render the preferences form, not a "coming soon" placeholder

#### Scenario: Unbuilt destination resolves to a placeholder
- **WHEN** the user activates a destination that has no real feature page yet
- **THEN** the application SHALL navigate to a placeholder page for that destination without a routing error

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

### Requirement: REQ-072 Tokenized shell styling
The shell SHALL be styled using Tailwind utilities and Nuxt UI `--ui-*` design tokens, with no ad-hoc inline `style` attributes in `default.vue`. Brand accent usage SHALL rely on the configured `primary` color (per REQ-160) rather than inline colors or raw hex values.

#### Scenario: No inline ad-hoc styling in the shell
- **WHEN** the shell is implemented
- **THEN** its layout and color SHALL derive from Tailwind utilities and Nuxt UI design tokens and not from ad-hoc inline `style` attributes

### Requirement: REQ-258 Running entry resolved during authenticated shell SSR
The authenticated `default` layout SHALL resolve the current user's running time entry (`GET /api/time-entries/running`) during server-side rendering of any authenticated route and SHALL seed the shared running-timer state used by the live timer widget before first paint. The SSR fetch SHALL authenticate using the incoming session cookie (cookie-forwarding request fetch), matching other authenticated SSR data loads. When no running entry exists, the shell SHALL seed idle state (`null`) rather than leaving the widget in an unknown pre-fetch idle that could accept start actions incorrectly after hydrate without a resolved server result.

Client-side navigations within an already-hydrated session MAY reuse the shared running-timer state and SHALL NOT require a full page reload to keep the widget correct after start/stop mutations already reflected in that state. After a full document load, the running entry SHALL be present in the initial render payload when the SSR request succeeded.

#### Scenario: Hard reload shows running title without waiting for client mount
- **WHEN** an authenticated user with a running entry performs a full document load of any private route that uses the `default` layout
- **THEN** the initial HTML/payload for that response SHALL already include the running entry so the timer widget can render the running title (or blank untitled title) without depending solely on a post-mount client fetch

#### Scenario: Hard reload with no running entry shows idle controls
- **WHEN** an authenticated user with no running entry performs a full document load of a private route on the `default` layout
- **THEN** the shell SHALL seed idle timer state for first paint and SHALL NOT leave the widget permanently disabled waiting for a client-only fetch that never started

#### Scenario: SSR uses the session cookie
- **WHEN** the shell resolves the running entry during SSR
- **THEN** the request SHALL carry the browser session cookie material available on the incoming HTTP request so the endpoint authorizes the same user as a browser navigation
