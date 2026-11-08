## MODIFIED Requirements

### Requirement: REQ-071 Accessible shell navigation
The shell navigation SHALL meet WCAG 2.1 AA and be fully keyboard operable. The sidebar SHALL be a named `<nav>` landmark whose items render as plain icon-plus-label links addressable by their `href`. The current route's link SHALL expose `aria-current="page"`; on `/reports/monthly` that is the Monthly child, not the Reports group. The menu toggle SHALL expose `aria-expanded`. On the icon-only rail each item SHALL show its label as a tooltip, and Reports SHALL expose its children in a popover.

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
- **THEN** each destination SHALL render as a single link (icon + label) and SHALL be selectable by its `href` (e.g. `[data-testid="app-sidebar"] a[href="/"]` for Timer, `a[href="/trackers"]` for Trackers, and `a[href="/reports/monthly"]` for Monthly timesheet)

#### Scenario: Collapsed rail shows nav tooltips
- **WHEN** the desktop sidebar is collapsed to icon-only and the user focuses or hovers a primary navigation icon
- **THEN** a text tooltip SHALL present that item's navigation label

#### Scenario: Collapsed Reports still reaches Monthly
- **WHEN** the desktop sidebar is collapsed to icon-only
- **THEN** the user SHALL be able to activate Monthly timesheet from the Reports item's popover and navigate to `/reports/monthly`

#### Scenario: Collapsed Reports shows that it opens a menu
- **WHEN** the desktop sidebar is collapsed to icon-only
- **THEN** the Reports item SHALL carry a disclosure mark that the destination links do not have

#### Scenario: Remote Sync keeps the Timer item selected
- **WHEN** the user is on `/sync/{date}`, which has no sidebar link of its own
- **THEN** the Timer item SHALL show the selected style, and no sidebar link SHALL expose `aria-current="page"`

### Requirement: REQ-405 Account menu
The sidebar footer SHALL present one account control on every authenticated route, identified by the user's `displayName` (REQ-397) with the email as a secondary line; a name saved on `/profile` SHALL appear without a reload. Its menu SHALL contain, in order: **Profile** (to `/profile`), the **Theme** submenu (REQ-402), then **Log out** in a separate group, which clears the session and goes to `/login`. No locale control SHALL appear in the footer or top bar. Labels SHALL have `en`/`pl` parity.

#### Scenario: Logout is in the account menu
- **WHEN** the shell is rendered at any viewport size
- **THEN** logout SHALL be reachable from the sidebar footer account menu (not from a top-bar utility menu)

#### Scenario: Account menu contents and order
- **WHEN** the sidebar footer account menu is opened
- **THEN** it SHALL show Profile, then the Theme submenu, then Log out in a separate group, and SHALL NOT show language options

#### Scenario: Profile item opens the profile page
- **WHEN** the user activates Profile in the account menu
- **THEN** the application SHALL navigate to `/profile` and render the profile page

#### Scenario: Footer updates after a display name change
- **WHEN** the user saves a new display name on `/profile`
- **THEN** the account control SHALL show the new display name and its initial without a page reload

#### Scenario: Theme item shows the current choice
- **WHEN** the active theme preference is `system` and the account menu is opened
- **THEN** the Theme item SHALL show the translated name of that choice beside its label without opening the submenu
