## MODIFIED Requirements

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
