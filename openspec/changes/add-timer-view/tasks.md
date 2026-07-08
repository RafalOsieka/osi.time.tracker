# Tasks: add-timer-view

## 1. Database & shared types (backend)

- [x] 1.1 Migration: detach entries of soft-deleted tasks (`taskId = null`), hard-delete those task rows, drop `tasks.deletedAt`, recreate name-uniqueness indexes without the `deletedAt` predicate; update `server/db/schema` accordingly (REQ-TTR-047, REQ-TTR-042)
- [x] 1.2 E2E test: migration/schema behavior — no `deletedAt` on tasks, unique indexes enforce `(userId, projectId, name)` and project-less scope (adapt `test/e2e/tasks-schema.spec.ts`)
- [x] 1.3 Update `shared/types/time-entry.ts`: add `listTimeEntriesQuerySchema` (`from`/`to` instants, `from < to`) and `bulkAssignSchema` (`ids` non-empty uuid array, trimmed non-empty `title`, optional `projectId`); update `shared/types/task.ts` (drop create-only schema, keep update schema for the mini editor)
- [x] 1.4 Unit tests for the new/changed zod schemas (valid, invalid range, empty ids/title; replace `test/unit/task-schema.spec.ts` coverage)

## 2. Task API changes (backend)

- [x] 2.1 Remove `POST /api/tasks` and `DELETE /api/tasks/[id]` route handlers; adjust `GET /api/tasks` and task queries to drop `deletedAt` filtering on tasks (REQ-TTR-026, REQ-TTR-047)
- [x] 2.2 Implement merge-on-collision in `PATCH /api/tasks/[id]`: single transaction re-points entries to the survivor, hard-deletes the emptied task, returns the survivor with context (REQ-TTR-028)
- [x] 2.3 E2E tests: PATCH merge happy path (rename onto existing key, entries moved, loser row gone), clear-project merge into project-less task, non-colliding edit still works, foreign/unknown id 404; removed routes return 404/405 (rework `test/e2e/tasks.spec.ts`)

## 3. Time-entry list endpoint (backend)

- [x] 3.1 Implement `GET /api/time-entries` (`index.get.ts`): validate `from`/`to`, return user-scoped `TimeEntryDto[]` in `[from, to)` by `startedAt` DESC with task/project/client LEFT joins (REQ-TTR-044)
- [x] 3.2 E2E tests: range filtering and ordering, running entry included, invalid/missing range rejected with `{ messageKey }`, cross-user isolation

## 4. Bulk-assign endpoint (backend)

- [x] 4.1 Implement `POST /api/time-entries/bulk-assign`: single transaction, one `resolveTaskId` call, all-or-nothing update of owned untitled entries (REQ-TTR-045)
- [x] 4.2 E2E tests: happy path (all entries bound, task created or matched once), atomic rejection when an id is foreign/unknown/already-titled (no partial writes), empty title/ids rejected, CSRF/auth guards

## 5. Timer view page (frontend)

- [x] 5.1 Build day/task grouping + duration utilities (browser-local day key from `startedAt`, day and group totals, "(no task)" bucket) as a composable/util with unit tests (REQ-TTR-046)
- [x] 5.2 Replace `app/pages/index.vue` with the timer view: day sections newest-first with localized date heading + day total, task groups (name, project/client context, count, total), expandable read-only entry rows, 7-day window with "load more", empty state (REQ-TTR-046, REQ-NFR-028)
- [x] 5.3 Continue action: start entry via `useTimer.start(taskName, projectId)`, running entry marked live in today's group and synced with the shell widget (REQ-TTR-048)
- [x] 5.4 Bulk-assign action on the "(no task)" group: title autocomplete (reuse `GET /api/tasks?search=`), optional project, `$csrfFetch` to the bulk endpoint, regroup on success (REQ-TTR-048, REQ-TTR-045)
- [x] 5.5 Mini task editor on task groups: rename / change / clear project, client-side name validation with inline accessible errors, seed project select with soft-deleted project, regroup after merge (REQ-TTR-049)
- [x] 5.6 Nuxt component tests: grouping/totals rendering, empty state, expand/collapse accessibility (expanded state exposed), mini-editor validation blocks empty name
- [x] 5.7 E2E tests (UI): timer view lists seeded entries grouped by day/task, continue starts a timer, bulk assign moves the "(no task)" bucket, mini-editor rename merges groups, load more extends the window

## 6. Shell, tasks-page removal, i18n (frontend)

- [x] 6.1 Update `AppSidebar.vue`: remove Tasks item, rename Dashboard → Timer (`nav.timer`, `pi pi-stopwatch` or similar), keep `/` route (REQ-AUTH-011)
- [x] 6.2 Delete `app/pages/tasks.vue` and its page-specific code; remove obsolete tasks-page tests (`test/e2e/tasks-ui.spec.ts`, `test/nuxt/tasks.spec.ts`) and update `test/e2e/shell.spec.ts` / `test/nuxt/shell.spec.ts` nav expectations
- [x] 6.3 i18n: add timer-view keys, add `nav.timer`, remove orphaned tasks-page keys — `en`/`pl` in parity (parity test green)

## 7. Verification

- [x] 7.1 Run `pnpm lint`, `pnpm format:check`, `pnpm test:unit`, `pnpm test:nuxt`, `pnpm test:e2e`; fix regressions until green
