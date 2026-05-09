# ui-foundation Specification

## Purpose
TBD - created by archiving change setup-primevue-tailwind-4. Update Purpose after archive.
## Requirements
### Requirement: PrimeVue 4 Integration
The system SHALL integrate PrimeVue 4 as the primary UI component library in the frontend project.

#### Scenario: PrimeVue Plugin Registration
- **WHEN** the frontend application starts
- **THEN** PrimeVue is registered as a plugin in `main.ts` with the Aura preset

### Requirement: Tailwind CSS 4 Integration
The system SHALL integrate Tailwind CSS 4 for utility-first styling without requiring PostCSS or Autoprefixer.

#### Scenario: Tailwind 4 Styles Application
- **WHEN** a Vue component uses Tailwind 4 utility classes (e.g., `bg-primary`)
- **THEN** the styles are correctly applied in the browser during development and production

### Requirement: PrimeIcons Integration
The system SHALL provide PrimeIcons for use throughout the application.

#### Scenario: Icon Display
- **WHEN** a component uses a PrimeIcons class (e.g., `pi pi-check`)
- **THEN** the corresponding icon is displayed correctly

### Requirement: Aura Preset Configuration
The system SHALL use the PrimeVue Aura preset in Styled mode for a consistent visual language.

#### Scenario: Styled Component Rendering
- **WHEN** a PrimeVue component (e.g., `Button`) is rendered
- **THEN** it displays the default Aura styling

### Requirement: Application Layout Structure
The system SHALL render all pages inside a `DefaultLayout.vue` component that provides the sidebar shell and a `<RouterView />` outlet. `App.vue` SHALL contain only a bare `<RouterView />`.

#### Scenario: Layout shell renders on every page
- **WHEN** the user navigates to any routed page (`/tracker`, `/reports`, `/publish`, `/settings`)
- **THEN** `DefaultLayout.vue` is rendered with `AppSidebar` and the page content in the router outlet

#### Scenario: App.vue is a bare router outlet
- **WHEN** the application starts
- **THEN** `App.vue` renders only `<RouterView />` with no additional chrome or layout elements

