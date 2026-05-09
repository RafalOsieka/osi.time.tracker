## Context

The project uses .NET Aspire to orchestrate PostgreSQL and the API. The existing `Core.Tests` project tests domain logic in isolation (in-memory). There are no tests that verify the full HTTP → API → database round-trip. The AppHost already wires postgres + api correctly, making it a natural foundation for integration tests.

## Goals / Non-Goals

**Goals:**
- Verify all API endpoints behave correctly against a real PostgreSQL database
- Reuse the existing AppHost configuration — no duplication of infrastructure setup
- Keep tests isolated from each other (no data leakage between tests)
- Cover the rounding rule end-to-end through the report endpoints

**Non-Goals:**
- Testing the frontend (Vue SPA) — out of scope
- Load or performance testing
- Mocking any layer — these are full integration tests, not unit tests
- Changing any production code

## Decisions

### 1. Use `Aspire.Hosting.Testing` over `WebApplicationFactory` + Testcontainers

`Aspire.Hosting.Testing` boots the real AppHost (real postgres container, real API process) with a single package. `WebApplicationFactory` would require manually wiring Testcontainers, overriding the Aspire connection string, and suppressing `AddServiceDefaults()` telemetry — all complexity that Aspire Testing handles automatically.

### 2. Remove `frontend` and `pgweb` resources in the test fixture

`builder.Resources` is mutable before `BuildAsync()` — confirmed by official Aspire docs and source. Removing these resources prevents unnecessary npm process startup and pgweb container spin-up during tests. `AppHost.cs` stays clean with no test-awareness.

```
Resources after removal:
  "postgres"             ← starts, runs migrations via API startup
  "osi-time-tracker-db"  ← database resource (child of postgres)
  "api"                  ← the system under test
```

### 3. Strip the named volume annotation from postgres

`WithDataVolume("osi-time-tracker-postgres-data")` in AppHost.cs would reuse data across test runs. Removing `ContainerMountAnnotation` from the postgres resource before `BuildAsync()` gives an ephemeral container — clean state every run.

### 4. One shared fixture per test run (`ICollectionFixture`)

Starting a Docker container is expensive (~5-10s). One `ApiFixture` shared across all test classes via xUnit `ICollectionFixture` starts postgres + api once per test run. Tests within the run share the same running app.

### 5. Manual table truncation for test isolation

Between tests, tables are truncated via direct SQL through the connection string obtained from the running app. No extra packages (Respawn) needed — the schema is small and stable. Truncation order respects FK constraints (entries before items before projects).

```
Truncation order:
  TimeEntries → Items → Projects → (TimerSessions if applicable)
```

### 6. Wait strategy

After `StartAsync()`, use `WaitForResourceHealthyAsync("api")` with a 60-second timeout. The API's health endpoint is registered via `MapDefaultEndpoints()` (Aspire ServiceDefaults). This ensures migrations have run before any test executes.

## Risks / Trade-offs

- **Docker required**: Tests fail if Docker is not running. This is expected and acceptable — same requirement as running the app locally.
- **Slower than unit tests**: Container startup adds ~10-20s per test run. Mitigated by sharing one fixture across all tests.
- **pgweb resource name assumption**: We assume `WithPgWeb()` registers the resource as `"pgweb"` (confirmed from Aspire source — default `containerName`). If this changes in a future Aspire version, the fixture's `FirstOrDefault` guard handles it gracefully (no crash if not found).
- **API runs as a real process**: Cannot inject test doubles via DI. All dependencies must be real. This is intentional — these are integration tests.

## Migration Plan

1. Add `Aspire.Hosting.Testing` to `Directory.Packages.props`
2. Create `tests/Api.IntegrationTests/Api.IntegrationTests.csproj` referencing AppHost + xUnit packages
3. Add project to `osi.time.tracker.slnx`
4. Implement `ApiFixture` and `[Collection]` attribute
5. Add test classes per endpoint group
6. Verify with `dotnet test tests/Api.IntegrationTests/Api.IntegrationTests.csproj`

No rollback needed — purely additive change.

## Open Questions

- None. All design decisions are settled.
