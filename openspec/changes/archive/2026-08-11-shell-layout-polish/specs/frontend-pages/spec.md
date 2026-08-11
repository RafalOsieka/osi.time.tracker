## MODIFIED Requirements

### Requirement: REQ-061 Authenticated home page on the default layout
The application SHALL expose a `/` page that renders within the `default` layout (timer view / authenticated home). Logout reachability for authenticated pages is part of the shell (see `frontend-shell` REQ-064 / REQ-069): the sidebar footer account control opens a menu that includes Log out.

#### Scenario: Authenticated user sees the welcome placeholder
- **WHEN** an authenticated user navigates to `/`
- **THEN** the home page SHALL render inside the `default` layout

#### Scenario: Logout is available on every authenticated page
- **WHEN** the `default` layout is rendered
- **THEN** the sidebar footer SHALL expose an account control from which the user can open a menu and activate Log out, clearing the session and navigating to `/login`
