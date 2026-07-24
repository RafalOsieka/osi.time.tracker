## 1. Boundary types (shared)

- [x] 1.1 Add a `taskId` (optional uuid) field to the start (`POST /api/time-entries`) and patch (`PATCH /api/time-entries/[id]`) zod schemas in `shared/types`, deriving input types via `z.infer`.
- [x] 1.2 Add a `reassignTimeEntriesSchema` in `shared/types` for `{ ids: uuid[] (non-empty), name?: string (trimmed, bounded), projectId?: uuid | null }`.
- [x] 1.3 Unit-test the new/updated schemas (accepts valid shapes, rejects empty `ids`, empty `name`, invalid uuids).

## 2. Backend — explicit taskId binding (REQ-140, REQ-143)

- [x] 2.1 In `time-entries/index.post.ts`, when `taskId` is provided, validate it is owned by the user (404 otherwise) and bind the entry directly, bypassing title resolution.
- [x] 2.2 In `time-entries/[id].patch.ts`, add the same `taskId` precedence branch over title/project resolution.
- [x] 2.3 Integration tests: start bound to `taskId` (happy path) + foreign/unknown `taskId` → 404; patch bound to `taskId` + foreign/unknown `taskId` → 404.

## 3. Backend — day-scoped reassignment endpoint (REQ-179)

- [x] 3.1 Add `POST /api/time-entries/reassign.post.ts`: validate body, ensure all `ids` belong to the user (404 otherwise), all in one transaction.
- [x] 3.2 Compute the effective project scope (omitted → source task's project; explicit `null` → project-less; uuid → that owned project) and `resolveTaskId(effectiveName, effectiveProjectId)` (reuse `server/utils/tasks.ts`), then re-point listed entries.
- [x] 3.3 Garbage-collect the emptied source task (reuse the GC pattern from delete/REQ-151); return updated `TimeEntryDto`s.
- [x] 3.4 Integration tests: rename one day's entries leaves other days intact; source GC when emptied; `projectId`-only change; atomic failure on foreign/unknown id → 404, nothing modified.

## 4. Frontend — top-bar timer widget (REQ-180)

- [x] 4.1 Rewire the suggestion `UInputMenu` in `AppTimer.vue` to object items with a single `@update:model-value` handler; remove the string cast and the nested `<button>`.
- [x] 4.2 Update `suggestionLabel()` to append the remote issue id when present (name · project · client #<remoteIssueId>).
- [x] 4.3 Capture the picked task's `taskId` and thread it through `useTimer.ts` start/update calls; free-form titles keep the title path.
- [x] 4.4 Anchor the elapsed-time start-edit popover to the elapsed control (make it the `UPopover` trigger/anchor).
- [x] 4.5 Add/verify i18n `en`/`pl` parity for any new/changed strings.

## 5. Frontend — day-scoped inline group editor (REQ-153)

- [x] 5.1 In `TimerTaskGroup.vue`, change `commitTitle`/`commitProject` to call the new reassign endpoint with the group's day entry ids instead of `PATCH /api/tasks/[id]`.
- [x] 5.2 On success, regroup affected entries and refresh running-timer state; keep empty-name silent-revert and Escape-cancel behavior.

## 6. Tests — frontend flows

- [x] 6.1 Nuxt component test: selecting a suggestion fires exactly one selection, sends `taskId`, and never sets `[object Object]`.
- [x] 6.2 E2E: start-from-suggestion binds the entry to the picked task's project/remote ref and the timer page reflects it after reload.
- [x] 6.3 E2E: renaming a task group that spans multiple days moves only that day's entries; other days keep the old task.
- [x] 6.4 Unit test any extracted grouping/label helper (e.g. `timerViewGrouping.ts` day entry-id selection, suggestion label formatting).

## 7. Verification

- [x] 7.1 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`.
- [x] 7.2 Run `pnpm test:unit`, `pnpm test:nuxt`, and `pnpm test:e2e`; ensure the whole suite is green.
