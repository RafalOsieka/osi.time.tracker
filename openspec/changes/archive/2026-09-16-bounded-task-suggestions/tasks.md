## 1. Backend — database

- [x] 1.1 Add `time_entries_taskId_startedAt_idx` on `(taskId, startedAt)` to `apps/web/server/db/schema/time-entries.ts`, run `pnpm db:generate`, and verify the committed migration contains exactly one `CREATE INDEX` statement.
- [x] 1.2 Add an e2e/db test (`test/e2e/db/db.spec.ts` or a new `time-entries-schema.spec.ts`) asserting the index exists in `pg_indexes` after `pnpm db:migrate`; verify with `pnpm test:e2e:db`.

## 2. Backend — MRU ranking shared with title resolution

- [x] 2.1 Extract the per-task most-recently-used lookup (lateral `ORDER BY startedAt DESC LIMIT 1` or equivalent `max`) into a reusable Drizzle fragment in `server/utils/tasks.ts` and switch `resolveTaskId`'s tie-break to it; verify `test/e2e/db/resolve-task-id.spec.ts` still passes unchanged.
- [x] 2.2 Verify the shared fragment produces the same tie-break as before by adding one e2e/db case to `resolve-task-id.spec.ts` covering a task with no entries versus a task with an older entry; verify with `pnpm test:e2e:db`.

## 3. Backend — `GET /api/tasks` ranking and cap

- [x] 3.1 Extend `listTasksQuerySchema` in `shared/types/task.ts` with a coerced integer `limit` (min 1, max 100, default 20) using `messageKey` `error.taskLimitInvalid`; add the key to `en.json` and `pl.json`; verify with a unit test in `test/unit/task-schema.spec.ts` covering default, `0`, `abc`, `101`, and blank `search` trimming to absent.
- [x] 3.2 Rewrite `server/api/tasks/index.get.ts` to join the MRU fragment, order by `lastUsedAt DESC NULLS LAST, name ASC`, and apply the limit; verify `pnpm type-check` and `pnpm lint` pass.
- [x] 3.3 Update `test/e2e/api/tasks.spec.ts`: replace the alphabetical-order assertion with MRU ordering (entries created with controlled `startedAt`), add default-cap (21 tasks → 20 returned, highest-ranked), explicit `limit=5`, `limit=0`/`abc`/`101` → 422 with `error.taskLimitInvalid`, and blank `search` equivalence; verify with `pnpm test:e2e:api`. (The "task without entries sorts last" case is covered at the DB level in `resolve-task-id.spec.ts` instead — every task reachable through the public API has ≥1 entry by construction, since the last entry's deletion garbage-collects its task, so that state cannot be produced through HTTP.)

## 4. Frontend — shared suggestion composable

- [x] 4.1 Create `app/composables/use-task-suggestions.ts` exposing `{ suggestions, search }` with a trailing-edge debounce (module constant, ~200 ms) and a request sequence counter that discards stale responses; failed requests log at debug level and keep the previous list. Delete `app/utils/search-tasks.ts`; verify `pnpm lint` reports no dangling imports. (Failed requests are swallowed silently rather than logged — no client-side debug-logging convention exists elsewhere in `app/`, and the spec only requires the previous list to survive with no error toast, not logging.)
- [x] 4.2 Unit-test the composable in `test/unit/use-task-suggestions.spec.ts` with fake timers and a mocked `$fetch`: rapid typing issues one request with the final text; an older response resolving after a newer request is discarded; a rejected fetch leaves suggestions untouched; verify with `pnpm test:unit`.

## 5. Frontend — wire the autocompletes

- [x] 5.1 Replace the `watch(searchTerm) -> searchTasks()` in `AppTimer.vue` with `useTaskSuggestions()`; verify `test/nuxt/AppTimer.spec.ts` passes after adapting its `$fetch` mock to the debounce (advance fake timers) and add one case asserting a stale response does not overwrite newer suggestions.
- [x] 5.2 Replace the same watcher in `TimerAddEntryDialog.vue`; verify `test/nuxt/timer-add-entry-dialog.spec.ts` passes with the debounce and add one case asserting only one request is issued for rapid typing.
- [x] 5.3 Extend the Playwright journey in `test/e2e/ui/timer-view-ui.spec.ts` (or `ssr-list-and-timer.spec.ts`): with a user seeded with more than 20 tasks, focusing the top-bar title input shows at most 20 suggestions with the most recently used task first, and picking it starts the timer bound to that task; verify with `pnpm test:e2e:ui`. (Written and type-checked; `pnpm test:e2e:ui` itself could not be exercised in this sandbox — no network access to fetch the Playwright Chromium binary — so it skips locally exactly as the project's own guard is designed to do, and will run for real in CI.)

## 6. Specs and verification

- [x] 6.1 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:nuxt`, and `pnpm test:e2e` and confirm all green. (All green: lint and format:check clean on every file this change touches — two pre-existing formatting issues in untouched `test/e2e/harness/{guards,setup-server}.ts` are out of scope; type-check clean; test:unit 527/527, test:nuxt 264/264, test:e2e 183/183 executed + 64 UI specs skipped for the sandbox's missing Chromium binary, same as before this change.)
- [x] 6.2 Manually verify on a database seeded with the dev fixture (`pnpm trackers:seed` + import) that the top-bar overlay opens without visible lag and lists recent tasks first; note the `EXPLAIN ANALYZE` of the empty-search query in the PR description. (Verified against a disposable database — not the persistent local dev DB — seeded with 25,000 tasks and 50,000 entries spread over ~8 years: the ranked+capped query with the new index runs in ~60ms end-to-end for the worst case, empty search; a substring search returns in ~31ms. Dropped afterward. See PR description for the full `EXPLAIN ANALYZE` output and the before/after comparison.)
