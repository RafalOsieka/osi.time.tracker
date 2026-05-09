## 1. Project Setup

- [ ] 1.1 Add `Aspire.Hosting.Testing` package version to `Directory.Packages.props`
- [ ] 1.2 Create `tests/Api.IntegrationTests/Api.IntegrationTests.csproj` (xUnit, references AppHost + xUnit packages)
- [ ] 1.3 Add `tests/Api.IntegrationTests/Api.IntegrationTests.csproj` to `osi.time.tracker.slnx`

## 2. Test Fixture

- [ ] 2.1 Implement `ApiFixture` (IAsyncLifetime): remove `frontend`, `pgweb`, postgres volume annotation; BuildAsync + StartAsync; WaitForResourceHealthyAsync("api"); expose HttpClient
- [ ] 2.2 Implement `ResetDatabaseAsync` helper on `ApiFixture` that truncates all tables in FK-safe order
- [ ] 2.3 Define `[CollectionDefinition("Api")]` and `ApiCollection : ICollectionFixture<ApiFixture>`

## 3. Timer Tests

- [ ] 3.1 Add `TimerTests.cs`: GET /api/timer/active returns 404 when no timer running
- [ ] 3.2 Add test: POST /api/timer/start persists timer and GET /api/timer/active returns 200
- [ ] 3.3 Add test: POST /api/timer/stop creates entry and GET /api/timer/active returns 404

## 4. Entry Tests

- [ ] 4.1 Add `EntryTests.cs`: POST /api/entries creates and persists entry
- [ ] 4.2 Add test: PUT /api/entries/{id} updates and persists changes
- [ ] 4.3 Add test: DELETE /api/entries/{id} removes entry

## 5. Item Tests

- [ ] 5.1 Add `ItemTests.cs`: POST /api/items creates and persists item
- [ ] 5.2 Add test: DELETE /api/items/{id} removes item

## 6. Project Tests

- [ ] 6.1 Add `ProjectTests.cs`: POST /api/projects creates and persists project
- [ ] 6.2 Add test: DELETE /api/projects/{id} removes project

## 7. Report Tests

- [ ] 7.1 Add `ReportTests.cs`: verify rounding down (22 min → 15 min)
- [ ] 7.2 Add test: verify tie rounds up (7m30s → 15 min)
- [ ] 7.3 Add test: verify minimum 15 min for non-zero duration (3 min → 15 min)

## 8. Verification

- [ ] 8.1 Run `dotnet test tests/Api.IntegrationTests/Api.IntegrationTests.csproj` and confirm all tests pass
