## ADDED Requirements

### Requirement: REQ-301 Document title is page plus brand

Every rendered app route SHALL set the HTML document title to `{page} | {brand}` where `{brand}` is the translated `layout.title` string and `{page}` is the translated label for the current destination (the same wording as the page heading or sidebar item when one exists). The title SHALL be present on first SSR paint so the tab is never the request hostname. Client navigation and locale changes SHALL update the title without a full reload. The title SHALL NOT include running-timer elapsed time or task names.

#### Scenario: Timer home tab is not the hostname

- **WHEN** an authenticated user opens `/` in English
- **THEN** the document title SHALL be `Timer | OSI Time Tracker` and SHALL NOT be `localhost` or the request host

#### Scenario: Named management pages

- **WHEN** the user is on `/trackers`, `/projects`, `/reports/monthly`, or `/settings` in English
- **THEN** the document title SHALL be `Trackers | OSI Time Tracker`, `Projects | OSI Time Tracker`, `Monthly timesheet | OSI Time Tracker`, or `Settings | OSI Time Tracker` respectively

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
