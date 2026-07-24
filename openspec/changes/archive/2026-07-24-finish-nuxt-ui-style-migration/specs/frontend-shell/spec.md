## MODIFIED Requirements

### Requirement: REQ-071 Accessible shell navigation
The shell SHALL meet WCAG 2.1 AA for its navigation chrome. The sidebar SHALL be a `<nav>` landmark with an accessible name (`aria-label`), and its links SHALL be rendered natively by `UNavigationMenu` from the `navItems` definition (icon + label) rather than through a custom per-item slot. Each navigation link SHALL be addressable by its destination `href` (e.g. `a[href="/clients"]`) for test and automation hooks, the link matching the current route SHALL expose `aria-current="page"`, and the menu toggle SHALL expose `aria-expanded` reflecting the sidebar/drawer state. The shell SHALL be fully operable by keyboard.

#### Scenario: Current route is indicated
- **WHEN** the user is on a route represented in the sidebar
- **THEN** the corresponding navigation link SHALL expose `aria-current="page"`

#### Scenario: Toggle exposes expanded state
- **WHEN** the sidebar/drawer is opened or collapsed via the menu toggle
- **THEN** the control's `aria-expanded` value SHALL reflect the current open/expanded state

#### Scenario: Links are rendered natively and addressable by href
- **WHEN** the sidebar navigation is rendered
- **THEN** each destination SHALL render as a single native `UNavigationMenu` link (icon + label) with no custom per-item slot, and SHALL be selectable by its `href` (e.g. `[data-testid="app-sidebar"] a[href="/"]` for Timer)
