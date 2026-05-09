## ADDED Requirements

### Requirement: Test infrastructure boots real AppHost
The test suite SHALL use `Aspire.Hosting.Testing` to start the real AppHost (postgres + api) for integration tests. The `frontend` and `pgweb` resources SHALL be removed from the builder before `BuildAsync()`. The postgres named volume annotation SHALL be removed so each test run starts with an ephemeral, clean database.

#### Scenario: Fixture starts successfully
- **WHEN** the test fixture initializes
- **THEN** postgres container starts, API process starts, migrations run, and the API health check returns healthy within 60 seconds

#### Scenario: Frontend resource is not started
- **WHEN** the test fixture initializes
- **THEN** no npm process is spawned for the frontend

#### Scenario: Database is ephemeral
- **WHEN** the test suite runs
- **THEN** no named Docker volume is created or reused from previous runs

---

### Requirement: Tests are isolated from each other
Between each test, all application tables SHALL be truncated in FK-safe order so no test's data affects another test.

#### Scenario: Data from one test does not appear in another
- **WHEN** test A creates a time entry and test B runs after it
- **THEN** test B sees no entries from test A

---

### Requirement: Timer endpoints are verified end-to-end
The test suite SHALL verify the timer start/stop/active flow against the real database.

#### Scenario: No active timer returns 404
- **WHEN** `GET /api/timer/active` is called with no timer running
- **THEN** the response status is 404

#### Scenario: Start timer persists and returns active entry
- **WHEN** `POST /api/timer/start` is called with a valid title
- **THEN** the response status is 200 and `GET /api/timer/active` subsequently returns 200 with the started entry

#### Scenario: Stop timer creates entry and clears active
- **WHEN** a timer is running and `POST /api/timer/stop` is called
- **THEN** the response status is 200, the entry is persisted, and `GET /api/timer/active` subsequently returns 404

---

### Requirement: Entry endpoints are verified end-to-end
The test suite SHALL verify CRUD operations on time entries against the real database.

#### Scenario: Create entry returns 200 and persists
- **WHEN** `POST /api/entries` is called with valid data
- **THEN** the response status is 200 and the entry is retrievable via `GET /api/entries`

#### Scenario: Update entry persists changes
- **WHEN** `PUT /api/entries/{id}` is called with updated data
- **THEN** the response status is 200 and subsequent retrieval reflects the changes

#### Scenario: Delete entry removes it
- **WHEN** `DELETE /api/entries/{id}` is called
- **THEN** the response status is 200 and the entry no longer appears in `GET /api/entries`

---

### Requirement: Item endpoints are verified end-to-end
The test suite SHALL verify CRUD operations on items against the real database.

#### Scenario: Create item returns 200 and persists
- **WHEN** `POST /api/items` is called with valid data
- **THEN** the response status is 200 and the item is retrievable via `GET /api/items`

#### Scenario: Delete item removes it
- **WHEN** `DELETE /api/items/{id}` is called
- **THEN** the response status is 200 and the item no longer appears in `GET /api/items`

---

### Requirement: Project endpoints are verified end-to-end
The test suite SHALL verify CRUD operations on projects against the real database.

#### Scenario: Create project returns 200 and persists
- **WHEN** `POST /api/projects` is called with valid data
- **THEN** the response status is 200 and the project is retrievable via `GET /api/projects`

#### Scenario: Delete project removes it
- **WHEN** `DELETE /api/projects/{id}` is called
- **THEN** the response status is 200 and the project no longer appears in `GET /api/projects`

---

### Requirement: Report endpoints apply the rounding rule correctly
The report endpoints SHALL return durations rounded to the nearest 15-minute increment, grouped by (Remote Item ID, Date), with ties rounding up and a minimum of 15 minutes for any non-zero duration.

#### Scenario: Durations are rounded to nearest 15 minutes
- **WHEN** entries totalling 22 minutes exist for the same item and date and `GET /api/reports/...` is called
- **THEN** the reported duration is 15 minutes (rounds down to nearest 15)

#### Scenario: Ties round up
- **WHEN** entries totalling 7 minutes and 30 seconds exist for the same item and date
- **THEN** the reported duration is 15 minutes (tie rounds up)

#### Scenario: Non-zero duration has minimum of 15 minutes
- **WHEN** entries totalling 3 minutes exist for the same item and date
- **THEN** the reported duration is 15 minutes (minimum 1 step)
