## MODIFIED Requirements

### Requirement: REQ-064 Authenticated shell regions and slots
The `default` layout SHALL render a global authenticated shell built on the Nuxt UI dashboard suite (`UDashboardGroup` + `UDashboardSidebar` + `UDashboardNavbar`), composed of two regions — a **top bar** (navbar inside the panel) and a **full-height left sidebar** — wrapping the page outlet. The shell SHALL expose named slots/regions for: brand, primary navigation, a sidebar footer **account control** (identity + account menu), a reserved running-timer region in the top bar, and the page content (`<NuxtPage />`). The shell SHALL NOT render a top-bar utility menu. Logout from REQ-061 SHALL remain reachable from the sidebar footer account control on every authenticated route (open the account control, then activate Log out). The locale control SHALL NOT appear in the shell chrome; it lives on the `/profile` page (core-i18n REQ-401). The theme control SHALL live only in the sidebar footer account menu (ui-theming REQ-402) and SHALL NOT appear elsewhere in the sidebar or top bar.

#### Scenario: Shell renders on an authenticated route
- **WHEN** an authenticated user navigates to any page using the `default` layout
- **THEN** the top bar, the full-height sidebar, and the page content region SHALL all render, with the page content shown via `<NuxtPage />`

#### Scenario: Logout remains reachable
- **WHEN** the shell is rendered
- **THEN** the sidebar footer SHALL expose an account control that can open a menu containing Log out, and activating Log out SHALL clear the session and navigate to `/login`

#### Scenario: Utility menu excludes locale and theme
- **WHEN** the authenticated shell is rendered
- **THEN** it SHALL NOT offer a locale control anywhere in the sidebar or top bar, and SHALL offer theme selection only inside the sidebar footer account menu (there is no top-bar utility menu)

### Requirement: REQ-301 Document title is page plus brand

Every rendered app route SHALL set the HTML document title to `{page} | {brand}` where `{brand}` is the translated `layout.title` string and `{page}` is the translated label for the current destination (the same wording as the page heading or sidebar item when one exists). The title SHALL be present on first SSR paint so the tab is never the request hostname. Client navigation and locale changes SHALL update the title without a full reload. The title SHALL NOT include running-timer elapsed time or task names.

#### Scenario: Timer home tab is not the hostname

- **WHEN** an authenticated user opens `/` in English
- **THEN** the document title SHALL be `Timer | OSI Time Tracker` and SHALL NOT be `localhost` or the request host

#### Scenario: Named management pages

- **WHEN** the user is on `/trackers`, `/projects`, `/reports/monthly`, or `/profile` in English
- **THEN** the document title SHALL be `Trackers | OSI Time Tracker`, `Projects | OSI Time Tracker`, `Monthly timesheet | OSI Time Tracker`, or `Profile | OSI Time Tracker` respectively

#### Scenario: Login uses the auth layout

- **WHEN** an unauthenticated user opens `/login` in English
- **THEN** the document title SHALL be `{login page label} | OSI Time Tracker` from the catalogs, not the hostname

#### Scenario: Sync day interpolates the date

- **WHEN** an authenticated user opens `/sync/{date}`
- **THEN** the page segment SHALL use the existing remote-sync page title (including the date) before the brand suffix

#### Scenario: Locale change updates the tab

- **WHEN** the active locale changes from `en` to `pl` on a titled page
- **THEN** both the page segment and the brand SHALL render from the `pl` catalog without requiring a full navigation

#### Scenario: Client navigation updates the tab

- **WHEN** the user navigates from `/` to `/projects` without a full page load
- **THEN** the document title SHALL change from the Timer form to the Projects form

#### Scenario: Unknown route still has a brand title

- **WHEN** the app renders a not-found or other page without a dedicated heading key
- **THEN** the document title SHALL still include `layout.title` and SHALL NOT fall back to the request hostname

## ADDED Requirements

### Requirement: REQ-404 Sidebar navigation skeleton with placeholder routes
The sidebar SHALL present the v1 destination skeleton — Timer, Trackers, Projects, Reports. Timer, Trackers, and Projects SHALL be navigation links: Timer to `/` (timer view); Trackers to `/trackers`. There SHALL be no Settings or Profile navigation entry; the profile page is reached from the account menu (REQ-405). Reports SHALL be a nested group, not a navigation link: it SHALL have no destination href, SHALL NOT navigate when activated, and SHALL keep its nested children visible whenever the sidebar is showing labels (expanded desktop rail or open mobile drawer). The group SHALL include a Monthly timesheet child that routes to `/reports/monthly` (reports REQ-289) and a Client report child that routes to `/reports/client` (REQ-384). There SHALL be no Clients navigation entry, no Tasks navigation entry, no Dashboard entry, and no navigation link to `/reports`. Destinations that do not yet have a real feature page SHALL route to a placeholder page rather than a broken route. All navigation labels SHALL come from the i18n catalogs with `en`/`pl` parity.

#### Scenario: All skeleton destinations are listed
- **WHEN** the sidebar is rendered
- **THEN** it SHALL list links for Timer, Trackers, Projects, Monthly timesheet, and Client report — and SHALL NOT list Settings, Profile, Clients, Tasks, Dashboard, or a Reports destination link to `/reports`

#### Scenario: Timer link opens the timer view
- **WHEN** the user activates the Timer link
- **THEN** the application SHALL navigate to `/` and render the timer view page

#### Scenario: Trackers link opens the trackers page
- **WHEN** the user activates the Trackers link
- **THEN** the application SHALL navigate to `/trackers` and render the Trackers management page

#### Scenario: No Settings link
- **WHEN** the sidebar navigation is rendered at any viewport size
- **THEN** it SHALL NOT contain a link to `/settings` or `/profile`

#### Scenario: Reports link opens the reports hub
- **WHEN** the user looks for Reports in the sidebar
- **THEN** the application SHALL NOT navigate to a `/reports` hub; Monthly timesheet and Client report SHALL be nested children that open `/reports/monthly` and `/reports/client`

#### Scenario: Monthly child opens the monthly timesheet
- **WHEN** the labelled sidebar is showing and the user activates the Monthly timesheet child
- **THEN** the application SHALL navigate to `/reports/monthly` and render the monthly timesheet

#### Scenario: Client report child opens the client report
- **WHEN** the labelled sidebar is showing and the user activates the Client report child
- **THEN** the application SHALL navigate to `/reports/client` and render the client report page

#### Scenario: Reports group does not navigate
- **WHEN** the user activates the Reports group control
- **THEN** the application SHALL NOT navigate and SHALL NOT expose an `href` of `/reports`

#### Scenario: Reports children stay visible on the labelled rail
- **WHEN** the desktop sidebar is expanded or the mobile drawer is open
- **THEN** the Monthly timesheet and Client report children SHALL be visible without the user first expanding Reports

#### Scenario: Unbuilt destination resolves to a placeholder
- **WHEN** the user activates a destination that has no real feature page yet
- **THEN** the application SHALL navigate to a placeholder page for that destination without a routing error

### Requirement: REQ-405 Account menu
The sidebar footer SHALL present a single **account control** for the authenticated user on every authenticated route (replacing the former top-bar utility menu). The primary identity text SHALL be the user's `displayName` (always non-empty, workspace-settings REQ-397), and the email SHALL appear as a secondary description line. The locale control SHALL NOT appear in the footer or top bar.

The account control SHALL open a dropdown menu with, in order: a **Profile** item (user icon) that navigates to `/profile`; a **Theme** submenu (ui-theming REQ-402); then, in a separate group, **Log out** (logout icon). Activating Log out SHALL clear the session and navigate to `/login`. A display name saved on `/profile` SHALL be reflected in the account control without a reload.

On the **expanded** desktop rail and in the **mobile drawer**, the account control trigger SHALL be a user identity presentation (avatar initial plus display name and secondary email), implemented with Nuxt UI `UUser` (or equivalent) as a button.

On the **desktop icon-only (collapsed)** rail, the account control trigger SHALL be an **avatar** (initial of the display name) control with the display name as its accessible name, opening the **same** account menu. It SHALL NOT require a separate always-visible logout row; identity text MAY be omitted from the collapsed trigger itself.

All footer and menu labels SHALL come from the i18n catalogs with `en`/`pl` parity.

#### Scenario: Utility menu is a single top-bar entry
- **WHEN** the shell is rendered at any viewport size
- **THEN** logout SHALL be reachable from the sidebar footer account menu (not from a top-bar utility menu)

#### Scenario: Account menu contents and order
- **WHEN** the sidebar footer account menu is opened
- **THEN** it SHALL show Profile, then the Theme submenu, then Log out in a separate group, and SHALL NOT show language options

#### Scenario: Profile item opens the profile page
- **WHEN** the user activates Profile in the account menu
- **THEN** the application SHALL navigate to `/profile` and render the profile page

#### Scenario: Expanded footer shows name and email
- **WHEN** the sidebar is expanded (or the mobile drawer is open)
- **THEN** the account control trigger SHALL show the display name as the primary line, the email as a secondary line, and an avatar initial, and opening the control SHALL expose Profile, Theme, and Log out

#### Scenario: Footer updates after a display name change
- **WHEN** the user saves a new display name on `/profile`
- **THEN** the account control SHALL show the new display name and its initial without a page reload

#### Scenario: Collapsed footer is logout icon only
- **WHEN** the desktop sidebar is collapsed to icon-only
- **THEN** the footer account control trigger SHALL be an avatar (initial) that opens the account menu containing Profile, Theme, and Log out, and SHALL NOT show a separate full-width labelled logout row outside the menu

## REMOVED Requirements

### Requirement: REQ-065 Sidebar navigation skeleton with placeholder routes
**Reason**: The Settings navigation link is removed.
**Migration**: See REQ-404 Sidebar navigation skeleton with placeholder routes.

### Requirement: REQ-069 Logout-only utility menu
**Reason**: The account menu gains Profile and Theme items and the email-only fallback is gone because the display name is required.
**Migration**: See REQ-405 Account menu.
