## MODIFIED Requirements

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

### Requirement: REQ-069 Logout-only utility menu
At every responsive tier the user/logout control SHALL be collapsed into a single utility menu rather than rendered as a loose top-bar control. The utility menu SHALL expose logout (and MAY show a minimal user identity affordance such as an avatar initial) and SHALL NOT expose locale or theme controls. All control labels SHALL come from the i18n catalogs with `en`/`pl` parity.

#### Scenario: Utility menu is a single top-bar entry
- **WHEN** the shell is rendered at any viewport size
- **THEN** logout SHALL be reachable through a single utility menu in the top bar

#### Scenario: Locale and theme are not in the utility menu
- **WHEN** the utility menu is opened
- **THEN** language and theme options SHALL be absent from that menu
