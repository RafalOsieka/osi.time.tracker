# Design: add-timer-view

## Context

Story 4 delivered the live timer (start/stop/retitle, single running entry, title→task resolution). There is no way to review captured time: the home page is a welcome placeholder and the only historical surface is the Tasks page, which contradicts the entry-first model in `docs/vision.md` (#3, #8 — tasks emerge from entries, task management is inline, tasks are hard-delete only). Story 5 replaces both with the timer view: a Toggl-style per-day list of entries grouped by task.

Existing building blocks: `useTimer` composable (global running state), `TimeEntryDto` (already carries `taskName`, `projectName`, `clientName`), `resolveTaskId` (title→task in one transaction), `GET /api/tasks?search=` autocomplete.

## Goals / Non-Goals

**Goals:**
- Main working page at `/`: entries grouped by day → task, newest first, with totals, paged by days.
- Continue (▶) a previous task group; bulk-assign a day's untitled entries; inline mini task editor (rename / move project) with auto-merge.
- Remove the Tasks page, explicit task create/delete endpoints, and the `tasks.deletedAt` column.

**Non-Goals:**
- Per-entry edit/retitle/delete, manual entry add (story 6); timezone preference (story 7); reports/filters (story 8).

## Decisions

### D1. Flat list endpoint, client-side grouping
`GET /api/time-entries?from&to` returns a flat `TimeEntryDto[]` for entries overlapping the `[from, to)` instant range, ordered by `startedAt DESC`. The page groups by day and task client-side using the browser-local timezone (the client converts local day boundaries to UTC instants, so the server stays timezone-free).
- *Alternative — server-side day buckets*: rejected; requires passing the viewer's timezone to the server and hard-codes grouping the reports story will want to do differently.

### D2. Paging by days, not rows
The page loads the most recent N days (default 7) by requesting the corresponding instant window, and "Load more" extends the window further back. Day-based windows keep groups complete (a row-based cursor could split a day across pages).
- *Alternative — offset/limit on rows*: rejected for split-day artifacts and awkward totals.

### D3. Continue reuses `POST /api/time-entries`
The ▶ action calls the existing start endpoint with the group's task name and `projectId` — stop-on-new-start (REQ-TTR-037) and title resolution (REQ-TTR-038) already give the correct semantics. No new endpoint.

### D4. Dedicated atomic bulk-assign endpoint
`POST /api/time-entries/bulk-assign` takes `{ ids, title, projectId? }` and, in a single transaction, resolves the title once via the existing resolution rules and binds all listed entries (owned, currently untitled). Partial failure is impossible.
- *Alternative — client PATCH loop*: rejected; N requests, non-atomic, N title resolutions racing each other.
- Ids are sent explicitly (rather than a day range) so the server needs no day-boundary logic; the client already knows exactly which entries sit in the bucket.

### D5. `PATCH /api/tasks/[id]` gains auto-merge
Renaming/moving a task so that `(userId, name, projectId)` collides with an existing task no longer errors: within one transaction the edited task's entries are re-pointed to the survivor (the pre-existing task) and the now-empty edited task is hard-deleted; the survivor is returned. This is the same convergence rule as title resolution, applied to edits (vision #3).
- *Alternative — reject duplicates (status quo)*: rejected; forces users to manually consolidate, contradicting the "titles converge to tasks" model.

### D6. Tasks are hard-delete only
`tasks.deletedAt` is dropped (migration); the partial unique indexes on task names lose their `WHERE deletedAt IS NULL` clause. `DELETE /api/tasks/[id]` and `POST /api/tasks` are removed — tasks are created only implicitly (titles) and disappear only when emptied by a merge. Clients/projects keep soft delete (vision #8).
- *Alternative — keep soft delete*: rejected; a soft-deleted task blocks its name in the unique index scope while being invisible, which breaks title convergence.

### D7. `/` becomes the timer view
The timer view replaces `app/pages/index.vue`; nav "Dashboard" → "Timer" and the "Tasks" entry is removed. Expanded task groups list their entries read-only (times + duration); all entry mutation stays in story 6.

## Risks / Trade-offs

- [Entries spanning midnight appear in the day of their `startedAt`] → Acceptable for MVP; grouping is by `startedAt` only, documented in the spec.
- [Browser-local day boundary shifts if the user travels] → Accepted until story 7's persisted timezone preference; grouping is client-side so only the display shifts, not the data.
- [Dropping `deletedAt` discards any already-soft-deleted task rows' hidden state] → Migration hard-deletes tasks where `deletedAt IS NOT NULL` and null-out references from their entries (entries become untitled) before dropping the column; early-MVP data volume makes this safe.
- [Merge hard-deletes a task row irreversibly] → The surviving task keeps all entries; nothing user-visible is lost.
- [Running entry appears in today's group and via the shell widget] → The page marks the running entry distinctly and derives its live duration like the widget does, sharing `useTimer` state to avoid double-fetch drift.

## Migration Plan

1. Migration: hard-delete soft-deleted task rows (entries' `taskId` set to null first), drop `tasks.deletedAt`, recreate the two name-uniqueness indexes without the `deletedAt` predicate.
2. Deploy code (new endpoints + page + removals) with the migration applied first (`pnpm db:migrate` before serving traffic, per project policy).
3. Rollback: revert code; a down migration would re-add a nullable `deletedAt` column (soft-deleted state is not recoverable — accepted).

## Open Questions

None — page size N (7 days) and the bulk-assign route shape are decided above and can be tuned without spec changes.
