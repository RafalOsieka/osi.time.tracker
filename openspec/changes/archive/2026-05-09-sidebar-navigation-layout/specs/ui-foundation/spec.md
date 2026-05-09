## ADDED Requirements

### Requirement: Application Layout Structure
The system SHALL render all pages inside a `DefaultLayout.vue` component that provides the sidebar shell and a `<RouterView />` outlet. `App.vue` SHALL contain only a bare `<RouterView />`.

#### Scenario: Layout shell renders on every page
- **WHEN** the user navigates to any routed page (`/tracker`, `/reports`, `/publish`, `/settings`)
- **THEN** `DefaultLayout.vue` is rendered with `AppSidebar` and the page content in the router outlet

#### Scenario: App.vue is a bare router outlet
- **WHEN** the application starts
- **THEN** `App.vue` renders only `<RouterView />` with no additional chrome or layout elements
