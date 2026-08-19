## MODIFIED Requirements

### Requirement: REQ-066 Desktop collapsible rail with persisted state
On desktop viewports (≥ the `lg` breakpoint) the sidebar SHALL render as a static full-height rail that the user can toggle between a full (labelled) state and an icon-only (collapsed) state, using `UDashboardSidebar`'s built-in `collapsible` behavior. The desktop collapse/expand control SHALL be available in the top bar (navbar) left region. The chosen state SHALL be persisted and restored on subsequent loads without a visual flash (SSR-safe, cookie-backed). When expanded, the brand region SHALL show the application brand mark beside the full application title (`layout.title`). When collapsed, the brand region SHALL show the same brand mark centered in the header and SHALL NOT show the full title or a short letter-only substitute. The collapsed mark SHALL expose the full application title as its accessible name.

#### Scenario: User collapses the rail
- **WHEN** a desktop user activates the top-bar collapse control while the rail is full
- **THEN** the rail SHALL collapse to icon-only and the navigation SHALL remain operable

#### Scenario: Rail state survives reload
- **WHEN** a desktop user has set the rail to icon-only and reloads the application
- **THEN** the rail SHALL render in the icon-only state on first paint without flashing the full state

#### Scenario: Expanded brand shows mark and title
- **WHEN** the desktop sidebar is expanded
- **THEN** the brand region SHALL show the application brand mark beside the full application title

#### Scenario: Collapsed brand shows the mark only
- **WHEN** the desktop sidebar is collapsed to icon-only
- **THEN** the brand region SHALL show the application brand mark, SHALL NOT show the full title, and SHALL NOT show a short letter-only brand string

#### Scenario: Collapsed mark is named
- **WHEN** the desktop sidebar is collapsed to icon-only
- **THEN** the brand mark SHALL expose the full application title as its accessible name
