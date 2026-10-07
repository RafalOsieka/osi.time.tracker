# ui-routing Specification

## Purpose
Which pages exist and who may see them: a public login page, private-by-default routes guarded during server rendering, safe redirects after login, and navigation that never waits for page data.

## Requirements

### Requirement: REQ-059 File-based routing shell
The application SHALL use file-based routing, rendering each page inside its layout. Every completed route change SHALL be announced to assistive technologies, and a progress bar in the theme's primary color SHALL show at the top of the viewport while a client-side route change is in progress.

#### Scenario: Router renders the matched page
- **WHEN** a user navigates to a route that maps to a page under `app/pages/`
- **THEN** the application SHALL render that page inside its resolved layout

#### Scenario: Route changes are announced
- **WHEN** a route change completes
- **THEN** the new route SHALL be announced for assistive technologies

#### Scenario: Route change shows progress
- **WHEN** a client-side route change starts and has not yet finished
- **THEN** a progress bar SHALL be visible at the top of the viewport and SHALL disappear when the change finishes

### Requirement: REQ-060 Public login page on the auth layout
The application SHALL expose a public `/login` page that renders the login form on the `auth` layout, with the `login-form`, `email`, `password`, `login-button` and `login-error` test hooks. The auth layout heading SHALL show the application brand mark beside the full application title (`layout.title`); the mark is decorative and the title remains the heading text.

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

### Requirement: REQ-061 Authenticated home page on the default layout
The application SHALL expose a `/` page that renders the timer view (the authenticated home) within the `default` layout. The page SHALL present a page-level header with a title and a primary action for adding a manual time entry. Initial timer-view data SHALL be available from SSR (tracking-timer-view REQ-396, tracking-api REQ-395). Logout is reachable from the shell's account menu (ui-shell REQ-064, REQ-405).

#### Scenario: Authenticated user sees the timer view
- **WHEN** an authenticated user navigates to `/`
- **THEN** the home page SHALL render the timer view (authenticated home) inside the `default` layout

#### Scenario: Page header offers add entry
- **WHEN** an authenticated user views `/`
- **THEN** the page header SHALL expose a primary control to open the manual add-entry dialog

### Requirement: REQ-062 Private-by-default navigation guard
A single global middleware SHALL protect every route. A page is private unless it declares `public: true`. The guard SHALL run during SSR using the session cookie and SHALL NOT use browser-only APIs.

#### Scenario: Unauthenticated access to a private route redirects to login
- **WHEN** an unauthenticated visitor navigates to a private route
- **THEN** the guard SHALL redirect to `/login?redirect=<to.fullPath>`

#### Scenario: Authenticated access to login redirects away
- **WHEN** an authenticated user navigates to `/login`
- **THEN** the guard SHALL redirect to the sanitized `?redirect` target, or `/` when none is present

#### Scenario: Deep link survives the login round-trip
- **WHEN** an unauthenticated visitor follows a deep link and then logs in
- **THEN** the application SHALL navigate to the originally requested path after authentication

#### Scenario: Open-redirect attempt is rejected
- **WHEN** the `?redirect` value is absolute or protocol-relative (e.g. `//evil.com`) rather than a same-origin path starting with a single `/`
- **THEN** the guard SHALL ignore it and use `/` instead

### Requirement: REQ-063 No login flash and accessible routing
Route protection SHALL resolve server-side so that protected markup is never painted for unauthenticated users (no login flash). The guard MUST NOT reference `window`, `localStorage`, or other browser-only globals, and route-change announcements SHALL be preserved.

#### Scenario: No protected markup before redirect
- **WHEN** an unauthenticated visitor requests a private route
- **THEN** the redirect SHALL be resolved during SSR before any protected page markup is sent to the browser

#### Scenario: Guard runs without browser globals
- **WHEN** the guard executes on the server
- **THEN** it SHALL complete without referencing browser-only APIs

### Requirement: REQ-391 Client navigation does not wait for page data
On client-side navigation, an authenticated page SHALL render immediately and show a loading state (never its "empty" state) for data still pending, without delay, then fill in when the data arrives. On a full page load, page data SHALL be resolved during SSR using the request's session cookie, so the first paint contains it, including an empty state. A failed load SHALL show the page's error state, not a stuck loading state.

#### Scenario: Navigation switches before data arrives
- **WHEN** the user navigates client-side from one authenticated page to another whose data request is still pending
- **THEN** the destination page SHALL be shown with its loading state before that request completes

#### Scenario: Loading state is not confused with empty data
- **WHEN** a page's list data is still pending after client navigation
- **THEN** the page SHALL NOT render its "no items" empty state until the response confirms there are no items

#### Scenario: Server-rendered first paint still contains data
- **WHEN** an authenticated page such as `/trackers` or `/projects` is requested directly (full page load with SSR)
- **THEN** the HTML response SHALL contain the page rendered with its data, not the loading state, without depending on a client fetch after mount

#### Scenario: Hard reload empty state
- **WHEN** an authenticated user with no items performs a full document load of a list page
- **THEN** the page SHALL render its empty state from the SSR-resolved empty list without a mandatory client fetch

#### Scenario: SSR list uses the session cookie
- **WHEN** a page resolves its data during SSR
- **THEN** the request SHALL carry the session cookie of the incoming HTTP request

#### Scenario: Failed load leaves the loading state
- **WHEN** a page's data request fails after client navigation
- **THEN** the page SHALL replace the loading state with its error state

#### Scenario: Report pages do not block navigation
- **WHEN** the user navigates client-side to `/reports/monthly` or `/reports/client`
- **THEN** the route change SHALL complete without waiting for the report, preset, or tracker requests
