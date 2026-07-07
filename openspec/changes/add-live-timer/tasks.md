## 1. Schema & migration (backend)

- [ ] 1.1 Add `server/db/schema/time-entries.ts`: `time_entries` (`id` uuidv7 pk, `userId` FK not null, `taskId` FK nullable, `startedAt` timestamptz not null, `stoppedAt` timestamptz nullable, `createdAt`/`updatedAt`), an index on `userId`, and a partial unique index on `(userId) WHERE stoppedAt IS NULL`; export it from the schema barrel.
- [ ] 1.2 Update `server/db/schema/tasks.ts`: remove the `number` column and its `(userId, number)` unique index; add partial unique indexes `(userId, projectId, name) WHERE deletedAt IS NULL` and `(userId, name) WHERE projectId IS NULL AND deletedAt IS NULL`.
- [ ] 1.3 Generate the migration with `pnpm db:generate`; hand-edit it to deduplicate any conflicting `(userId, projectId, name)` non-deleted task rows before the new unique indexes are created.
- [ ] 1.4 Apply and verify the migration locally with `pnpm db:migrate` against a PostgreSQL 18 container.

## 2. Shared boundary types

- [ ] 2.1 Add `shared/types/time-entry.ts`: `startTimeEntrySchema` (`title?: string|null` trimmed/max-length, `projectId?: uuid|null`), `updateTimeEntrySchema` (`stoppedAt?`, `title?`, `projectId?`), and `TimeEntryDto` (`id`, `taskId`, `taskName`, `projectId`, `projectName`, `clientName`, `startedAt: string`, `stoppedAt: string|null`).
- [ ] 2.2 Update `shared/types/task.ts`: remove `number` from `TaskDto`; extend the tasks list query type with an optional `search` string.
- [ ] 2.3 Unit test the zod schemas in `shared/types/time-entry.ts` (valid/invalid title and projectId, stop-before-start rejection).

## 3. Task match/create logic (backend)

- [ ] 3.1 Add a server util (e.g. `server/utils/tasks.ts`) `resolveTaskId(tx, userId, title, projectId)` implementing REQ-TTR-038 matching: empty title → null; match existing non-deleted task in `(userId, name, projectId)` scope; project-less silent match; else create. Must run inside a transaction.
- [ ] 3.2 Unit test `resolveTaskId`: new-title creates, existing-title matches, project-less silent match, empty/whitespace → null.

## 4. Time-entry API (backend)

- [ ] 4.1 `server/api/time-entries/index.post.ts` — start: `requireAuth`, validate `startTimeEntrySchema`, in one transaction stop any running entry then insert the new running entry (resolving `taskId` via 3.1); return `TimeEntryDto`.
- [ ] 4.2 `server/api/time-entries/[id].patch.ts` — stop and/or retitle: `requireAuth`, user-scoped, validate `updateTimeEntrySchema`, enforce `stoppedAt >= startedAt`, re-resolve `taskId`; 404 for foreign/unknown id; return `TimeEntryDto`.
- [ ] 4.3 `server/api/time-entries/running.get.ts` — return the user's running `TimeEntryDto` or `null`.
- [ ] 4.4 Extend `server/api/tasks/index.get.ts` with the `search` query param (case-insensitive name match), user-scoped, returning `TaskDto`s with project/client context.
- [ ] 4.5 Remove per-user `number` assignment from `server/api/tasks/index.post.ts`; enforce per-scope name uniqueness (match instead of duplicate) per REQ-TTR-042; drop `number` from all task query projections.
- [ ] 4.6 e2e tests for the time-entry endpoints (POST/PATCH/GET running): happy paths plus errors — 401 unauthenticated, 404 foreign/unknown id, stop-before-start, single-running-entry (start-while-running stops the old one), untitled entry.
- [ ] 4.7 e2e tests for `GET /api/tasks?search=` and for task create/edit uniqueness + absence of `number`.

## 5. Timer widget & composable (frontend)

- [ ] 5.1 Add `app/composables/useTimer.ts`: shared running-entry state, `fetchRunning()` on app load, `start(title, projectId)`, `stop()`, and a live elapsed-time ticker; mutations via `$csrfFetch`.
- [ ] 5.2 Add `app/components/AppTimer.vue`: PrimeVue `AutoComplete` title input (suggestions from `GET /api/tasks?search=`, showing project/client context), elapsed-time display, start/stop button; labelled/keyboard-operable, theme-tokenized.
- [ ] 5.3 Mount `AppTimer.vue` in the shell's reserved timer region (`app/layouts/default.vue` / `AppTopBar.vue`), replacing the `TIMER PLACEHOLDER` inline and stacked regions.
- [ ] 5.4 Update `app/pages/tasks.vue`: remove the `#N` number column/display; keep CRUD working with the numberless `TaskDto`.
- [ ] 5.5 Add i18n strings for the timer widget/indicator and remove obsolete task-number strings, keeping `en.json` and `pl.json` in parity.

## 6. Frontend tests

- [ ] 6.1 Unit test `useTimer` logic (elapsed-time computation, state transitions on start/stop) with mocked fetch.
- [ ] 6.2 Nuxt component test for `AppTimer.vue` (renders idle vs. running, autocomplete queries the tasks endpoint, start/stop calls, accessible labels).
- [ ] 6.3 E2E test of the timer user flow: start with a title → running indicator shows and survives reload → stop; start-while-running stops the previous entry.
- [ ] 6.4 Nuxt/e2e test that `tasks.vue` no longer renders `#N` and CRUD still works.

## 7. Validation & housekeeping

- [ ] 7.1 Ensure `test/unit/i18n-catalog-parity.spec.ts` passes with the new/removed keys.
- [ ] 7.2 Run `pnpm lint`, `pnpm format:check`, `pnpm test:unit`, and the relevant `pnpm test:e2e` / `pnpm test:nuxt` suites; fix failures.
- [ ] 7.3 Manual a11y pass on the timer widget (keyboard operation, labels, `aria` state) against WCAG 2.1 AA.
