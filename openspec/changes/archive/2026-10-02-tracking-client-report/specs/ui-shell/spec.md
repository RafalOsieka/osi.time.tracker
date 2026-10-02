## MODIFIED Requirements

### Requirement: REQ-065 Sidebar navigation skeleton with placeholder routes
The sidebar SHALL present the v1 destination skeleton — Timer, Trackers, Projects, Reports, Settings. Timer, Trackers, Projects, and Settings SHALL be navigation links: Timer to `/` (timer view); Trackers to `/trackers`; Settings to `/settings` (preferences, REQ-167). Reports SHALL be a nested group, not a navigation link: it SHALL have no destination href, SHALL NOT navigate when activated, and SHALL keep its nested children visible whenever the sidebar is showing labels (expanded desktop rail or open mobile drawer). The group SHALL include a Monthly timesheet child that routes to `/reports/monthly` (reports REQ-289) and a Client report child that routes to `/reports/client` (REQ-384). There SHALL be no Clients navigation entry, no Tasks navigation entry, no Dashboard entry, and no navigation link to `/reports`. Destinations that do not yet have a real feature page SHALL route to a placeholder page rather than a broken route. All navigation labels SHALL come from the i18n catalogs with `en`/`pl` parity.

#### Scenario: All skeleton destinations are listed
- **WHEN** the sidebar is rendered
- **THEN** it SHALL list links for Timer, Trackers, Projects, Monthly timesheet, Client report, and Settings — and SHALL NOT list Clients, Tasks, Dashboard, or a Reports destination link to `/reports`

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
- **WHEN** the user looks for Reports in the sidebar
- **THEN** the application SHALL NOT navigate to a `/reports` hub; Monthly timesheet and Client report SHALL be nested children that open `/reports/monthly` and `/reports/client`

#### Scenario: Monthly child opens the monthly timesheet
- **WHEN** the labelled sidebar is showing and the user activates the Monthly timesheet child
- **THEN** the application SHALL navigate to `/reports/monthly` and render the monthly timesheet

#### Scenario: Client report child opens the client report
- **WHEN** the labelled sidebar is showing and the user activates the Client report child
- **THEN** the application SHALL navigate to `/reports/client` and render the client report page

#### Scenario: Reports group does not navigate
- **WHEN** the user activates the Reports group control
- **THEN** the application SHALL NOT navigate and SHALL NOT expose an `href` of `/reports`

#### Scenario: Reports children stay visible on the labelled rail
- **WHEN** the desktop sidebar is expanded or the mobile drawer is open
- **THEN** the Monthly timesheet and Client report children SHALL be visible without the user first expanding Reports

#### Scenario: Unbuilt destination resolves to a placeholder
- **WHEN** the user activates a destination that has no real feature page yet
- **THEN** the application SHALL navigate to a placeholder page for that destination without a routing error
