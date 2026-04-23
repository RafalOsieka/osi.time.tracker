# Tasks: Time Tracking MVP

## Milestone 1: Storage + Domain (Core/Infra)
- [x] 1.1 Add EF Core (or Dapper) with PostgreSQL provider; connection string in configuration.
- [x] 1.2 Define entities: Project, Item, TimeEntry (and optional PublishRecord).
- [x] 1.3 Create initial migrations and apply.
- [x] 1.4 Implement services:
  - [x] 1.4.1 TimerService: enforce single active, start/stop flows.
  - [x] 1.4.2 TimeEntryService: CRUD + overlap validation; compute durations.
  - [x] 1.4.3 ItemService: CRUD and lookup by (RemoteTarget, BaseUrl, RemoteId).
- [x] 1.5 Implement grouping + rounding utility (aggregate 15-minute nearest, ties up).
- [x] 1.6 Seed minimal data helpers (optional).

## Milestone 2: API Endpoints (no auth)
- [x] 2.1 Timer: POST /api/timer/start, /api/timer/stop, GET /api/timer/active.
- [x] 2.2 Entries: GET /api/entries (range + filters), POST/PUT/DELETE for manual edits.
- [x] 2.3 Items: GET/POST/PUT/DELETE; ensure uniqueness of (target, baseUrl, remoteId).
- [x] 2.4 Reports: daily totals and by-item (raw totals), server-calculated for convenience.

## Milestone 3: Web UI - Basics
- [x] 3.1 TimerBar: item picker, title/note inputs, start/stop.
- [x] 3.2 EntriesList: list today/this week, inline edits, split/merge.
- [x] 3.3 State management for active entry and optimistic updates.

## Milestone 4: Publish Panel (Client-only)
- [x] 4.1 Config inputs: Target (Redmine/OpenProject), Base URL, Token; Remember token (localStorage).
- [x] 4.2 Group preview by (issue, date) with rounded totals; show raw vs rounded.
- [x] 4.3 Activity selection and mapping confirmation.
- [x] 4.4 Implement RedminePublisher & OpenProjectPublisher; send payloads via fetch.
- [x] 4.5 Handle responses, mark local entries published with remote IDs.
- [x] 4.6 Error handling and retry per group; CORS error surfacing.

## Milestone 5: Polish & Reports
- [ ] 5.1 Small reports UI: daily totals, by item/project; CSV export.
- [ ] 5.2 Colors for projects; archive flows for items/projects.
- [ ] 5.3 UX tidy (caps on comment length with "; " join, truncation message).

## Validation & Docs
- [ ] 6.1 Unit tests for rounding (aggregate nearest 15 with ties up) and overlap rules.
- [ ] 6.2 Basic integration test for DB schema.
- [ ] 6.3 README updates for configuring PostgreSQL and frontend token storage.
