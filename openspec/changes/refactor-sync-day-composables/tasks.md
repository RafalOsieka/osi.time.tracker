# Tasks — refactor-sync-day-composables

## 0. Baseline
- [ ] 0.1 Capture the current green state of the `remote-sync-review` e2e/nuxt suites as the regression baseline (these must stay green **unmodified** throughout).

## 1. Remote-activities loading
- [ ] 1.1 Move the activities loading FSM (scope-keyed cache, in-flight, error, `ensureLoaded`/`retry`, selectors) out of `sync/[date].vue`, reusing/extending the existing `useRemoteActivities` where it fits.
- [ ] 1.2 Wire the page to the composable; keep the page green.
- [ ] 1.3 Add composable-boundary tests (loading → loaded/error, retry, selectors).

## 2. Remote-logs loading
- [ ] 2.1 Extract `useRemoteDayLogs` (config-keyed cache, same-day filtering, in-flight, error, `ensureLoaded`/`retry`, selectors) per REQ-118.
- [ ] 2.2 Wire the page; keep green.
- [ ] 2.3 Add composable-boundary tests.

## 3. Rounded-duration overrides
- [ ] 3.1 Extract `useRoundedDurations` (override map, raw input text, commit-on-blur/Enter, revert-on-invalid/Escape) preserving REQ-113 exactly.
- [ ] 3.2 Wire the page; keep green.
- [ ] 3.3 Add composable-boundary tests including invalid-input revert-without-emit.

## 4. Export orchestration
- [ ] 4.1 Extract `useSyncExport` (batch run, per-task outcomes, running state) preserving REQ-120 (no strict-idempotency claim, ≤1 log per task per batch).
- [ ] 4.2 Wire the page; keep green.
- [ ] 4.3 Add composable-boundary tests for per-task outcome reporting.

## 5. Page tidy-up
- [ ] 5.1 Reduce `sync/[date].vue` to aggregate fetch + composable wiring + template (~250 lines).
- [ ] 5.2 Confirm no inline state machine equivalent remains (REQ-176).

## 6. Verification
- [ ] 6.1 `pnpm lint`, `pnpm format:check`, `pnpm type-check` clean.
- [ ] 6.2 New composable unit/nuxt tests green (REQ-177).
- [ ] 6.3 Existing `remote-sync-review` e2e/nuxt suites green **without modification** (behavior-preservation guard, REQ-176).
