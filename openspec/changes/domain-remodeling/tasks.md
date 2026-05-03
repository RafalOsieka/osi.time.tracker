# Tasks: Domain Remodeling

## Milestone 1: Database Migration
- [ ] 1.1 Update `Project` entity: Add `IsDefault`, `RemoteTarget`, `RemoteBaseUrl`.
- [ ] 1.2 Update `Item` entity: Add `Title`, `RemoteId` (migrate from MVP structure).
- [ ] 1.3 Update `TimeEntry` entity: Remove `Note` field.
- [ ] 1.4 Create migration and script to seed the initial "Default Local Project".
- [ ] 1.5 Data Migration: Transfer existing MVP Item remote configs to their respective projects (or create new projects per target/url).

## Milestone 2: Backend Logic
- [ ] 2.1 Refactor `TimerService`: Handle implicit item creation in the Default Project.
- [ ] 2.2 Refactor `ItemService`: Implement Title caching logic and Project-based validation.
- [ ] 2.3 Refactor `ProjectService`: Ensure single-default-project constraint (transactional).
- [ ] 2.4 Update API Endpoints:
    - `POST /api/projects`: Handle remote config.
    - `PATCH /api/items/{id}/match`: Remote matching logic.
    - `POST /api/items/merge`: Move entries and archive source item.

## Milestone 3: Frontend Refactor
- [ ] 3.1 Settings Page: Project list with Remote Config + Token (localStorage) fields.
- [ ] 3.2 TimerBar: Simplified input (no note), improved Item search/selection.
- [ ] 3.3 Item Matching UI: "Match with Remote" dialog within Item details.
- [ ] 3.4 State Management (Pinia): Update stores to handle new Project/Item hierarchy.

## Milestone 4: Validation
- [ ] 4.1 Unit tests for `IsDefault` logic.
- [ ] 4.2 Integration tests for migration and data consistency.
- [ ] 4.3 Manual E2E test: Start local timer -> create project -> match item -> publish.
