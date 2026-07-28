## 1. Backend: export request key

- [ ] 1.1 Add a nullable `exportRequestKey` column to the remote-export record in `server/db/schema` with a per-user unique index, and generate the migration with `pnpm db:generate`
- [ ] 1.2 Extend the finalize input/DTO in `shared/types/remote-export.ts` with `exportRequestKey` and an explicit optional `comment`
- [ ] 1.3 Reconcile in `POST /api/sync/export`: when a stored record already exists for the user's key, return that stored result instead of persisting a second record
- [ ] 1.4 Integration tests for the finalize endpoint: happy path storing the key, repeated submission of the same key returning the stored result, differing key creating a separate record, legacy record without a key still readable, and the existing stale/foreign rejection cases

## 2. Backend: shared key derivation

- [ ] 2.1 Add a pure `buildExportRequestKey({ taskId, localDate, entryIds, exportDurationSeconds })` to `shared/utils/` with deterministic entry-id ordering
- [ ] 2.2 Unit-test key derivation: stable across entry-id ordering, changes with duration, changes with selection, differs per task and per date

## 3. Export orchestration composable

- [ ] 3.1 Extend `useSyncExport` with per-task `progress` states (`queued` / `creating` / `finalizing` / `done` / `failed` / `uncertain` / `not_attempted`) and `completedCount` / `totalCount`
- [ ] 3.2 Add `requestStop()` that prevents the next task from starting without interrupting the in-flight one, marking remaining tasks as not attempted
- [ ] 3.3 Add `retryTask(taskId)` that re-runs a single task with the same inputs, reusing the export request key and any known remote log id, and replaces that task's outcome in place
- [ ] 3.4 Send the per-task comment instead of the hard-coded task name, falling back to the task name when empty, and pass the export request key to finalization
- [ ] 3.5 Unit tests for `useSyncExport`: progress transitions, stop semantics, single-task retry isolation, uncertain-then-retry reconciliation, comment fallback

## 4. Export dialog UI

- [ ] 4.1 Create `app/components/sync/SyncExportDialog.vue` with review / running / report phases over one continuous row table and phase-specific footer actions
- [ ] 4.2 Review phase: per-task issue, activity, tracked → to send, comment, repeat badge, possible-duplicate badge; day-total / tracked / to-send summaries; skipped tasks with reasons
- [ ] 4.3 Running phase: per-task status column, completed-of-total indicator in a polite live region, non-dismissible dialog, stop action
- [ ] 4.4 Report phase: succeeded / failed / needs-verification groups, per-task retry, remote log id and tracker deep link for needs-verification rows, refresh of the day review on close
- [ ] 4.5 Replace the repeat `useAppConfirm` call and the inline outcome paragraphs in `app/pages/sync/[date].vue` with the dialog
- [ ] 4.6 Add all dialog, phase, status, retry and comment i18n keys to `en.json` and `pl.json` in parity

## 5. Per-task export comment

- [ ] 5.1 Hold comments in day-scoped page state, defaulting to the latest fetched remote-log comment for the linked issue and otherwise to the task name
- [ ] 5.2 Render the comment field in the task detail region with an accessible label, translated hint and a stable `data-testid`
- [ ] 5.3 Unit-test the comment default resolution (remote-log comment, task-name fallback, empty-value fallback)

## 6. E2E coverage

- [ ] 6.1 E2E: open the review phase, assert the listed rows, totals and skipped reasons, cancel and assert nothing was sent
- [ ] 6.2 E2E: confirm an export, assert per-task progress and the report groups, then assert the day review refreshed
- [ ] 6.3 E2E: force one task to fail, retry only that task from the report, and assert the other tasks were not re-sent
- [ ] 6.4 E2E: edit a task comment and assert the reviewed value is what gets exported

## 7. Verification

- [ ] 7.1 Run `pnpm db:migrate` against the local database and confirm the new column and index apply cleanly
- [ ] 7.2 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`
- [ ] 7.3 Run `pnpm test:unit`, `pnpm test:nuxt`, `pnpm test:e2e`
