# Design: Time Tracking MVP

## Architecture Overview

Web (SPA, Vite/TS) ↔ Api (ASP.NET Core) ↔ Core (domain) ↔ Infrastructure (PostgreSQL)

- Core: domain models and services for Items (remote issues), Projects, TimeEntries, Timer rules (no overlaps), and grouping/rounding utilities (also reproducible on client for preview).
- Infrastructure: PostgreSQL schema, migrations, repositories (prefer EF Core for speed), connection via configuration.
- Api: Minimal REST endpoints for timers, entries, items, and reports. No auth for MVP.
- Web: Timer bar, entries list, publish panel. Client-side publisher modules for Redmine and OpenProject.

## Data Model (PostgreSQL)

Project
- Id (uuid) PK
- Name (text) not null
- Color (text) null
- IsArchived (bool) not null default false
- CreatedUtc (timestamptz) not null
- UpdatedUtc (timestamptz) not null

Item  // local representation of a remote issue/work package
- Id (uuid) PK
- ProjectId (uuid) FK → Project
- Name (text) not null  // local display title
- RemoteTarget (smallint) not null  // 1=Redmine, 2=OpenProject
- RemoteBaseUrl (text) not null
- RemoteId (text) not null  // issue ID or work package ID
- IsArchived (bool) not null default false
- CreatedUtc (timestamptz) not null
- UpdatedUtc (timestamptz) not null

TimeEntry
- Id (uuid) PK
- ProjectId (uuid) FK → Project
- ItemId (uuid) FK → Item
- Title (text) not null
- Note (text) null
- StartUtc (timestamptz) not null
- EndUtc (timestamptz) null  // null while running
- CreatedUtc (timestamptz) not null
- UpdatedUtc (timestamptz) not null
- Published (bool) not null default false
- PublishedAtUtc (timestamptz) null
- PublishedTo (smallint) null  // 1=Redmine, 2=OpenProject
- PublishedRemoteId (text) null

PublishRecord (optional audit; MVP optional)
- Id (uuid) PK
- Target (smallint) not null
- BaseUrl (text) not null
- RemoteId (text) not null  // issue/work package ID
- SpentOn (date) not null
- HoursSent (numeric(6,2)) not null
- PayloadJson (jsonb) not null
- ResponseJson (jsonb) null
- CreatedUtc (timestamptz) not null

Indexes
- TimeEntry(ProjectId, ItemId, StartUtc)
- Item(RemoteTarget, RemoteBaseUrl, RemoteId) unique

## Domain Rules
- Only one running entry at a time. TimerService enforces stop-before-start.
- No overlapping entries: TimeEntryService validates before create/update.
- Rounding for publish (and preview):
  - Group by (Item.RemoteId, SpentOn date derived from UTC to local tz), sum raw seconds.
  - Round to 15 minutes using nearest, ties up.
  - Redmine: decimal hours; OpenProject: ISO8601 duration (e.g., PT2H30M).

## API Surface (MVP)
- POST /api/timer/start body: { itemId: Guid, title: string, note?: string }
- POST /api/timer/stop returns finalized entry
- GET /api/timer/active
- GET /api/entries?from=ISO&to=ISO&itemId?=Guid
- POST /api/entries (manual create)
- PUT /api/entries/{id} / DELETE /api/entries/{id}
- GET /api/items / POST /api/items / PUT /api/items/{id} / DELETE /api/items/{id}
- GET /api/reports/daily?from&to and /api/reports/by-item?from&to

Note: No /api/publish in MVP; publish is client-side via fetch to remote systems.

## Web (SPA) Design

Components
- TimerBar: start/stop, item picker (search local items), title+note inputs.
- EntriesList: Today/This Week; inline edit times, title, note; split/merge.
- PublishPanel:
  - Select date range → load entries → group by (issue, date) and preview rounded totals
  - Target selector: Redmine/OpenProject
  - Paste Remote ID already on Item; for new Items, provide paste-ID mapping flow
  - Activity chooser (required per target)
  - Token & Base URL inputs with “Remember in this browser” toggle (localStorage)
  - Publish: iterate groups, send requests, mark success/failure

UX Details
- Publish comments: join unique entry Titles with "; " up to a cap (e.g., 800 chars), append "; +N more" if truncated.
- Clear CORS error surface with suggested admin actions (enable CORS / add origin).

## Client-Side Publisher

RedminePublisher
- POST {baseUrl}/time_entries.json
- Headers: X-Redmine-API-Key, Content-Type: application/json
- Body: { "time_entry": { "issue_id": <id>, "hours": <decimal>, "spent_on": "YYYY-MM-DD", "comments": "...", "activity_id": <id?> } }

OpenProjectPublisher
- POST {baseUrl}/api/v3/time_entries
- Headers: Authorization: Bearer <token>, Content-Type: application/json
- Body (HAL): links to workPackage and activity; hours as ISO8601 duration; spentOn as YYYY-MM-DD.

## Configuration
- Connection string for PostgreSQL via appsettings.* and IConfiguration.
- Frontend env for UI defaults (e.g., 15-min rounding step displayed in UI).

## Security
- Tokens in memory unless user opts to save to localStorage; provide “Forget token”.
- Never log tokens.

## Testing Strategy
- Unit tests for rounding and grouping (edge cases and ties).
- Domain tests for no-overlap rules.
- Integration test for EF Core mappings and migrations.
- Manual E2E for client-side publish against test instances with CORS enabled.
