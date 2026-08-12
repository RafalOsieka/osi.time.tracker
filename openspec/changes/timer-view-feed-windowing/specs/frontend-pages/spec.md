## MODIFIED Requirements

### Requirement: REQ-061 Authenticated home page on the default layout
The application SHALL expose a `/` page that renders within the `default` layout as the timer view (authenticated home). The page SHALL present a page-level header with title and primary create action for adding a manual time entry (shared header pattern used by other management pages). Initial timer-view data SHALL be available from SSR per time-tracking REQ-150 / REQ-264. Logout reachability for authenticated pages is part of the shell (see `frontend-shell` REQ-064 / REQ-069): the sidebar footer account control opens a menu that includes Log out.

#### Scenario: Authenticated user sees the welcome placeholder
- **WHEN** an authenticated user navigates to `/`
- **THEN** the home page SHALL render the timer view (authenticated home) inside the `default` layout

#### Scenario: Page header offers add entry
- **WHEN** an authenticated user views `/`
- **THEN** the page header SHALL expose a primary control to open the manual add-entry dialog

#### Scenario: Logout is available on every authenticated page
- **WHEN** the `default` layout is rendered
- **THEN** the sidebar footer SHALL expose an account control from which the user can open a menu and activate Log out, clearing the session and navigating to `/login`
