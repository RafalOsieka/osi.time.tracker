## MODIFIED Requirements

### Requirement: REQ-059 File-based routing shell
The application SHALL activate Nuxt's file-based router. `app/app.vue` SHALL render only the UI provider root wrapping `<NuxtLoadingIndicator />`, `<NuxtRouteAnnouncer />`, and `<NuxtLayout><NuxtPage /></NuxtLayout>`, delegating all page content to files under `app/pages/`. The loading indicator SHALL use the theme's primary color token so it follows light and dark themes.

#### Scenario: Router renders the matched page
- **WHEN** a user navigates to a route that maps to a page under `app/pages/`
- **THEN** the application SHALL render that page inside its resolved layout via `<NuxtPage />`

#### Scenario: Route changes are announced
- **WHEN** a route change completes
- **THEN** `<NuxtRouteAnnouncer />` SHALL announce the new route for assistive technologies

#### Scenario: Route change shows progress
- **WHEN** a client-side route change starts and has not yet finished
- **THEN** a progress bar SHALL be visible at the top of the viewport and SHALL disappear when the change finishes

### Requirement: REQ-061 Authenticated home page on the default layout
The application SHALL expose a `/` page that renders within the `default` layout as the timer view (authenticated home). The page SHALL present a page-level header with title and primary create action for adding a manual time entry (shared header pattern used by other management pages). Initial timer-view data SHALL be available from SSR per time-tracking REQ-396 / REQ-395. Logout reachability for authenticated pages is part of the shell (see `ui-shell` REQ-064 / REQ-069): the sidebar footer account control opens a menu that includes Log out.

#### Scenario: Authenticated user sees the welcome placeholder
- **WHEN** an authenticated user navigates to `/`
- **THEN** the home page SHALL render the timer view (authenticated home) inside the `default` layout

#### Scenario: Page header offers add entry
- **WHEN** an authenticated user views `/`
- **THEN** the page header SHALL expose a primary control to open the manual add-entry dialog

#### Scenario: Logout is available on every authenticated page
- **WHEN** the `default` layout is rendered
- **THEN** the sidebar footer SHALL expose an account control from which the user can open a menu and activate Log out, clearing the session and navigating to `/login`

## ADDED Requirements

### Requirement: REQ-391 Client navigation does not wait for page data
On client-side navigation, an authenticated page SHALL NOT delay the route change on its data requests. The new page SHALL render immediately and show a loading state (skeleton or equivalent, never an "empty" state) for data still pending, then fill in when the data arrives. To avoid a flash on fast responses, the loading state SHALL appear only after the data has been pending for 150 ms; before that the page SHALL show neither the loading state nor an empty state. On the initial server-rendered request, page data SHALL still be resolved during SSR so first paint contains it. A failed load SHALL show the page's error state, not a stuck loading state.

#### Scenario: Fast responses show no loading flash
- **WHEN** a page's data arrives within 150 ms of a client navigation
- **THEN** the page SHALL go straight to its data without ever rendering the loading state

#### Scenario: Navigation switches before data arrives
- **WHEN** the user navigates client-side from one authenticated page to another whose data request is still pending
- **THEN** the destination page SHALL be shown before that request completes, with its loading state once the request has been pending for 150 ms

#### Scenario: Loading state is not confused with empty data
- **WHEN** a page's list data is still pending after client navigation
- **THEN** the page SHALL NOT render its "no items" empty state until the response confirms there are no items

#### Scenario: Server-rendered first paint still contains data
- **WHEN** an authenticated page is requested directly (full page load with SSR)
- **THEN** the HTML response SHALL contain the page rendered with its data, not the loading state

#### Scenario: Failed load leaves the loading state
- **WHEN** a page's data request fails after client navigation
- **THEN** the page SHALL replace the loading state with its error state

#### Scenario: Report pages do not block navigation
- **WHEN** the user navigates client-side to `/reports/monthly` or `/reports/client`
- **THEN** the route change SHALL complete without waiting for the report, preset, or tracker requests
