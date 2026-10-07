# Tasks

## 1. Backend: task garbage collection (REQ-491, REQ-447)

- [ ] 1.1 Add regression tests to `apps/web/test/e2e/api/time-entries.spec.ts` for patching the only entry of a task: retitle to a different task, rebind with `taskId`, and `title: null`, each asserting the previous task is absent from `GET /api/tasks`. Add the keep cases too: one of several entries retitled, and a retitle that resolves to the current task. Verify the three collect cases fail against the current code and the keep cases pass.
- [ ] 1.2 Add `deleteTaskIfEmpty(tx, userId, taskId)` to `apps/web/server/utils/tasks.ts` and call it from `PATCH /api/time-entries/[id]` when the resolved `taskId` differs from the previous one. Replace the inline checks in `[id].delete.ts` and `reassign.post.ts` with it (reassign still skips the target). Point the REQ comments at REQ-491. Verify with `pnpm test:e2e:api`: the tests from 1.1 and the existing delete, reassign and task merge tests pass.

## 2. Backend and shared: leftovers

- [ ] 2.1 Remove the `executionMode` guard from `apps/web/shared/types/tracker.ts` (the `z.never()` field, the transform and the doc-comment sentence), the `error.trackerExecutionModeRequired` key from both catalogs, the rejection test in `test/unit/tracker-schema.spec.ts`, and the `server` / `tunneled` assertions in `test/e2e/api/trackers.spec.ts`. Verify with `pnpm test:unit`, `pnpm test:e2e:api` and `pnpm lint` (i18n parity).
- [ ] 2.2 Rename `error.remoteServerMode{SecretRequired,AuthRejected,ConnectionFailed}` to `error.remoteTracker{…}` in `packages/remote-trackers`, `packages/extension-protocol`, the web app, both catalogs and every test. Verify that `git grep remoteServerMode` is empty and that `pnpm package:check`, `pnpm test:unit`, `pnpm test:nuxt` and `pnpm test:extension` pass.
- [ ] 2.3 Delete the tests that only assert a removed surface stays absent: the `POST/DELETE /api/tasks` route test in `test/e2e/api/tasks.spec.ts`, the settings-endpoint test in `test/e2e/api/profile.spec.ts`, the `/settings` test in `test/e2e/ui/profile-ui.spec.ts`, the `transportMode` test in `test/unit/tracker-schema.spec.ts`, and the source-scanning `describe` in `test/unit/shared-types-zod-v4.spec.ts` (its REQ-172 identifier tests stay). Move the `REQ-399` comments in the profile handlers and `shared/types/profile.ts` to REQ-493. Verify with `pnpm test:unit`, `pnpm test:e2e:api` and `pnpm test:e2e:ui`.

## 3. Frontend: leftovers

- [ ] 3.1 Remove `roundingSuggestionsFor`, `RoundingSuggestion` and their tests from `shared/utils/rounding.ts`, `suggestionsFor` and its test from `use-rounded-durations`, and the `roundingSuggestionsFor` line from the shared-chunk warmup plugin. Verify that `git grep -i suggestionsFor` finds only archived changes and that `pnpm test:unit` and `pnpm type-check` pass.
- [ ] 3.2 Remove the hidden `remote-sync-day-total` span and its comment from `pages/sync/[date].vue`. Verify that `git grep remote-sync-day-total\b` is empty and that `pnpm test:nuxt` passes.
- [ ] 3.3 Remove the residual PrimeVue comment and component names from `eslint.config.mjs`. Verify that `git grep -i primevue` finds only archived changes and that `pnpm lint` passes.

## 4. Docs and traceability

- [ ] 4.1 Add rows to `docs/retired-requirements.md` for REQ-132 → REQ-491, REQ-245 → REQ-492, REQ-399 → REQ-493, REQ-400 → REQ-494, and REQ-314 and REQ-364 as dropped migration requirements. Verify that the compact-specs `refs` script reports no dangling or reused codes.
- [ ] 4.2 In `docs/development.md`, replace the CI sentence saying the `specs` job is not required with one saying every CI job except the informational Codecov statuses is a required check. Verify that `pnpm format:check` passes.
- [ ] 4.3 Verify that `openspec validate task-gc-and-leftover-cleanup --strict` passes.

## 5. Integration check

- [ ] 5.1 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:nuxt`, `pnpm test:extension` and `pnpm test:e2e` and verify that all pass, including the production build that the warmup plugin affects.

## Workflow follow-up

- The repository owner adds the `package`, `extension`, `coverage` and `specs` checks to the `main` ruleset in GitHub settings.
- Archive the change after review; check that the archived specs read as the current state.
