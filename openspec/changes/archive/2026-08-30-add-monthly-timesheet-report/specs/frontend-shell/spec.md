## MODIFIED Requirements

### Requirement: REQ-065 Sidebar navigation skeleton with placeholder routes

The sidebar SHALL present the v1 destination skeleton — Timer, Trackers, Projects, Reports, Settings — as navigation links. The Timer link SHALL route to `/`, which renders the timer view (the main working page); the Trackers link SHALL route to `/trackers`, which renders the Trackers management page; the Settings link SHALL route to `/settings`, which renders the preferences page (REQ-167, user-settings) rather than a placeholder; the Reports link SHALL route to `/reports`, which renders the reports hub (reports REQ-288) rather than a placeholder; there SHALL be no Clients navigation entry, no Tasks navigation entry, and no Dashboard entry. The Reports item SHALL remain a single link; it SHALL NOT expand into nested report-type children. Destinations that do not yet have a real feature page SHALL route to a placeholder page rather than a broken route. All navigation labels SHALL come from the i18n catalogs with `en`/`pl` parity.

#### Scenario: All skeleton destinations are listed
- **WHEN** the sidebar is rendered
- **THEN** it SHALL list links for Timer, Trackers, Projects, Reports, and Settings — and SHALL NOT list Clients, Tasks, or Dashboard

#### Scenario: Timer link opens the timer view
- **WHEN** the user activates the Timer link
- **THEN** the application SHALL navigate to `/` and render the timer view page

#### Scenario: Trackers link opens the trackers page
- **WHEN** the user activates the Trackers link
- **THEN** the application SHALL navigate to `/trackers` and render the Trackers management page

#### Scenario: Settings link opens the preferences page
- **WHEN** the user activates the Settings link
- **THEN** the application SHALL navigate to `/settings` and render the preferences form, not a "coming soon" placeholder

#### Scenario: Reports link opens the reports hub
- **WHEN** the user activates the Reports link
- **THEN** the application SHALL navigate to `/reports` and render the reports hub, not a "coming soon" placeholder, and SHALL NOT reveal nested report-type links in the sidebar

#### Scenario: Unbuilt destination resolves to a placeholder
- **WHEN** the user activates a destination that has no real feature page yet
- **THEN** the application SHALL navigate to a placeholder page for that destination without a routing error
