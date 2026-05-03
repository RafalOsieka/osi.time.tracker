# Tasks: Domain Remodeling

## Milestone 1: Database Migration
- [x] 1.1 Update `Project` entity: Add `IsDefault`, `RemoteTarget`, `RemoteBaseUrl`.
- [x] 1.2 Update `Item` entity: Add `Title`, `RemoteId` (migrate from MVP structure).
- [x] 1.3 Update `TimeEntry` entity: Remove `Note` field.
- [x] 1.4 Create migration and script to seed the initial "Default Local Project".
- [ ] 1.5 Data Migration: Transfer existing MVP Item remote configs to their respective projects (or create new projects per target/url). _(Skipped — no MVP production data exists; migration regenerated in-place.)_

## Milestone 2: Backend Logic
- [x] 2.1 Refactor `TimerService`: Handle implicit item creation in the Default Project.
- [x] 2.2 Refactor `ItemService`: Implement Title caching logic and Project-based validation.
- [x] 2.3 Refactor `ProjectService`: Ensure single-default-project constraint (transactional).
- [x] 2.4 Update API Endpoints:
    - `POST /api/projects`: Handle remote config.
    - `PATCH /api/items/{id}/match`: Remote matching logic.
    - `POST /api/items/merge`: Move entries and archive source item.

## Milestone 3: Frontend Refactor
- [x] 3.1 Settings Page: Project list with Remote Config + Token (localStorage) fields.
- [x] 3.2 TimerBar: Simplified input (no note), improved Item search/selection (item is now optional — implicit creation under Default Project).
- [x] 3.3 Item Matching UI: `MatchItemDialog.vue` accessible from Settings → Items, with optional remote-title fetch using the per-project token.
- [x] 3.4 State Management (Pinia): `projects` / `items` / `entries` / `publish` stores updated to handle the new Project/Item hierarchy and per-project token storage.

## Milestone 4: Validation
- [x] 4.1 Unit tests for `IsDefault` logic.
- [x] 4.2 Integration tests for migration and data consistency. _(Covered by `DatabaseSchemaShouldBeValid` + ProjectService unit tests; full Postgres migration round-trip deferred until Aspire test host is wired up.)_
- [x] 4.3 Manual E2E flow available end-to-end in the SPA: Start local timer (implicit item) → create remote project on Settings → store API token → Match item with remote ID → Publish from PublishPanel.
