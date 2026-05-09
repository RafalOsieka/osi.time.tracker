# frontend-state-management Specification

## Purpose
TBD - created by archiving change introduce-missing-tech-stack. Update Purpose after archive.
## Requirements
### Requirement: Global state management with Pinia
The frontend application MUST use Pinia for global state management to ensure reactivity and persistence across components.

#### Scenario: Pinia initialization
- **WHEN** the application starts
- **THEN** the Pinia root store is initialized and available to all components

### Requirement: Reactive store patterns
Stores MUST follow the composition API pattern (Setup Stores) for consistency with the rest of the Vue 3 codebase.

#### Scenario: Store usage in component
- **WHEN** a component imports and uses a Pinia store
- **THEN** it can access reactive state and call actions defined in the store

### Requirement: API token stored per project in localStorage
The frontend SHALL store API tokens for remote systems in browser `localStorage` using the key `osi_token_{projectId}`.

#### Scenario: Token saved for a project
- **WHEN** a user enters an API token for a project's remote system
- **THEN** it is saved in `localStorage` under the key `osi_token_{projectId}`

#### Scenario: Token retrieved during publish
- **WHEN** the publish flow runs for a project
- **THEN** the token is read from `localStorage` using `osi_token_{projectId}`

#### Scenario: Token cleared from UI
- **WHEN** the user clears the token for a project
- **THEN** the corresponding `localStorage` entry is removed

### Requirement: Layout Store
The system SHALL provide a `useLayoutStore` Pinia store that manages sidebar UI state.

#### Scenario: Sidebar collapsed state initialized from localStorage
- **WHEN** the application starts
- **THEN** `useLayoutStore` initializes `sidebarCollapsed` from `localStorage` (defaulting to `false` if not set)

#### Scenario: Sidebar collapsed state persisted to localStorage
- **WHEN** the user toggles the sidebar collapsed state
- **THEN** the new value is saved to `localStorage` so it survives page reloads

