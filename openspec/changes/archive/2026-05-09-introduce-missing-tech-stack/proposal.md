## Why

The current project skeleton has been initialized with the core tech stack (PrimeVue, Tailwind 4, .NET 10), but several critical elements defined in the target tech stack are still missing. This change introduces these missing foundational components to provide a complete, production-ready environment for further feature development.

## What Changes

- **Frontend Persistence & State**: Introduce Pinia for global state management.
- **PWA Support**: Configure Vite PWA plugin to support offline capabilities and mobile-first experience.
- **Infrastructure (PostgreSQL)**: Integrate PostgreSQL into the Aspire orchestration and Infrastructure project.
- **Clean Architecture Refinement**: Establish the core patterns for the Core and Infrastructure projects, including Result pattern for domain services and service discovery.

## Capabilities

### New Capabilities
- `frontend-state-management`: Pinia store setup and state patterns.
- `pwa-foundation`: Service worker, manifest, and offline configuration.
- `database-integration`: PostgreSQL setup via Aspire, Entity Framework Core migrations, and repository patterns.
- `clean-architecture-foundations`: Base classes for Result pattern, domain services, and cross-project references.

### Modified Capabilities
- None (This is a foundational addition).

## Impact

- **Frontend**: `package.json` will be updated with `pinia` and `vite-plugin-pwa`. `main.ts` will be updated to use Pinia.
- **Backend**: New project dependencies (EF Core, Npgsql) in Infrastructure and Api. `AppHost` will be modified to include the PostgreSQL resource.
- **Architecture**: Core and Infrastructure projects will receive their first implementation files.
