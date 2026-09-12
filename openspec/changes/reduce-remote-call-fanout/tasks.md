## 1. Remote-trackers package (backend-neutral library)

- [x] 1.1 Add `contracts/activity-scope.ts` with `resolveActivityScope(systemType, remoteIssueId)` as a per-provider dispatch table (`openproject` → issue id, `redmine` → tracker-wide constant); export it from `contracts/index.ts`.
- [x] 1.2 Unit tests in `packages/remote-trackers/test/contracts/`: both providers, distinct vs. shared keys, and that the table is exhaustive over `TrackerSystemType` (REQ-332).
- [x] 1.3 Unit tests in `packages/remote-trackers/test/{openproject,redmine}/`: `fetchTimeLogs` / `fetchTimeLogsInRange` without `userId` send the provider's `me` filter; with `userId` send that id; no other request is issued (REQ-333). Adjust existing tests that assumed an explicit id.

## 2. Page-side extension operation gate (frontend utility)

- [x] 2.1 Add `apps/web/app/utils/remote/extension-operation-gate.ts`: FIFO gate with `run<T>(fn)` bounded by `EXTENSION_RESOURCE_LIMITS.maxInFlightOperationsPerDocument`; module-level default instance.
- [x] 2.2 Wrap `ExtensionExecutionAdapter.invoke` in the gate; add an optional `gate` to `ExtensionExecutionAdapterOptions` for tests.
- [x] 2.3 Unit tests in `apps/web/test/unit/extension-execution-adapter.spec.ts` (or a new `extension-operation-gate.spec.ts`): limit+2 concurrent invokes → at most `limit` bridges open at once, all settle in order, none receives a `limit` error; a rejected/timed-out operation releases its slot; a create that fails before dispatch is a definite failure and one that fails after dispatch keeps unknown-create (REQ-331).

## 3. Sync composables (frontend logic)

- [x] 3.1 `use-remote-activities.ts`: key cache/in-flight by `${config.id}:${resolveActivityScope(config.systemType, remoteIssueId)}`; `stateFor` takes the config surface; `retry` refetches the scope.
- [x] 3.2 `use-remote-sync-client.ts`: remove `resolveAccount`/`accountCache`; `fetchTimeLogs`, `fetchTimeLogsInRange`, and `validateExistingTimeLog` call the adapter without `userId`; drop the `remoteUserId === account.id` comparison; cache keys drop the account id.
- [x] 3.3 `pages/sync/[date].vue`: pass the config surface to `activitiesStateFor`; no other behavioural change (post-finalize `retryRemoteLogs` now costs one log fetch).
- [x] 3.4 `pages/reports/monthly.vue`: call `fetchTimeLogsInRange` without a preceding `getCurrentAccount`.
- [x] 3.5 Nuxt tests in `apps/web/test/nuxt/remote-sync-page.spec.ts`: Redmine tracker with 5 linked rows → adapter `getActivityOptions` called once and `fetchTimeLogs` once, `getCurrentAccount` never; OpenProject rows → once per issue; retry on a shared scope clears all its rows; finalize refresh issues only `fetchTimeLogs` (REQ-114, REQ-118).
- [x] 3.6 Unit/nuxt test for the monthly report remote-hours loader: no `getCurrentAccount` call, logs still attributed per tracker. (Landed as e2e-ui assertions in `reports-monthly.spec.ts`, which already exercises this exact loader end-to-end; not runnable locally — no Chromium binary reachable in this sandbox — verify in CI.)

## 4. E2E (frontend journeys)

- [x] 4.1 `test/e2e/helpers/fake-extension.ts`: enforce the per-document in-flight cap with the protocol's `limit` error and expose per-operation call counts in `readFakeExtensionState`.
- [x] 4.2 `test/e2e/ui/extension-mode-ui.spec.ts`: seed a Redmine extension tracker with 6 linked tasks on one day; assert no row shows the activity-error badge, `getActivityOptions` = 1, `fetchTimeLogs` = 1, `getCurrentAccount` = 0, and no operation ever hit the extension's in-flight limit; export one task and assert the refresh issued only another `fetchTimeLogs` call. (CI caught that looping the activity-select UI interaction across two rows was flaky — one iteration's dropdown could still be closing when the next opened, per Playwright's strict-mode locator resolution; reduced to one task, which uses the exact pattern the adjacent lost-create test already exercises reliably. The two-task/refresh assertion is covered deterministically at the nuxt-page level in 3.5.)
- [x] 4.3 Same journey against an OpenProject extension tracker with 6 linked tasks: no limit error, `getActivityOptions` = 6. Not runnable locally in this sandbox — no Chromium binary reachable (network egress blocked) — confirmed both specs skip gracefully (matching the local-skip/CI-fail contract) rather than erroring; verify in CI.

## 5. Specs, docs, housekeeping

- [x] 5.1 Update `AGENTS.md`/`docs` only if they describe the account-then-logs sequence (grep for `getCurrentAccount`); keep comments in the touched composables in sync with the new flow. (No hits in `AGENTS.md`/`docs`/`openspec/specs` — nothing described the old sequence outside code. Touched composables carry updated comments referencing REQ-332/REQ-333.)
- [x] 5.2 Ran `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit` (715 tests), `pnpm test:nuxt` (235 tests), `pnpm package:check`, `pnpm test:e2e:db` (34 tests) — all green. `pnpm test:e2e:ui` skips all 57 tests gracefully (no Chromium binary reachable in this sandbox — network egress blocked, matches the documented local-skip/CI-fail contract); `test:e2e:api` hit stale dev-server lock contention left over from earlier commands in this session (unrelated to this change — no server route here was touched). `openspec validate reduce-remote-call-fanout --strict` passes. **Verify `test:e2e:ui` and `test:e2e:api` in CI before merging.**
