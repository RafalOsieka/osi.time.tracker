## MODIFIED Requirements

### Requirement: REQ-060 Public login page on the auth layout
The application SHALL expose a `/login` page that renders the login form within the `auth` layout and is publicly accessible (declares `definePageMeta({ layout: 'auth', public: true })`). The page SHALL preserve the `login-form`, `username`, `password`, `login-button`, and `login-error` test hooks. The auth layout heading SHALL show the application brand mark beside the full application title (`layout.title`). The mark SHALL be decorative relative to the visible title (the title remains the heading text).

#### Scenario: Unauthenticated visitor can view login
- **WHEN** an unauthenticated visitor navigates to `/login`
- **THEN** the login form SHALL render within the `auth` layout without any nav or logout control

#### Scenario: Successful login redirects to target
- **WHEN** the user submits valid credentials and a sanitized same-origin `?redirect` query is present
- **THEN** the application SHALL navigate to that target, otherwise SHALL navigate to `/`

#### Scenario: Failed login shows an error
- **WHEN** login fails
- **THEN** an error message SHALL be shown via the `login-error` hook and the user SHALL remain on `/login`

#### Scenario: Login heading shows mark and title
- **WHEN** the login page is rendered
- **THEN** the auth layout heading SHALL show the application brand mark beside the full application title
