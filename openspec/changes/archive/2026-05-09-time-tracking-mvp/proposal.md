# Time Tracking MVP

## Why

There is no existing time tracking capability in the stack. Developers need to capture work time against remote issues (Redmine or OpenProject), review and round entries, and publish aggregated logs — all without a dedicated tool integrated into the project.

## What Changes

- Introduce a single-user time tracking application built on the existing stack (ASP.NET Core Minimal API, EF Core, PostgreSQL, Vue 3).
- Add `TimeEntry` and `Item` domain entities with a single-active-timer constraint (no overlapping entries on save).
- Implement aggregate rounding: sum durations per (remote issue, date), round to nearest 15-minute step (ties up, minimum 15 min if > 0).
- Add client-side publish to Redmine (`POST /time_entries.json` with `X-Redmine-API-Key`) and OpenProject (`POST /api/v3/time_entries` with Bearer token, HAL links); API tokens stored in browser `localStorage` only.
- Provide a review/publish screen showing grouped totals and rounded results per (issue, date); successful publish marks local rows with remote IDs.

## Goals
- Track time while working on items mapped to remote issues/work packages.
- Allow switching items; prevent concurrent timers.
- Review and manually adjust entries; aggregate and round per (remote issue, date) to 15-minute steps (nearest, ties up).
- Publish from client-side to Redmine/OpenProject using API tokens stored in browser localStorage (MVP).
- Use PostgreSQL for storage.

## Non-Goals (MVP)
- Multi-user and authentication.
- Tagging, billing rates, invoicing, approvals.
- Server-side publishing proxy (may be added later to bypass CORS limitations).
- Full remote search/lookup UI (paste remote ID in MVP).

## Users & Scenarios
- Single developer tracking daily work across multiple remote issues (possibly across different clients/systems) and publishing at end-of-day.

## Key Requirements
- Single active timer at a time; no overlaps on save.
- TimeEntry requires a Title; Title contributes to publish comments.
- Aggregate rounding: sum durations per (remote issue, date), then round to 15 minutes using nearest (ties up).
- Client-side publish to:
  - Redmine: POST /time_entries.json with X-Redmine-API-Key.
  - OpenProject: POST /api/v3/time_entries with HAL links, Bearer token.
- CORS caveat: If the remote host blocks CORS, the user will see a clear error; no proxy in MVP.
- Store raw UTC times; UI converts to local for display.

## Success Criteria
- Start/stop timers; view, edit, and split/merge entries for Today/This Week.
- Review/publish screen shows grouped totals and rounded results per (issue, date).
- Successful publish creates entries remotely and marks local rows with remote IDs.
- Tokens optionally persisted to localStorage and can be cleared from UI.

## Risks & Mitigations
- CORS blocks (esp. Redmine): Surface actionable errors; later add a local proxy if needed.
- Activity mapping required by remote systems: choose per publish, with UI prompt.
- DST/timezone formatting: store UTC; format dates carefully for spent_on.
