## 1. Backend — PATCH title re-resolution

- [x] 1.1 In `server/api/time-entries/[id].patch.ts`, when re-resolving title/`projectId` without `taskId` for an entry that already has a task, load the current task’s `remoteIssueId`, `trackerId`, `remoteIssueCachedTitle`, and `remoteIssueCachedProjectTitle` and pass them into `resolveTaskId` with `remoteIssueId` **present** (null = unlinked). Leave untitled entries on the bare-title call. Verify `pnpm type-check` passes.
- [x] 1.2 Add API e2e coverage (extend `test/e2e/api/time-entries.spec.ts` and/or `test/e2e/api/tasks-remote-issue-ref.spec.ts`): title-only PATCH of a linked entry keeps the same `remoteIssueId` and cache; unlinked retitle stays unlinked and does not bind a differently linked twin of that name; untitled PATCH invents no remote issue; explicit `taskId` still binds that task; foreign/unknown id still 404. Verify with `pnpm test:e2e:api` focused on those cases.

## 2. Frontend — no payload change; lock the journeys

- [x] 2.1 Confirm `TimerEntryRow` and `useTimer().updateTitle` still send `{ title }` (no `taskId`) on free-form commit; do not switch those paths to `reassign`. Verify with existing nuxt specs (`test/nuxt/timer-entry-row.spec.ts`, `test/nuxt/AppTimer.spec.ts`) still green via `pnpm test:nuxt`.
- [x] 2.2 Add a timer-view UI e2e: seed a stopped linked entry, expand the group, retitle the **entry row**, assert the group still shows the same remote issue id. Verify with `pnpm test:e2e:ui` for that spec.
- [x] 2.3 Add a UI e2e: start/continue a linked running timer, commit a new free-form title in the top bar, assert the day’s group still shows the same remote issue. Verify with `pnpm test:e2e:ui` for that spec.

## 3. Verification

- [x] 3.1 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:nuxt`, and the touched e2e projects (`pnpm test:e2e:api`, `pnpm test:e2e:ui`).
