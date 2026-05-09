## Context

The initial project setup provided a basic skeleton with PrimeVue, Tailwind 4, and .NET 10. However, to fulfill the complete tech stack requirements, we need to integrate several cross-cutting concerns: state management, offline support, database persistence, and architectural patterns.

## Goals / Non-Goals

**Goals:**
- Enable global state management in the Vue SPA.
- Enable PWA capabilities for the frontend.
- Establish a local development database environment using Aspire and PostgreSQL.
- Formalize the Clean Architecture layers and error handling patterns.

**Non-Goals:**
- Implementing actual business features (e.g., login, time tracking).
- Setting up production CI/CD pipelines.
- Designing the final database schema (only base setup).

## Decisions

### 1. Pinia for State Management
- **Rationale**: Recommended by Vue team, better TypeScript support than Vuex, and simpler API.
- **Alternatives**: Vuex (too verbose), Reactive objects (lacks devtools and structured patterns).

### 2. Vite PWA Plugin
- **Rationale**: Easiest way to integrate Workbox and manifest generation into Vite.
- **Alternatives**: Manual service worker registration (error-prone).

### 3. Aspire for PostgreSQL Orchestration
- **Rationale**: Consistent with the use of .NET Aspire for other services; provides built-in health checks and connection string management.
- **Alternatives**: Manual Docker Compose (redundant with Aspire).

### 4. Custom Result Pattern Implementation
- **Rationale**: A simple `Result<T>` and `Result` class in the Core project provides enough flexibility without adding external dependencies for basic error handling.
- **Alternatives**: FluentResults library (adds dependency), Exceptions (violates Clean Architecture / performance).

## Risks / Trade-offs

- **[Risk]**: PWA service worker caching might cause stale content issues during development.
  - **Mitigation**: Use `devOptions: { enabled: true }` in Vite PWA but with careful cache clearing strategies.
- **[Risk]**: PostgreSQL connection in Aspire might fail on machines without Docker.
  - **Mitigation**: Ensure README specifies Docker Desktop/OrbStack as a prerequisite.
