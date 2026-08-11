# frontend-shell Specification

## Purpose
Define the global authenticated application shell rendered by the `default` layout — a top bar and a left sidebar wrapping the page outlet — together with its responsive behavior, navigation skeleton, accessibility guarantees, and tokenized styling. The shell exposes named regions for brand, primary navigation, a reserved running-timer region (centered in the top bar), a utility menu (locale, theme, user/logout), and the page content. It adapts across a desktop collapsible rail with persisted SSR-safe state and an off-canvas drawer below the `lg` breakpoint, while meeting WCAG 2.1 AA for its navigation chrome and deriving all styling from Tailwind utilities and Nuxt UI `--ui-*` design tokens.

## Requirements
### Requirement: REQ-064 Authenticated shell regions and slots
The `default` layout SHALL render a global authenticated shell built on the Nuxt UI dashboard suite (`UDashboardGroup` + `UDashboardSidebar` + `UDashboardNavbar`), composed of two regions — a **top bar** (navbar) and a **left sidebar** — wrapping the page outlet. The shell SHALL expose named slots/regions for: brand, primary navigation, a reserved running-timer region, a utility menu (user/logout only), and the page content (`<NuxtPage />`). The logout control (`logout-button`) from REQ-061 SHALL remain available within the utility menu on every authenticated route. Locale and theme controls SHALL NOT appear in the utility menu; they live on the settings page (user-settings, ui-theming, internationalization).

#### Scenario: Shell renders on an authenticated route
- **WHEN** an authenticated user navigates to any page using the `default` layout
- **THEN** the top bar, the sidebar, and the page content region SHALL all render, with the page content shown via `<NuxtPage />`

#### Scenario: Logout remains reachable
- **WHEN** the shell is rendered
- **THEN** a logout control (`logout-button`) SHALL be present in the utility menu, and triggering it SHALL clear the session and navigate to `/login`

#### Scenario: Utility menu excludes locale and theme
- **WHEN** the utility menu is opened
- **THEN** it SHALL NOT offer locale or theme selection controls

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
On desktop viewports (≥ the `lg` breakpoint) the sidebar SHALL render as a static rail that the user can toggle between a full (labelled) state and an icon-only (collapsed) state, using `UDashboardSidebar`'s built-in `collapsible` behavior and its toggle control. The chosen state SHALL be persisted and restored on subsequent loads without a visual flash (SSR-safe, cookie-backed).

#### Scenario: User collapses the rail
- **WHEN** a desktop user activates the collapse control while the rail is full
- **THEN** the rail SHALL collapse to icon-only and the navigation SHALL remain operable

#### Scenario: Rail state survives reload
- **WHEN** a desktop user has set the rail to icon-only and reloads the application
- **THEN** the rail SHALL render in the icon-only state on first paint without flashing the full state

### Requirement: REQ-067 Off-canvas drawer below the lg breakpoint
On viewports below the `lg` breakpoint the sidebar SHALL be hidden and presented as an off-canvas drawer (the `UDashboardSidebar` mobile slideover) opened by the `UDashboardNavbar` menu toggle control (mobile-only), with a scrim, focus trapping while open, and dismissal via `Escape` or scrim activation. The reserved timer region SHALL remain present and centered within the top bar at this tier.

#### Scenario: Drawer opens and traps focus
- **WHEN** a user below the `lg` breakpoint activates the menu toggle
- **THEN** the sidebar SHALL open as a drawer with a scrim and keyboard focus SHALL be trapped within it

#### Scenario: Drawer closes on Escape
- **WHEN** the drawer is open and the user presses `Escape`
- **THEN** the drawer SHALL close and focus SHALL return to the menu toggle control

### Requirement: REQ-068 Top bar hosts centered timer and right-side utility menu
The top bar (`UDashboardNavbar`) SHALL always host the reserved timer region in its center at every viewport width (a single instance — no separate stacked row beneath the bar). The utility menu SHALL render in the top bar's right region. The mobile sidebar toggle SHALL appear in the top bar on viewports below `lg` and SHALL NOT appear on desktop.

#### Scenario: Timer stays centered in the top bar
- **WHEN** the shell is rendered at any viewport width
- **THEN** the reserved timer region SHALL render centered within the top bar rather than in a row beneath it

#### Scenario: Utility menu is on the top bar right
- **WHEN** the shell is rendered
- **THEN** the utility menu SHALL render in the top bar's right region

### Requirement: REQ-069 Logout-only utility menu
At every responsive tier the user/logout control SHALL be collapsed into a single utility menu rather than rendered as a loose top-bar control. The utility menu SHALL expose logout (and MAY show a minimal user identity affordance such as an avatar initial) and SHALL NOT expose locale or theme controls. All control labels SHALL come from the i18n catalogs with `en`/`pl` parity.

#### Scenario: Utility menu is a single top-bar entry
- **WHEN** the shell is rendered at any viewport size
- **THEN** logout SHALL be reachable through a single utility menu in the top bar

#### Scenario: Locale and theme are not in the utility menu
- **WHEN** the utility menu is opened
- **THEN** language and theme options SHALL be absent from that menu

### Requirement: REQ-070 Reserved timer region hosts the live timer widget
The shell's reserved running-timer region SHALL host the live timer widget instead of a placeholder, centered in the `UDashboardNavbar` at every viewport width (a single instance — no separate stacked row). The navbar right slot SHALL host the utility menu. The widget SHALL provide a title input (autocomplete over existing tasks) and a start/stop control, and SHALL display the running entry's title and live elapsed time whenever a timer is running (the persistent running indicator). The widget SHALL derive styling from Tailwind utilities and Nuxt UI `--ui-*` design tokens, meet WCAG 2.1 AA (labelled, keyboard-operable controls), and source all user-facing strings from the i18n catalogs with `en`/`pl` parity.

#### Scenario: Timer widget renders centered in the top bar
- **WHEN** an authenticated user views the shell at any viewport width
- **THEN** the reserved timer region SHALL render the live timer widget centered within the top bar rather than a placeholder or a row beneath it

#### Scenario: Utility menu renders on the top bar right
- **WHEN** the shell is rendered
- **THEN** the utility menu SHALL render in the top bar's right region

#### Scenario: Running indicator shown while a timer runs
- **WHEN** the authenticated user has a running entry
- **THEN** the widget SHALL display the running entry's title (or "(no task)") and its live elapsed time

#### Scenario: Widget controls are accessible
- **WHEN** the timer widget is rendered
- **THEN** its title input and start/stop control SHALL be labelled, keyboard operable, and styled from Nuxt UI design tokens

### Requirement: REQ-071 Accessible shell navigation
The shell SHALL meet WCAG 2.1 AA for its navigation chrome. The sidebar SHALL be a `<nav>` landmark with an accessible name (`aria-label`), and its links SHALL be rendered natively by `UNavigationMenu` from the `navItems` definition (icon + label) rather than through a custom per-item slot. Each navigation link SHALL be addressable by its destination `href` (e.g. `a[href="/trackers"]`) for test and automation hooks, the link matching the current route SHALL expose `aria-current="page"`, and the menu toggle SHALL expose `aria-expanded` reflecting the sidebar/drawer state. The shell SHALL be fully operable by keyboard.

#### Scenario: Current route is indicated
- **WHEN** the user is on a route represented in the sidebar
- **THEN** the corresponding navigation link SHALL expose `aria-current="page"`

#### Scenario: Toggle exposes expanded state
- **WHEN** the sidebar/drawer is opened or collapsed via the menu toggle
- **THEN** the control's `aria-expanded` value SHALL reflect the current open/expanded state

#### Scenario: Links are rendered natively and addressable by href
- **WHEN** the sidebar navigation is rendered
- **THEN** each destination SHALL render as a single native `UNavigationMenu` link (icon + label) with no custom per-item slot, and SHALL be selectable by its `href` (e.g. `[data-testid="app-sidebar"] a[href="/"]` for Timer and `a[href="/trackers"]` for Trackers)

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
