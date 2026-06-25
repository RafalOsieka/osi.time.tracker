# frontend-shell Specification

## Purpose
Define the global authenticated application shell rendered by the `default` layout — a top bar and a left sidebar wrapping the page outlet — together with its responsive behavior, navigation skeleton, accessibility guarantees, and tokenized styling. The shell exposes named regions for brand, primary navigation, a reserved running-timer region, a utility menu (locale, theme, user/logout), and the page content. It adapts across a desktop collapsible rail with persisted SSR-safe state, an off-canvas drawer below the `lg` breakpoint, and a very-small stacked layout with a full-width timer row, while meeting WCAG 2.1 AA for its navigation chrome and deriving all styling from PrimeVue theme tokens.

## Requirements
### Requirement: REQ-AUTH-010 Authenticated shell regions and slots
The `default` layout SHALL render a global authenticated shell composed of two regions — a **top bar** and a **left sidebar** — wrapping the page outlet. The shell SHALL expose named slots/regions for: brand, primary navigation, a reserved running-timer region, a utility menu (locale, theme, user/logout), and the page content (`<NuxtPage />`). The logout control (`logout-button`) from REQ-AUTH-008 SHALL remain available within the utility menu on every authenticated route.

#### Scenario: Shell renders on an authenticated route
- **WHEN** an authenticated user navigates to any page using the `default` layout
- **THEN** the top bar, the sidebar, and the page content region SHALL all render, with the page content shown via `<NuxtPage />`

#### Scenario: Logout remains reachable
- **WHEN** the shell is rendered
- **THEN** a logout control (`logout-button`) SHALL be present in the utility menu, and triggering it SHALL clear the session and navigate to `/login`

### Requirement: REQ-AUTH-011 Sidebar navigation skeleton with placeholder routes
The sidebar SHALL present the full v1 destination skeleton — Dashboard, Clients, Projects, Tasks, Reports, Settings — as navigation links. Destinations that do not yet have a real feature page SHALL route to a placeholder page rather than a broken route. All navigation labels SHALL come from the i18n catalogs with `en`/`pl` parity.

#### Scenario: All skeleton destinations are listed
- **WHEN** the sidebar is rendered
- **THEN** it SHALL list links for Dashboard, Clients, Projects, Tasks, Reports, and Settings

#### Scenario: Unbuilt destination resolves to a placeholder
- **WHEN** the user activates a destination that has no real feature page yet
- **THEN** the application SHALL navigate to a placeholder page for that destination without a routing error

### Requirement: REQ-AUTH-012 Desktop collapsible rail with persisted state
On desktop viewports (≥ the `lg` breakpoint) the sidebar SHALL render as a static rail that the user can toggle between a full (labelled) state and an icon-only state using the `☰` control. The chosen state SHALL be persisted and restored on subsequent loads without a visual flash (SSR-safe, cookie-backed).

#### Scenario: User collapses the rail
- **WHEN** a desktop user activates the `☰` control while the rail is full
- **THEN** the rail SHALL collapse to icon-only and the navigation SHALL remain operable

#### Scenario: Rail state survives reload
- **WHEN** a desktop user has set the rail to icon-only and reloads the application
- **THEN** the rail SHALL render in the icon-only state on first paint without flashing the full state

### Requirement: REQ-AUTH-013 Off-canvas drawer below the lg breakpoint
On viewports below the `lg` breakpoint the sidebar SHALL be hidden and presented as an off-canvas drawer opened by the `☰` control, with a scrim, focus trapping while open, and dismissal via `Escape` or scrim activation. The reserved timer region SHALL remain present and inline within the top bar at this tier.

#### Scenario: Drawer opens and traps focus
- **WHEN** a user below the `lg` breakpoint activates `☰`
- **THEN** the sidebar SHALL open as a drawer with a scrim and keyboard focus SHALL be trapped within it

#### Scenario: Drawer closes on Escape
- **WHEN** the drawer is open and the user presses `Escape`
- **THEN** the drawer SHALL close and focus SHALL return to the `☰` control

### Requirement: REQ-AUTH-014 Very-small stacked layout with full-width timer row
Below a **configurable** very-small threshold (distinct from the `lg` breakpoint, with a sensible default tunable without a spec change) the top bar SHALL contain only the brand, the `☰` control, and the utility menu. The reserved timer region SHALL move to its own full-width row directly beneath the top bar, and the page content SHALL stack below that row — never beside the timer region.

#### Scenario: Timer drops to its own row
- **WHEN** the viewport is narrower than the configurable very-small threshold
- **THEN** the reserved timer region SHALL occupy a dedicated full-width row beneath the top bar, with page content stacked below it

#### Scenario: Timer stays inline above the threshold
- **WHEN** the viewport is at or above the configurable very-small threshold
- **THEN** the reserved timer region SHALL render inline within the top bar row

### Requirement: REQ-AUTH-015 Collapsed utility cluster
At every responsive tier the locale, theme, and user/logout controls SHALL be collapsed into a single utility menu rather than rendered as loose top-bar controls. All control labels SHALL come from the i18n catalogs with `en`/`pl` parity.

#### Scenario: Utility controls live behind one menu
- **WHEN** the shell is rendered at any viewport size
- **THEN** the locale, theme, and user/logout controls SHALL be reachable through a single utility menu

### Requirement: REQ-NFR-020 Accessible shell navigation
The shell SHALL meet WCAG 2.1 AA for its navigation chrome. The sidebar SHALL be a `<nav>` landmark, the link matching the current route SHALL expose `aria-current="page"`, and the `☰` toggle SHALL expose `aria-expanded` reflecting the sidebar/drawer state. The shell SHALL be fully operable by keyboard.

#### Scenario: Current route is indicated
- **WHEN** the user is on a route represented in the sidebar
- **THEN** the corresponding navigation link SHALL expose `aria-current="page"`

#### Scenario: Toggle exposes expanded state
- **WHEN** the sidebar/drawer is opened or collapsed via the `☰` control
- **THEN** the control's `aria-expanded` value SHALL reflect the current open/expanded state

### Requirement: REQ-NFR-021 Tokenized shell styling
The shell SHALL be styled using PrimeVue theme tokens, replacing the ad-hoc inline styles currently in `default.vue`. Brand accent usage SHALL rely on the existing `primary` token (per project theming guidelines) rather than inline colors.

#### Scenario: No inline ad-hoc styling in the shell
- **WHEN** the shell is implemented
- **THEN** its layout and color SHALL derive from PrimeVue theme tokens and not from ad-hoc inline `style` attributes
