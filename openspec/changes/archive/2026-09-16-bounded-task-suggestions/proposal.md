## Why

After importing eight years of remote time logs, the title autocomplete in the top-bar timer (and the add-entry dialog) freezes the page. Imported tasks are named from log comments, so a long history yields tens of thousands of tasks; `GET /api/tasks?search=` returns every match with no cap (all tasks on an empty search), the client re-fetches on every keystroke with no debounce or stale-response guard, and `UInputMenu` renders the whole result set. The database query itself is cheap; the unbounded payload and DOM are not. Separately, `time_entries.taskId` has no index, so the most-recently-used tie-break run on every bare-title timer start and every task garbage-collection check sequentially scans the full entry history.

## What Changes

- `GET /api/tasks` becomes a bounded, recency-ranked list: results are ordered by the most recent `startedAt` of the task's entries (tasks without entries last), then `name`, and capped by a `limit` query parameter with a default and a hard maximum. Alphabetical, uncapped listing is removed. **BREAKING** for API consumers relying on `name` ordering or full listings (none exist in the app today).
- The title autocomplete in `AppTimer` and `TimerAddEntryDialog` moves to one shared composable that debounces requests and discards stale responses, so a slower older response can no longer overwrite a newer one.
- A new index on `time_entries (taskId)` backs the MRU tie-break (REQ-137), task garbage collection, and the new ranking.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `task-management`: REQ-133 (list own tasks) changes ordering from `name` to most-recently-used-first and adds the `limit` parameter with default/maximum and validation.
- `time-tracking`: REQ-180 (top-bar suggestion binding) gains the debounce and stale-response guard contract for the suggestion request, shared with the add-entry dialog.

## Non-goals

- Changing the import naming strategy (task name = log comment). Explicitly rejected.
- Trigram/full-text indexing for `ILIKE '%term%'`; the seq-scan plus `LIMIT` is sufficient at the current scale and can be revisited with `EXPLAIN ANALYZE` evidence.
- Folding `getRemoteIssueRefsForTasks` into the primary select or other cleanups of the ref round-trip in unrelated list endpoints.
- Virtualizing `UInputMenu`; the cap makes it unnecessary.
- Paging or "load more" in the autocomplete.

## Impact

- Server: `apps/web/server/api/tasks/index.get.ts`, `shared/types/task.ts` (`listTasksQuerySchema`), one Drizzle migration adding the `time_entries.taskId` index (`apps/web/server/db/schema/time-entries.ts`).
- Client: `apps/web/app/utils/search-tasks.ts` replaced by a composable used by `AppTimer.vue` and `TimerAddEntryDialog.vue`.
- Tests: `test/e2e/api/tasks.spec.ts` (ordering, limit, validation), nuxt specs for `AppTimer` and the add-entry dialog (debounce/stale guard), unit test for the composable, e2e/db test for the index.
- Docs: `openspec/specs/task-management` and `time-tracking` deltas.
