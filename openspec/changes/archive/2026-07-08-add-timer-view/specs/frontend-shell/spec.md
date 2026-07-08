# frontend-shell Delta

## MODIFIED Requirements

### Requirement: REQ-AUTH-011 Sidebar navigation skeleton with placeholder routes
The sidebar SHALL present the v1 destination skeleton — Timer, Clients, Projects, Reports, Settings — as navigation links. The Timer link SHALL route to `/`, which renders the timer view (the main working page); there SHALL be no Tasks navigation entry and no Dashboard entry. Destinations that do not yet have a real feature page SHALL route to a placeholder page rather than a broken route. All navigation labels SHALL come from the i18n catalogs with `en`/`pl` parity.

#### Scenario: All skeleton destinations are listed
- **WHEN** the sidebar is rendered
- **THEN** it SHALL list links for Timer, Clients, Projects, Reports, and Settings — and SHALL NOT list Tasks or Dashboard

#### Scenario: Timer link opens the timer view
- **WHEN** the user activates the Timer link
- **THEN** the application SHALL navigate to `/` and render the timer view page

#### Scenario: Unbuilt destination resolves to a placeholder
- **WHEN** the user activates a destination that has no real feature page yet
- **THEN** the application SHALL navigate to a placeholder page for that destination without a routing error
