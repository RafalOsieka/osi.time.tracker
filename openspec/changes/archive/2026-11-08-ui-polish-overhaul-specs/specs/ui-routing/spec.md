## MODIFIED Requirements

### Requirement: REQ-060 Public login page on the auth layout
The application SHALL expose a public `/login` page that renders the login form on the `auth` layout, with the `login-form`, `email`, `password`, `login-button` and `login-error` test hooks. The auth layout heading SHALL show the application brand mark with the full application title (`layout.title`); the mark is decorative and the title remains the heading text.

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
- **THEN** the auth layout heading SHALL show the application brand mark with the full application title, and assistive technology SHALL read only the title
