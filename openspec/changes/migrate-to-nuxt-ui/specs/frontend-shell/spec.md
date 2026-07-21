## MODIFIED Requirements

### Requirement: REQ-064 Authenticated shell regions and slots
The `default` layout SHALL render a global authenticated shell built on the Nuxt UI dashboard suite (`UDashboardGroup` + `UDashboardSidebar` + `UDashboardNavbar`), composed of two regions — a **top bar** (navbar) and a **left sidebar** — wrapping the page outlet. The shell SHALL expose named slots/regions for: brand, primary navigation, a reserved running-timer region, a utility menu (locale, theme, user/logout), and the page content (`<NuxtPage />`). The logout control (`logout-button`) from REQ-061 SHALL remain available within the utility menu on every authenticated route.

#### Scenario: Shell renders on an authenticated route
- **WHEN** an authenticated user navigates to any page using the `default` layout
- **THEN** the top bar, the sidebar, and the page content region SHALL all render, with the page content shown via `<NuxtPage />`

#### Scenario: Logout remains reachable
- **WHEN** the shell is rendered
- **THEN** a logout control (`logout-button`) SHALL be present in the utility menu, and triggering it SHALL clear the session and navigate to `/login`

### Requirement: REQ-066 Desktop collapsible rail with persisted state
On desktop viewports (≥ the `lg` breakpoint) the sidebar SHALL render as a static rail that the user can toggle between a full (labelled) state and an icon-only (collapsed) state, using `UDashboardSidebar`'s built-in `collapsible` behavior and its toggle control. The chosen state SHALL be persisted and restored on subsequent loads without a visual flash (SSR-safe, cookie-backed).

#### Scenario: User collapses the rail
- **WHEN** a desktop user activates the collapse control while the rail is full
- **THEN** the rail SHALL collapse to icon-only and the navigation SHALL remain operable

#### Scenario: Rail state survives reload
- **WHEN** a desktop user has set the rail to icon-only and reloads the application
- **THEN** the rail SHALL render in the icon-only state on first paint without flashing the full state

### Requirement: REQ-067 Off-canvas drawer below the lg breakpoint
On viewports below the `lg` breakpoint the sidebar SHALL be hidden and presented as an off-canvas drawer (the `UDashboardSidebar` mobile slideover) opened by the menu toggle control, with a scrim, focus trapping while open, and dismissal via `Escape` or scrim activation. The reserved timer region SHALL remain present and inline within the top bar at this tier.

#### Scenario: Drawer opens and traps focus
- **WHEN** a user below the `lg` breakpoint activates the menu toggle
- **THEN** the sidebar SHALL open as a drawer with a scrim and keyboard focus SHALL be trapped within it

#### Scenario: Drawer closes on Escape
- **WHEN** the drawer is open and the user presses `Escape`
- **THEN** the drawer SHALL close and focus SHALL return to the menu toggle control

### Requirement: REQ-070 Reserved timer region hosts the live timer widget
The shell's reserved running-timer region SHALL host the live timer widget instead of a placeholder, at every responsive tier where the region is present — inline within the top bar (desktop and above the very-small threshold) and in the dedicated full-width stacked row below the very-small threshold. The widget SHALL provide a title input (autocomplete over existing tasks) and a start/stop control, and SHALL display the running entry's title and live elapsed time whenever a timer is running (the persistent running indicator). The widget SHALL derive styling from Tailwind utilities and Nuxt UI `--ui-*` design tokens, meet WCAG 2.1 AA (labelled, keyboard-operable controls), and source all user-facing strings from the i18n catalogs with `en`/`pl` parity.

#### Scenario: Timer widget renders inline in the top bar
- **WHEN** an authenticated user views the shell at or above the very-small threshold
- **THEN** the reserved timer region SHALL render the live timer widget inline within the top bar rather than a placeholder

#### Scenario: Timer widget renders in the stacked row
- **WHEN** the viewport is narrower than the very-small threshold
- **THEN** the live timer widget SHALL render in the dedicated full-width row beneath the top bar

#### Scenario: Running indicator shown while a timer runs
- **WHEN** the authenticated user has a running entry
- **THEN** the widget SHALL display the running entry's title (or "(no task)") and its live elapsed time

#### Scenario: Widget controls are accessible
- **WHEN** the timer widget is rendered
- **THEN** its title input and start/stop control SHALL be labelled, keyboard operable, and styled from Nuxt UI design tokens

### Requirement: REQ-071 Accessible shell navigation
The shell SHALL meet WCAG 2.1 AA for its navigation chrome. The sidebar SHALL be a `<nav>` landmark (as provided by `UDashboardSidebar` / `UNavigationMenu`), the link matching the current route SHALL expose `aria-current="page"`, and the menu toggle SHALL expose `aria-expanded` reflecting the sidebar/drawer state. The shell SHALL be fully operable by keyboard.

#### Scenario: Current route is indicated
- **WHEN** the user is on a route represented in the sidebar
- **THEN** the corresponding navigation link SHALL expose `aria-current="page"`

#### Scenario: Toggle exposes expanded state
- **WHEN** the sidebar/drawer is opened or collapsed via the menu toggle
- **THEN** the control's `aria-expanded` value SHALL reflect the current open/expanded state

### Requirement: REQ-072 Tokenized shell styling
The shell SHALL be styled using Tailwind utilities and Nuxt UI `--ui-*` design tokens, with no ad-hoc inline `style` attributes in `default.vue`. Brand accent usage SHALL rely on the configured `primary` color (per REQ-160) rather than inline colors or raw hex values.

#### Scenario: No inline ad-hoc styling in the shell
- **WHEN** the shell is implemented
- **THEN** its layout and color SHALL derive from Tailwind utilities and Nuxt UI design tokens and not from ad-hoc inline `style` attributes
