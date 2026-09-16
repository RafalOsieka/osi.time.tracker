## Context

See proposal.md — Why. Current shape of the path:

```
keystroke -> watch(searchTerm) -> GET /api/tasks?search=   (no debounce, no cancel)
          -> SELECT tasks ILIKE '%x%' ORDER BY name         (no LIMIT)
          -> SELECT refs WHERE id IN (<every id>)
          -> N x TaskDto JSON -> buildTaskTitleMenuItems -> UInputMenu renders N rows
```

Constraints that shape the design:

- `GET /api/tasks` has exactly one consumer in the app: `searchTasks()` behind the two title autocompletes. There is no task-management page, so the alphabetical uncapped list has no other client.
- REQ-137 already defines "most recently used" as `max(time_entries.startedAt)` per task, and `resolveTaskId` computes it with a `LEFT JOIN time_entries ON taskId`. `time_entries` has indexes on `(userId)` and `(userId, startedAt)` but none on `taskId`, so that join and every `WHERE taskId = ?` garbage-collection check sequentially scan the whole table.
- The DB is per-user isolated; `tasks` rows per user are in the tens of thousands after a long import, `time_entries` roughly the same order.
- Existing e2e API tests (`test/e2e/api/tasks.spec.ts`) seed a fresh user per test and create a handful of tasks, so a default cap of 20 does not break them; the one test asserting `name` ordering must be rewritten.

## Goals / Non-Goals

**Goals:**

- One query shape for suggestions that stays flat as history grows: bounded output, index-backed ranking.
- The MRU concept is computed one way and used by both title resolution (REQ-137) and the suggestion list.
- The client cannot render more than the cap and cannot show a stale result.

**Non-Goals:**

- Making `ILIKE '%x%'` index-backed (`pg_trgm`). Revisit only with `EXPLAIN ANALYZE` evidence from a real database.
- Denormalising `lastUsedAt` onto `tasks`.
- Any change to import naming or task garbage-collection semantics.

## Decisions

### 1. Rank by a per-task MRU lookup, not by an aggregate over the user's entries

```sql
SELECT t.*, p.name AS projectName, lu.startedAt AS lastUsedAt
FROM tasks t
LEFT JOIN projects p ON p.id = t.projectId
LEFT JOIN LATERAL (
  SELECT e.startedAt FROM time_entries e
  WHERE e.taskId = t.id
  ORDER BY e.startedAt DESC LIMIT 1
) lu ON true
WHERE t.userId = $1 AND t.name ILIKE $2
ORDER BY lu.startedAt DESC NULLS LAST, t.name ASC
LIMIT $3
```

With the new `time_entries (taskId, startedAt)` index the lateral subquery is a one-row backwards index scan per candidate task. Cost is proportional to the number of tasks matching the filter (worst case, empty search: all of the user's tasks, ~20k cheap index probes), never to the number of entries.

Alternatives:

- `LEFT JOIN (SELECT taskId, max(startedAt) FROM time_entries WHERE userId = $1 GROUP BY taskId)` — one pass over all of the user's entries per request regardless of how narrow the search is. Simpler SQL, but cost grows with entry count, which is the axis that actually grows.
- Denormalised `tasks.lastUsedAt` maintained on every entry insert/patch/delete/reassign/bulk-assign/import. Fastest read, but write amplification across six code paths and a drift risk with no reconciliation. Rejected for an MVP with a single-user workload.

The same lateral/`max` shape should be reused by `resolveTaskId`'s tie-break so both consumers benefit from the index and agree on ordering. Keep it as a small shared Drizzle fragment in `server/utils/tasks.ts` rather than a view.

### 2. Index `time_entries (taskId, startedAt)` rather than `(taskId)` alone

`(taskId)` covers the GC existence checks (`WHERE taskId = ? LIMIT 1`) and the FK. Adding `startedAt` as the second column additionally lets the MRU lookup read the newest entry straight off the index without a heap sort. One index serves both; a `(taskId)`-only index would still leave the MRU probe sorting. Cost: one extra 8-byte column in a b-tree that would exist anyway.

Migration is a plain `CREATE INDEX` in a committed SQL file (`pnpm db:generate`), applied by the existing migrator. No data backfill; safe to roll back by dropping the index.

### 3. Cap on the server, default 20, max 100, validated with zod

`listTasksQuerySchema` gains `limit`. Query strings arrive as strings, so the schema must coerce (`z.coerce.number().int().min(1).max(100)`) with a `messageKey` (`error.taskLimitInvalid`) added to both catalogs; `getZodQuery` maps the `ZodError` to the 422 contract as today. The client does not send `limit` at all — the default is the overlay size, and keeping the client parameter-free means the cap cannot drift between the two autocompletes.

Alternative: cap only when `search` is present and keep the bare list uncapped/alphabetical for a hypothetical future task page. Rejected — nothing consumes it, and a future page would want paging anyway, not an unbounded list.

### 4. One `useTaskSuggestions()` composable replaces `searchTasks()`

Returns `{ suggestions, search(text) }`. Internally: a trailing-edge debounce (~200 ms, a module constant) around the fetch, and a monotonically increasing request sequence; a response is applied only if its sequence is the latest. Errors are swallowed into a `consola` debug log — the previous list stays. `AppTimer.vue` and `TimerAddEntryDialog.vue` both replace their `watch(searchTerm) -> search()` with this composable; `buildTaskTitleMenuItems` is untouched.

Sequence counter rather than `AbortController`: aborting saves bandwidth but the server still does the work, and the counter is what actually guarantees ordering. Both could be combined later; the counter is the necessary half.

No VueUse dependency exists in the project; a ten-line `setTimeout` debounce inside the composable is simpler than adding one for a single use.

### 5. `getRemoteIssueRefsForTasks` second round-trip stays

It is now bounded by the cap (≤100 ids), so the cost is negligible. Folding the ref columns into the primary select is a valid cleanup but touches four other endpoints; out of scope.

## Risks / Trade-offs

- [Empty search still scans all of the user's tasks and probes the index per task] → Bounded by task count (tens of thousands), one index probe each; expected well under 100 ms. If it is not, restricting the empty-search path to "recent tasks" via a `startedAt` window on the lateral subquery is a follow-up that does not change the contract.
- [Ordering change is observable to any external API consumer] → None exist; the change is documented in the spec delta as breaking.
- [Debounce adds ~200 ms perceived latency before suggestions update] → Trailing-edge only; selecting/committing does not wait for it. Value is a single constant to tune.
- [Existing `tasks.spec.ts` e2e asserts alphabetical order] → Rewritten to assert MRU order by creating entries with controlled `startedAt`.
- [Migration on prod adds an index on a table with 8 years of rows] → Plain `CREATE INDEX` on tens of thousands of rows completes in well under a second; the prod migrator already runs before the web container serves traffic. No `CONCURRENTLY` needed at this scale.

## Migration Plan

1. Ship the migration and the endpoint change together; the endpoint works without the index (just slower), so ordering within the release does not matter.
2. Prod: existing `docker-compose.prod.yml` migrator applies the index before the app starts.
3. Rollback: revert the app; the index is harmless if left in place, or drop it with a down migration.
