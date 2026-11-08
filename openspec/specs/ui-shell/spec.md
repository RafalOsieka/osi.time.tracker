# ui-shell Specification

## Purpose
Define the authenticated application shell: a top bar and a left sidebar around the page, the navigation and account menu they offer, how they adapt between a collapsible desktop rail and a mobile drawer, their accessibility, and the running entry and document title they resolve on first paint. The live timer widget in the top bar is specified in `tracking-timer-widget`.

## Requirements

### Requirement: REQ-064 Authenticated shell regions and slots
The `default` layout SHALL render an authenticated shell of a **top bar** and a **full-height left sidebar** around the page content, with regions for the brand, primary navigation, a sidebar footer **account control**, a running-timer region in the top bar, and the page. The shell SHALL NOT render a top-bar utility menu; Log out SHALL be reachable on every authenticated route from the account control. The account menu contents, and the absence of a locale control, are in REQ-405.

#### Scenario: Shell renders on an authenticated route
- **WHEN** an authenticated user navigates to any page using the `default` layout
- **THEN** the top bar, the full-height sidebar, and the page content region SHALL all render

#### Scenario: Logout remains reachable
- **WHEN** the shell is rendered
- **THEN** the sidebar footer SHALL expose an account control that can open a menu containing Log out, and activating Log out SHALL clear the session and navigate to `/login`

#### Scenario: Shell chrome has no locale control
- **WHEN** the authenticated shell is rendered
- **THEN** it SHALL NOT offer a locale control anywhere in the sidebar or top bar, and SHALL offer theme selection only inside the sidebar footer account menu (there is no top-bar utility menu)

### Requirement: REQ-066 Desktop collapsible rail with persisted state
At or above the `lg` breakpoint the sidebar SHALL be a full-height rail that the user toggles between labelled and icon-only states with a control in the top bar's left region. The state SHALL persist in a cookie and be restored on first paint without a flash. Expanded, the brand region SHALL show the brand mark beside the full title (`layout.title`). Collapsed, it SHALL show only the brand mark, centered, never the title or a letter substitute, with the full title as its accessible name.

#### Scenario: User collapses the rail
- **WHEN** a desktop user activates the top-bar collapse control while the rail is full
- **THEN** the rail SHALL collapse to icon-only and the navigation SHALL remain operable

#### Scenario: Rail state survives reload
- **WHEN** a desktop user has set the rail to icon-only and reloads the application
- **THEN** the rail SHALL render in the icon-only state on first paint without flashing the full state

#### Scenario: Expanded brand shows mark and title
- **WHEN** the desktop sidebar is expanded
- **THEN** the brand region SHALL show the application brand mark beside the full application title

#### Scenario: Collapsed brand shows the mark only
- **WHEN** the desktop sidebar is collapsed to icon-only
- **THEN** the brand region SHALL show the application brand mark, SHALL NOT show the full title, and SHALL NOT show a short letter-only brand string

#### Scenario: Collapsed mark is named
- **WHEN** the desktop sidebar is collapsed to icon-only
- **THEN** the brand mark SHALL expose the full application title as its accessible name

### Requirement: REQ-067 Off-canvas drawer below the lg breakpoint
Below the `lg` breakpoint the sidebar SHALL be hidden and open as an off-canvas drawer from a menu toggle in the top bar, with a scrim, focus trapped while open, and dismissal via `Escape` or the scrim. The timer region SHALL stay in the top bar. The menu toggle SHALL appear only below `lg`, and the desktop rail control only at `lg` and above.

#### Scenario: Drawer opens and traps focus
- **WHEN** a user below the `lg` breakpoint activates the menu toggle
- **THEN** the sidebar SHALL open as a drawer with a scrim and keyboard focus SHALL be trapped within it

#### Scenario: Drawer closes on Escape
- **WHEN** the drawer is open and the user presses `Escape`
- **THEN** the drawer SHALL close and focus SHALL return to the menu toggle control

#### Scenario: Mobile drawer shows expanded footer identity
- **WHEN** the mobile drawer is open
- **THEN** the sidebar footer SHALL show the expanded account control presentation (identity row as the menu trigger), not the desktop collapsed avatar-only trigger

### Requirement: REQ-068 Top bar hosts the timer region and sidebar toggles
The top bar SHALL host a single timer region at every viewport width, never a separate row beneath it. The timer region SHALL fill the width left after the left control cluster, left-aligned rather than in a centered capped-width column. The left region SHALL hold the mobile sidebar open control below `lg` and the desktop rail control at `lg` and above. The right region SHALL NOT host a utility menu or logout control.

#### Scenario: Timer fills the rest of the top bar
- **WHEN** the shell is rendered at any viewport width
- **THEN** the reserved timer region SHALL render left-aligned within the remaining top-bar width (after the left control cluster) rather than in a centered capped-width column or a row beneath the bar

#### Scenario: No utility menu on the top bar
- **WHEN** the shell is rendered
- **THEN** the top bar's right region SHALL NOT render a utility menu or logout control

#### Scenario: Left controls are breakpoint-appropriate
- **WHEN** the shell is rendered below `lg`
- **THEN** the top bar left SHALL expose the mobile sidebar open control and SHALL NOT expose the desktop rail collapse control
- **WHEN** the shell is rendered at `lg` or above
- **THEN** the top bar left SHALL expose the desktop rail collapse control and SHALL NOT expose the mobile sidebar open control

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

### Requirement: REQ-258 Running entry resolved during authenticated shell SSR
During SSR of any authenticated route, the `default` layout SHALL fetch the user's running entry (`GET /api/time-entries/running`) with the request's session cookie and seed the shared running-timer state before first paint, seeding idle (`null`) when there is none, so the widget never accepts start actions against an unresolved state. Client navigations MAY reuse that state and SHALL NOT need a reload to stay correct after start/stop.

#### Scenario: Hard reload shows running title without waiting for client mount
- **WHEN** an authenticated user with a running entry performs a full document load of any private route that uses the `default` layout
- **THEN** the initial HTML/payload for that response SHALL already include the running entry so the timer widget can render the running title (or blank untitled title) without depending solely on a post-mount client fetch

#### Scenario: Hard reload with no running entry shows idle controls
- **WHEN** an authenticated user with no running entry performs a full document load of a private route on the `default` layout
- **THEN** the shell SHALL seed idle timer state for first paint and SHALL NOT leave the widget permanently disabled waiting for a client-only fetch that never started

#### Scenario: SSR uses the session cookie
- **WHEN** the shell resolves the running entry during SSR
- **THEN** the request SHALL carry the browser session cookie material available on the incoming HTTP request so the endpoint authorizes the same user as a browser navigation

### Requirement: REQ-301 Document title is page plus brand
Every route SHALL set the document title to `{page} | {brand}`, where `{brand}` is the translated `layout.title` and `{page}` the translated label of the destination (the heading or sidebar wording when one exists). The title SHALL be present on the first SSR paint, never the request hostname, and SHALL update on client navigation and locale change without a reload. It SHALL NOT include running-timer time or task names.

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

### Requirement: REQ-404 Sidebar navigation skeleton with placeholder routes
The sidebar SHALL list Timer (`/`), Trackers (`/trackers`), Projects and a Reports group. Reports SHALL have no `href` and not navigate; its children Monthly timesheet (`/reports/monthly`, REQ-289) and Client report (`/reports/client`, REQ-384) stay visible while labels show. There SHALL be no Settings, Profile, Clients, Tasks, Dashboard or `/reports` entry (Profile is in REQ-405). An unbuilt destination SHALL route to a placeholder. Labels SHALL have `en`/`pl` parity.

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

#### Scenario: Reports has no hub page
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

### Requirement: REQ-428 Account control trigger per sidebar state
On the expanded desktop rail and in the mobile drawer, the account control trigger SHALL be an identity button: an avatar with the display name's initial, the display name, and the email as a secondary line. On the icon-only desktop rail it SHALL be an avatar (the initial) whose accessible name is the display name and which opens the same account menu; no separate logout row SHALL be shown outside the menu.

#### Scenario: Expanded footer shows name and email
- **WHEN** the sidebar is expanded (or the mobile drawer is open)
- **THEN** the account control trigger SHALL show the display name as the primary line, the email as a secondary line, and an avatar initial, and opening the control SHALL expose Profile, Theme, and Log out

#### Scenario: Collapsed footer is an avatar
- **WHEN** the desktop sidebar is collapsed to icon-only
- **THEN** the footer account control trigger SHALL be an avatar (initial) that opens the account menu containing Profile, Theme, and Log out, and SHALL NOT show a separate full-width labelled logout row outside the menu
