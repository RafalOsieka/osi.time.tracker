## ADDED Requirements

### Requirement: Layout Store
The system SHALL provide a `useLayoutStore` Pinia store that manages sidebar UI state.

#### Scenario: Sidebar collapsed state initialized from localStorage
- **WHEN** the application starts
- **THEN** `useLayoutStore` initializes `sidebarCollapsed` from `localStorage` (defaulting to `false` if not set)

#### Scenario: Sidebar collapsed state persisted to localStorage
- **WHEN** the user toggles the sidebar collapsed state
- **THEN** the new value is saved to `localStorage` so it survives page reloads
