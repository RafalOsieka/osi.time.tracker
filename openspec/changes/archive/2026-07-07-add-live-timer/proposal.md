## Why

The app can organize Clients, Projects, and Tasks, but there is still no way to actually track time — the core purpose of the product. User story #4 ("Live timer, titled entries & running indicator") is the first vertical slice of the entry-first model settled in `docs/vision.md`: the user starts a timer, optionally titles it, and the title binds the entry to a Task behind the scenes. This unblocks all later time-tracking stories.

## What Changes

- Introduce a `time_entries` table and a REST `time-entries` resource: start a timer (`POST`), stop/retitle (`PATCH`), and read the running entry (`GET /running`).
- A running timer is a `TimeEntry` with `stoppedAt = null`, persisted server-side, at most one per user; starting a new timer stops the running one (Toggl behavior).
- Entry-first task binding: an entry's title is a Task name. The server resolves the title (+ optional project) to an existing or new Task on `(user, name, project)` inside one transaction. Untitled entries are allowed (`taskId = null`).
- Extend `GET /api/tasks` with a `?search=` parameter to power title autocomplete (name + project/client context).
- Replace the `TIMER PLACEHOLDER` regions in the app shell with a live timer widget and an always-visible running indicator.
- **BREAKING**: Drop the per-user task `number` column and its unique index; update `TaskDto` and the tasks page accordingly.

## Capabilities

### New Capabilities

- `time-tracking`: running-timer lifecycle, entry-first title→task binding, `(user, name, project)` matching and silent-match rules, single active timer, and the persistent running indicator.

### Modified Capabilities

- `task-management`: remove per-user task numbers; add implicit Task creation/matching via time entries (alongside the still-existing tasks page).
- `frontend-shell`: the reserved timer regions host the live timer widget and running indicator instead of placeholders.

## Impact

- Schema/migrations: new `time_entries` table; drop `tasks.number` + index; add task matching unique indexes.
- Server: new `server/api/time-entries/*` handlers, shared match/create logic, `tasks` search param.
- Shared types: new `shared/types/time-entry.ts`; `TaskDto` loses `number`.
- App: `AppTimer.vue` widget + `useTimer()` composable, `tasks.vue`, i18n `en`/`pl` catalogs.

## Non-goals

- Timer view page, grouping, "(no task)" bucket, mini task editor, task merge, tasks-page removal (story 5).
- Manual entries, edit/delete of entries, orphan-task GC (story 6).
- Remote integration (stories 9–11).
