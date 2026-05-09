# app-navigation Specification

## Purpose
TBD - created by archiving change sidebar-navigation-layout. Update Purpose after archive.
## Requirements
### Requirement: Persistent Sidebar Navigation
The system SHALL provide a persistent sidebar containing the app logo, app name, and navigation links to all top-level pages.

#### Scenario: Sidebar visible on desktop
- **WHEN** the user opens the application on a desktop viewport (≥ lg breakpoint)
- **THEN** the sidebar is visible and displays the app logo, app name, and nav links for Tracker, Reports, Publish, and Settings

#### Scenario: Active nav link highlighted
- **WHEN** the user is on a given page (e.g. `/reports`)
- **THEN** the corresponding nav link in the sidebar is visually highlighted as active

### Requirement: Collapsible Sidebar on Desktop
The system SHALL allow the user to collapse the sidebar to icon-only mode on desktop viewports.

#### Scenario: Collapse sidebar
- **WHEN** the user clicks the collapse toggle at the bottom of the sidebar
- **THEN** the sidebar shrinks to icon-only width and nav labels are hidden

#### Scenario: Expand sidebar
- **WHEN** the sidebar is collapsed and the user clicks the expand toggle
- **THEN** the sidebar expands to full width and nav labels are shown

#### Scenario: Collapsed state persisted
- **WHEN** the user collapses or expands the sidebar
- **THEN** the preference is stored in `localStorage` and restored on next page load

### Requirement: Mobile Overlay Sidebar
The system SHALL hide the sidebar by default on mobile viewports and provide a hamburger button to open it as an overlay.

#### Scenario: Sidebar hidden on mobile by default
- **WHEN** the user opens the application on a mobile viewport (< lg breakpoint)
- **THEN** the sidebar is not visible and a hamburger button is shown in the top bar

#### Scenario: Open sidebar overlay on mobile
- **WHEN** the user taps the hamburger button on mobile
- **THEN** the sidebar slides in as an overlay using PrimeVue Drawer

#### Scenario: Close sidebar overlay on mobile
- **WHEN** the user taps a nav link or the backdrop while the mobile sidebar is open
- **THEN** the sidebar overlay closes

### Requirement: Router-Based Page Navigation
The system SHALL use Vue Router for all page navigation with deep-linkable URLs.

#### Scenario: Direct URL access
- **WHEN** the user navigates directly to `/reports`, `/publish`, or `/settings`
- **THEN** the correct page is rendered without requiring interaction

#### Scenario: Root redirect
- **WHEN** the user navigates to `/`
- **THEN** they are redirected to `/tracker`

#### Scenario: Browser history navigation
- **WHEN** the user navigates between pages and presses the browser back button
- **THEN** the previous page is restored correctly

