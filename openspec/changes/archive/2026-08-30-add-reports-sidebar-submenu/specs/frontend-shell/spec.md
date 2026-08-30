## MODIFIED Requirements

### Requirement: REQ-065 Sidebar navigation skeleton with placeholder routes

The sidebar SHALL present the v1 destination skeleton — Timer, Trackers, Projects, Reports, Settings. Timer, Trackers, Projects, and Settings SHALL be navigation links: Timer to `/` (timer view); Trackers to `/trackers`; Settings to `/settings` (preferences, REQ-167). Reports SHALL be a nested group, not a navigation link: it SHALL have no destination href, SHALL NOT navigate when activated, and SHALL keep its nested children visible whenever the sidebar is showing labels (expanded desktop rail or open mobile drawer). The group SHALL include a Monthly timesheet child that routes to `/reports/monthly` (reports REQ-289). There SHALL be no Clients navigation entry, no Tasks navigation entry, no Dashboard entry, and no navigation link to `/reports`. Destinations that do not yet have a real feature page SHALL route to a placeholder page rather than a broken route. All navigation labels SHALL come from the i18n catalogs with `en`/`pl` parity.

#### Scenario: All skeleton destinations are listed
- **WHEN** the sidebar is rendered
- **THEN** it SHALL list links for Timer, Trackers, Projects, Monthly timesheet, and Settings — and SHALL NOT list Clients, Tasks, Dashboard, or a Reports destination link to `/reports`

#### Scenario: Timer link opens the timer view
- **WHEN** the user activates the Timer link
- **THEN** the application SHALL navigate to `/` and render the timer view page

#### Scenario: Trackers link opens the trackers page
- **WHEN** the user activates the Trackers link
- **THEN** the application SHALL navigate to `/trackers` and render the Trackers management page

#### Scenario: Settings link opens the preferences page
- **WHEN** the user activates the Settings link
- **THEN** the application SHALL navigate to `/settings` and render the preferences form, not a "coming soon" placeholder

#### Scenario: Reports link opens the reports hub
- **WHEN** the user looks for Reports in the sidebar
- **THEN** the application SHALL NOT navigate to a `/reports` hub; Monthly timesheet SHALL be a nested child that opens `/reports/monthly`

#### Scenario: Monthly child opens the monthly timesheet
- **WHEN** the labelled sidebar is showing and the user activates the Monthly timesheet child
- **THEN** the application SHALL navigate to `/reports/monthly` and render the monthly timesheet

#### Scenario: Reports group does not navigate
- **WHEN** the user activates the Reports group control
- **THEN** the application SHALL NOT navigate and SHALL NOT expose an `href` of `/reports`

#### Scenario: Reports children stay visible on the labelled rail
- **WHEN** the desktop sidebar is expanded or the mobile drawer is open
- **THEN** the Monthly timesheet child SHALL be visible without the user first expanding Reports

#### Scenario: Unbuilt destination resolves to a placeholder
- **WHEN** the user activates a destination that has no real feature page yet
- **THEN** the application SHALL navigate to a placeholder page for that destination without a routing error

### Requirement: REQ-071 Accessible shell navigation

The shell SHALL meet WCAG 2.1 AA for its navigation chrome. The sidebar SHALL be a `<nav>` landmark with an accessible name (`aria-label`), and its links SHALL be rendered natively by `UNavigationMenu` from the `navItems` definition (icon + label) rather than through a custom per-item slot. Each navigation link SHALL be addressable by its destination `href` (e.g. `a[href="/trackers"]`) for test and automation hooks, including `a[href="/reports/monthly"]` for Monthly timesheet. The link matching the current route SHALL expose `aria-current="page"`; when the route is `/reports/monthly` that SHALL be the Monthly child, not the Reports group. The menu toggle SHALL expose `aria-expanded` reflecting the sidebar/drawer open state. When the desktop rail is icon-only, each primary navigation item SHALL expose a text tooltip with that item's navigation label, and the Reports group SHALL expose its children (Monthly timesheet) through a popover so the child remains operable. The shell SHALL be fully operable by keyboard.

#### Scenario: Current route is indicated
- **WHEN** the user is on a route represented in the sidebar
- **THEN** the corresponding navigation link SHALL expose `aria-current="page"`

#### Scenario: Monthly route marks the child, not the group
- **WHEN** the user is on `/reports/monthly`
- **THEN** the Monthly timesheet link SHALL expose `aria-current="page"` and the Reports group SHALL NOT be a current-page link

#### Scenario: Toggle exposes expanded state
- **WHEN** the sidebar/drawer is opened or closed via the mobile menu toggle
- **THEN** the control's `aria-expanded` value SHALL reflect the current open state

#### Scenario: Links are rendered natively and addressable by href
- **WHEN** the sidebar navigation is rendered
- **THEN** each destination SHALL render as a single native `UNavigationMenu` link (icon + label) with no custom per-item slot, and SHALL be selectable by its `href` (e.g. `[data-testid="app-sidebar"] a[href="/"]` for Timer, `a[href="/trackers"]` for Trackers, and `a[href="/reports/monthly"]` for Monthly timesheet)

#### Scenario: Collapsed rail shows nav tooltips
- **WHEN** the desktop sidebar is collapsed to icon-only and the user focuses or hovers a primary navigation icon
- **THEN** a text tooltip SHALL present that item's navigation label

#### Scenario: Collapsed Reports still reaches Monthly
- **WHEN** the desktop sidebar is collapsed to icon-only
- **THEN** the user SHALL be able to activate Monthly timesheet from the Reports item's popover and navigate to `/reports/monthly`
