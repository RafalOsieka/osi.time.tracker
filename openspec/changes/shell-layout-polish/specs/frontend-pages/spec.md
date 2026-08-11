## MODIFIED Requirements

### Requirement: REQ-061 Authenticated home page on the default layout
The application SHALL expose a `/` page that renders within the `default` layout (timer view / authenticated home). Logout reachability for authenticated pages is part of the shell (see `frontend-shell` REQ-064 / REQ-069).

#### Scenario: Authenticated user sees the welcome placeholder
- **WHEN** an authenticated user navigates to `/`
- **THEN** the home page SHALL render inside the `default` layout

#### Scenario: Logout is available on every authenticated page
- **WHEN** the `default` layout is rendered
- **THEN** a logout control (`logout-button`) SHALL be present in the sidebar footer, and triggering it SHALL clear the session and navigate to `/login`
