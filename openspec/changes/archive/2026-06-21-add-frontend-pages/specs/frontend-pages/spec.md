# frontend-pages Specification

## Purpose
Define the MVP frontend page architecture: file-based routing, the `auth` and `default` layouts, the public login page, the authenticated home page, and a private-by-default navigation guard that protects every route and preserves deep links.

## ADDED Requirements

### Requirement: REQ-AUTH-006 File-based routing shell
The application SHALL activate Nuxt's file-based router. `app/app.vue` SHALL render only `<NuxtRouteAnnouncer />` and `<NuxtLayout><NuxtPage /></NuxtLayout>`, delegating all page content to files under `app/pages/`.


#### Scenario: Router renders the matched page
- **WHEN** a user navigates to a route that maps to a page under `app/pages/`
- **THEN** the application SHALL render that page inside its resolved layout via `<NuxtPage />`

#### Scenario: Route changes are announced
- **WHEN** a route change completes
- **THEN** `<NuxtRouteAnnouncer />` SHALL announce the new route for assistive technologies

### Requirement: REQ-AUTH-007 Public login page on the auth layout
The application SHALL expose a `/login` page that renders the login form within the `auth` layout and is publicly accessible (declares `definePageMeta({ layout: 'auth', public: true })`). The page SHALL preserve the `login-form`, `username`, `password`, `login-button`, and `login-error` test hooks.


#### Scenario: Unauthenticated visitor can view login
- **WHEN** an unauthenticated visitor navigates to `/login`
- **THEN** the login form SHALL render within the `auth` layout without any nav or logout control

#### Scenario: Successful login redirects to target
- **WHEN** the user submits valid credentials and a sanitized same-origin `?redirect` query is present
- **THEN** the application SHALL navigate to that target, otherwise SHALL navigate to `/`

#### Scenario: Failed login shows an error
- **WHEN** login fails
- **THEN** an error message SHALL be shown via the `login-error` hook and the user SHALL remain on `/login`

### Requirement: REQ-AUTH-008 Authenticated home page on the default layout
The application SHALL expose a `/` page that renders an authenticated welcome placeholder (greeting plus the signed-in user) within the `default` layout, preserving the `auth-status` test hook.


#### Scenario: Authenticated user sees the welcome placeholder
- **WHEN** an authenticated user navigates to `/`
- **THEN** the home page SHALL render the greeting and signed-in user inside the `default` layout

#### Scenario: Logout is available on every authenticated page
- **WHEN** the `default` layout is rendered
- **THEN** a logout control (`logout-button`) SHALL be present in the header, and triggering it SHALL clear the session and navigate to `/login`

### Requirement: REQ-AUTH-009 Private-by-default navigation guard
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

### Requirement: REQ-NFR-015 No login flash and accessible routing
Route protection SHALL resolve server-side so that protected markup is never painted for unauthenticated users (no login flash). The guard MUST NOT reference `window`, `localStorage`, or other browser-only globals, and route-change announcements SHALL be preserved.


#### Scenario: No protected markup before redirect
- **WHEN** an unauthenticated visitor requests a private route
- **THEN** the redirect SHALL be resolved during SSR before any protected page markup is sent to the browser

#### Scenario: Guard runs without browser globals
- **WHEN** the guard executes on the server
- **THEN** it SHALL complete without referencing browser-only APIs
