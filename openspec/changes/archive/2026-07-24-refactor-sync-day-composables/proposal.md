## Why

`app/pages/sync/[date].vue` has grown to ~965 lines with four distinct, self-contained state machines crammed into one SFC (remote-activities loading, remote-logs loading, rounding overrides, and export orchestration). The codebase already votes for capability composables (`useTimer`, `useRemoteActivities`, `useRemoteSyncClient`, `useActiveRemoteConfigs`) — none named `useXxxPage`. Extracting the page's FSMs into named, independently testable capability composables shrinks the page to orchestration + template (~250 lines, matching `index.vue`) without changing behavior.

## What Changes

- Extract the three loading/override state machines and export flow from `sync/[date].vue` into capability composables named after domain concepts (e.g. `useRemoteDayLogs`, `useRoundedDurations`, `useSyncExport`; remote-activities loading may reuse/extend the existing `useRemoteActivities`).
- Each composable owns its own cache (`ref<Record<...>>`), in-flight tracking, `ensureLoaded`/`retry`, and derived selectors — the same logic, relocated, with unit tests added at the composable boundary.
- Reduce `sync/[date].vue` to fetching the day aggregate, wiring the composables to the template, and rendering — no behavior change.
- Explicitly reject `useXxxPage`-style page-dumping composables (single caller, hides nothing) as a convention.

## Capabilities

### New Capabilities
- `sync-day-composables`: the architectural contract that the Remote Sync day page delegates its remote-activities loading, remote-logs loading, rounded-duration overrides, and export orchestration to named, behavior-preserving capability composables (not a per-page dumping composable).

### Modified Capabilities
- (none — `remote-sync-review` behavior/requirements REQ-111…REQ-121 are unchanged; this is a structural refactor that must preserve them.)

## Impact

- Code: `app/pages/sync/[date].vue` (shrinks to orchestration); new composables under `app/composables/`.
- Tests: new unit/nuxt tests for each extracted composable; existing `remote-sync-review` e2e/nuxt tests must stay green unchanged (regression guard).
- No API, DB, or i18n-catalog changes.
