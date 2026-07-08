# Proposal: add-timer-view

## Why

The app can capture time (live timer, story 4) but offers no place to review it — the home page is a welcome placeholder. Meanwhile the delivered Tasks page contradicts the entry-first model from `docs/vision.md` (tasks emerge from entries; they are not managed standalone). Story 5 (`docs/user-stories.md`) delivers the main working page and removes the superseded surface.

## What Changes

- New timer view page **replaces `/`** — a per-day list of time entries grouped by task, newest day first, with day and per-task totals, paged by days ("load more").
- Each task group shows a continue (▶) action that starts a new entry with the group's title + project (reuses `POST /api/time-entries`).
- Untitled entries collect in a per-day "(no task)" bucket with a **bulk assign** action backed by a new atomic endpoint (single transaction, one title→task resolution).
- Task groups get a mini task editor (rename / change project) backed by `PATCH /api/tasks/[id]`, which gains **auto-merge semantics**: on `(name, project)` collision, entries move to the survivor and the emptied task is hard-deleted.
- New `GET /api/time-entries?from&to` list endpoint returning flat entries with task/project/client context; the page groups client-side using the browser-local day boundary.
- **BREAKING**: Tasks page (`/tasks`), its nav entry, `POST /api/tasks`, and `DELETE /api/tasks/[id]` are removed.
- **BREAKING**: Tasks switch to hard-delete only — the `tasks.deletedAt` column is dropped (migration); clients/projects keep soft delete.
- Sidebar nav: "Dashboard" renamed to "Timer", "Tasks" entry removed.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `time-tracking`: add the list endpoint, timer-view page requirements (day grouping, totals, "(no task)" bucket + bulk assign, mini task editor, continue action).
- `task-management`: remove Tasks-page and explicit create/delete requirements; add merge invariant and hard-delete lifecycle.
- `frontend-shell`: nav list loses "Tasks", "Dashboard" becomes "Timer", `/` is the timer view.

## Non-goals

- Per-entry edit / retitle / delete and manual entry creation (story 6).
- Timezone preference (story 7) — browser-local day boundary for now.
- Reports, filtering, or history search (story 8).

## Impact

- **New**: `GET /api/time-entries` (list), bulk-assign endpoint, timer view UI, day/task grouping logic.
- **Changed**: `app/pages/index.vue`, `AppSidebar.vue`, `PATCH /api/tasks/[id]` (merge), `useTimer` (continue), `shared/types/{task,time-entry}.ts`, tasks schema + migration.
- **Removed**: `app/pages/tasks.vue`, `POST /api/tasks`, `DELETE /api/tasks/[id]`, `tasks.deletedAt`, tasks page tests (e2e/nuxt/unit), i18n keys for the tasks page.
