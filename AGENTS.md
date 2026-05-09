# AGENTS.md

## Domain Knowledge

Osi Time Tracker is a single-user time tracking application with remote publication capabilities. It allows users to start/stop a timer, review and edit time entries, generate daily and item-based reports with CSV export, and publish grouped/rounded time logs to Redmine or OpenProject. The rounding rule aggregates unpublished entries by (Remote Item ID, Date), sums raw durations, and rounds to the nearest 15-minute increment (ties round up; minimum 1 step if > 0). API tokens for remote systems are stored in `localStorage` and never sent to the backend.

The backend follows a Clean Architecture layout: `Core` holds domain entities and business logic, `Infrastructure` handles EF Core persistence (PostgreSQL), `Api` exposes ASP.NET Core Minimal API endpoints, `AppHost` is the .NET Aspire orchestration entry point, and `ServiceDefaults` contains shared Aspire service configuration. The frontend (`Web`) is a Vue 3 SPA using Pinia stores, PrimeVue 4 components, Tailwind CSS 4, and `ky` for HTTP.

## Commands

> Source: `README.md`, `src/Web/package.json`

| Task                        | Command                                              | ~Time   |
| --------------------------- | ---------------------------------------------------- | ------- |
| Run full app (Aspire)       | `dotnet run --project src/AppHost/AppHost.csproj`    | ~15-60s |
| Backend tests               | `dotnet test tests/Core.Tests/Core.Tests.csproj`     | ~10-30s |
| Frontend: install deps      | `cd src/Web && pnpm install`                         | ~1-3m   |
| Frontend: dev server        | `cd src/Web && pnpm dev`                             | ~5-15s  |
| Frontend: build             | `cd src/Web && pnpm build`                           | ~15-60s |
| Frontend: lint              | `cd src/Web && pnpm lint`                            | ~5-20s  |
| Frontend: format            | `cd src/Web && pnpm format`                          | ~5-20s  |
| Frontend: unit tests        | `cd src/Web && pnpm test`                            | ~10-30s |

> If commands fail, verify against `src/Web/package.json` or ask the user to update.

## File Map

```
src/
  AppHost/                        .NET Aspire orchestration entry point (PostgreSQL, service wiring)
  ServiceDefaults/                Shared Aspire extensions (health checks, telemetry, etc.)
  Core/                           Domain layer: entities, business logic, interfaces
  Infrastructure/                 EF Core DbContext, migrations, repository implementations
  Api/                            ASP.NET Core Minimal API endpoints, DTOs, DI setup
  Web/                            Vue 3 SPA frontend
    src/
      components/                 Reusable Vue components (PrimeVue-based)
      views/                      Page-level Vue views (TrackerView, etc.)
      stores/                     Pinia stores (timer, entries, items, projects, publish, reports)
      router/                     Vue Router configuration
      utils/                      Utility helpers (time.ts, tokens.ts)
      App.vue                     Root component
      main.ts                     App bootstrap
    package.json                  Frontend scripts, dependencies
    vite.config.ts                Vite build configuration
    vitest.config.ts              Vitest test configuration
tests/
  Core.Tests/                     xUnit tests for Core domain logic
Directory.Build.props             Shared MSBuild properties for all backend projects
Directory.Packages.props          Centralized NuGet package version management
```

### Tech Stack

- **Backend**: .NET 10, ASP.NET Core Minimal APIs, EF Core, .NET Aspire
- **Database**: PostgreSQL (managed by Aspire via Docker)
- **Frontend**: Vue 3, TypeScript, Pinia, PrimeVue 4, Tailwind CSS 4, `ky`, Vue Router
- **Frontend tooling**: Vite, Vitest, ESLint, Prettier, `vue-tsc`, pnpm
- **Tests**: xUnit (backend), Vitest + `@vue/test-utils` + jsdom (frontend)

## Boundaries

### Always

- Keep domain logic in `src/Core/`; do not leak infrastructure or HTTP concerns into it
- Keep EF Core, migrations, and DB access in `src/Infrastructure/`
- Keep API endpoint definitions in `src/Api/`; use DTOs — never expose domain entities directly over the wire
- Run `dotnet test tests/Core.Tests/Core.Tests.csproj` after any backend change and show output as evidence
- Run `pnpm test` (from `src/Web`) after any frontend change and show output as evidence
- Follow the rounding rule exactly: group by (Remote Item ID, Date), sum durations, round to nearest 15 min, ties up, minimum 15 min if > 0

### Ask First

- Adding new NuGet or npm packages
- Changing the Aspire orchestration setup (`AppHost`) or `ServiceDefaults`
- Modifying EF Core migrations or the database schema
- Changing the publishing integration contract with Redmine / OpenProject
- Creating commits or pushing changes

### Never

- Store API tokens or secrets in the backend or in source code; tokens live in the browser's `localStorage` only
- Bypass or weaken failing tests (no `.skip`, no removed assertions, no `--passWithNoTests`)
- Expose domain entities directly as API response types — always map to DTOs
- In explore mode: create proposals, design documents, or any OpenSpec artifacts without explicit user confirmation — only offer, then wait

## Heuristics

- If a change touches publishing logic, re-verify the rounding rule (see `README.md` and `src/Core/`)
- If a change touches the frontend stores, check that the corresponding view and any affected components still behave correctly
- If a migration is needed, generate it with `dotnet ef migrations add <Name> --project src/Infrastructure --startup-project src/Api` and review the generated file before applying
- If the Aspire host fails to start, verify Docker is running and the PostgreSQL container is healthy

## When instructions conflict

Explicit user prompts override this file.
