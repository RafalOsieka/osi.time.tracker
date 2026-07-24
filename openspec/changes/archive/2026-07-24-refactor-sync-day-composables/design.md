# Design — refactor-sync-day-composables

## Context

`index.vue` (~309 lines) and `sync/[date].vue` (~965 lines) are **not** the same problem:

```
   index.vue (309)              sync/[date].vue (965)
   ───────────                  ─────────────────────
   template heavy               LOGIC heavy
   ~130 lines script            ~600 lines script
   thin orchestration           4 independent stateful
   (fetch + wire children)      subsystems in one file
```

`index.vue` is coordinating — that is a page's job — and is left as-is. `sync/[date].vue` is the target: four self-contained state machines share one file.

```
  ┌─────────────────────────────────────────────┐
  │            sync/[date].vue                    │
  ├───────────────┬───────────────┬───────────────┤
  │  Activities   │  Remote logs  │   Rounding    │
  │  loading FSM  │  loading FSM  │  overrides    │
  │  (scope keys, │  (config keys,│  + input text │
  │   in-flight)  │   filtering)  │               │
  ├───────────────┴───────────────┴───────────────┤
  │        Export orchestration (runExport)        │
  └─────────────────────────────────────────────┘
```

## Decisions

### Extract by capability, not by page

```
  ADOPT: extract by CAPABILITY      REJECT: extract by PAGE
  ─────────────────────────         ─────────────────────
  useRemoteActivities()  (reuse)    useDatePage()  / useSyncPage()
  useRemoteDayLogs()                 (single caller, hides nothing,
  useRoundedDurations()               makes useAsyncData / useRoute /
  useSyncExport()                     lifecycle awkward to reason about)
```

The codebase already votes capability-first (`useTimer`, `useRemoteActivities`, `useRemoteSyncClient`, `useActiveRemoteConfigs`, `useUserSettings`). A `usePage` composable with one caller buys no reuse and hurts lifecycle clarity.

### Proposed composable boundaries

| Composable | Owns | Exposes (indicative) |
| --- | --- | --- |
| `useRemoteActivities` (reuse/extend existing) | per-scope activity cache, in-flight, error | `ensureLoaded(scope)`, `retry(scope)`, `activitiesFor(scope)`, `stateFor(scope)` |
| `useRemoteDayLogs` | per-config remote-log cache, filtering by day, in-flight, error | `ensureLoaded(configKey)`, `retry`, `logsFor`, `stateFor` |
| `useRoundedDurations` | rounding override map + raw input text, commit/revert | `overrideFor`, `setOverride`, `commit`, `revert`, `effectiveDuration` |
| `useSyncExport` | export batch orchestration + per-task outcomes | `runExport(selection)`, `outcomes`, `isRunning` |

Exact names/signatures are finalized during implementation; each must be a cohesive concern with its own tests.

### Behavior preservation is the hard constraint
This is a pure relocation. The `remote-sync-review` requirements (REQ-111…REQ-121) — per-row state derivation, rounded-duration commit/revert (REQ-113), same-day remote-log context (REQ-118), export outcomes without strict idempotency (REQ-120) — MUST hold unchanged. The existing e2e/nuxt tests for the Remote Sync page are the regression guard and MUST stay green **without modification**.

## Approach
1. Extract one composable at a time, moving logic verbatim, keeping the page green after each step.
2. Add composable-boundary unit/nuxt tests as each is extracted (REQ-177).
3. Only after all four are extracted, tidy the page down to fetch + wire + template.

## Non-goals / risks
- **Not** touching `index.vue` structure.
- **Not** changing API/DB/i18n or the page's rendered markup (style migration is the separate `finish-nuxt-ui-style-migration` change; sequence that first to avoid template churn here).
- Risk: shared reactive state leaking across scope/config keys during extraction — mitigated by moving the existing keying logic verbatim and asserting it in composable tests.
