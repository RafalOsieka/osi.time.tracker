## Why

There are no integration tests verifying that API endpoints behave correctly against a real database. Without them, regressions in endpoint logic, persistence, or the rounding rule can go undetected until manual testing.

## What Changes

- Add a new test project `tests/Api.IntegrationTests/` using `Aspire.Hosting.Testing`
- Add a shared `ApiFixture` that boots the real AppHost (postgres + api), strips unnecessary resources (frontend, pgweb, persistent volume), and exposes an `HttpClient`
- Add test classes covering all endpoint groups: timer, entries, items, projects, reports
- Add `Aspire.Hosting.Testing` to `Directory.Packages.props`

## Capabilities

### New Capabilities

- `api-integration-testing`: Integration test suite that verifies all API endpoints against a real PostgreSQL database using the Aspire testing infrastructure

### Modified Capabilities

<!-- none -->

## Impact

- New project: `tests/Api.IntegrationTests/` (xUnit, references `AppHost`)
- `Directory.Packages.props`: add `Aspire.Hosting.Testing` package version
- `osi.time.tracker.slnx`: add new test project to solution
- No changes to production code (`Api`, `Core`, `Infrastructure`, `AppHost`)
