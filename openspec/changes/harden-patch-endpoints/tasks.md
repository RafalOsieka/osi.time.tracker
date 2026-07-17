## 1. Repro tests first (must fail before the fix)

- [ ] 1.1 Extend `test/e2e/tasks.spec.ts` (reuse the `patchTask` helper): `PATCH /api/tasks/[id]` with `{ name }` only keeps `projectId`; with `{ projectId: null }` clears it; with `{ projectId: "<owned uuid>" }` sets it (ownership validated)
- [ ] 1.2 Extend `test/e2e/time-entries.spec.ts`: `PATCH /api/time-entries/[id]` with `{ title }` only keeps the entry's current project scope; with `{ projectId: null }` moves it to the project-less scope
- [ ] 1.3 Add a pinning test in `test/e2e/projects.spec.ts`: `PATCH /api/projects/[id]` with `{ name }` only returns `422`
- [ ] 1.4 Run the new tests; confirm the tasks/time-entries repro tests **fail** against current code and the projects pinning test **passes**

## 2. Fix the tasks PATCH handler

- [ ] 2.1 In `server/api/tasks/[id].patch.ts`, replace `const newProjectId = parsedBody.projectId ?? null;` with `const projectProvided = parsedBody.projectId !== undefined;` and `const targetProjectId = projectProvided ? parsedBody.projectId : existing.projectId;`
- [ ] 2.2 Enforce project ownership validation only when `projectId` is provided and changed to a different non-null value
- [ ] 2.3 Thread `targetProjectId` through `projectCondition`, the collision/merge logic, and the `.set(...)` update
- [ ] 2.4 Re-run the tasks repro tests (green) and confirm existing merge/collision tests stay green

## 3. Fix the time-entries PATCH handler and resolveTaskId path

- [ ] 3.1 In `server/api/time-entries/[id].patch.ts`, add a `projectId` fallback symmetric to the existing title fallback: when `projectId` is absent, resolve it to the current task's project before calling `resolveTaskId`
- [ ] 3.2 Ensure an absent `projectId` means "keep" rather than collapsing to `null` via `?? null` on the `resolveTaskId` path (`server/utils/tasks.ts`)
- [ ] 3.3 Re-run the time-entries repro tests and `test/e2e/resolve-task-id.spec.ts` (green)

## 4. Verification & docs

- [ ] 4.1 Confirm all repro tests pass and none were weakened or skipped
- [ ] 4.2 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`, and `pnpm test:e2e` (plus `test:unit`/`test:nuxt` as relevant); fix any fallout
- [ ] 4.3 Ensure the proposal, spec deltas, and `CODING_STANDARDS.md §10` rule stay consistent with the implemented behavior
