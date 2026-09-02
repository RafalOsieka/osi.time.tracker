## Why

The Remote Sync day page gives navigation, bulk selection, and export equal visual weight, making
the primary review-and-export flow harder to scan than other period-based pages. Aligning its outer
header with the monthly report will simplify the page while preserving the delivered export workflow.

## What Changes

- Present a stable Remote Sync page title on the left and a compact day switcher on the right.
- Use previous/next controls and a short localized date label that opens the existing date picker.
- Place Export after the day switcher as the page's single primary action.
- Remove the separate Today and Pick date header buttons.
- Remove day-level Include all exportable tasks and Exclude all exportable tasks actions; per-task
  and per-entry selection remains available.
- Preserve summaries, table behavior, export calculations, dialog flow, and remote synchronization.

## Non-goals

- Refactoring table rows, detail regions, summaries, or export orchestration.
- Changing APIs, persistence, eligibility rules, rounding, or default selections.
- Redesigning the monthly report or introducing shared period-navigation infrastructure.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `remote-sync-review`: Revise day navigation and accessibility requirements, and remove day-level
  bulk task selection while retaining selection within each task.

## Impact

- Frontend: `app/pages/sync/[date].vue` and `app/components/sync/SyncDayHeader.vue`.
- i18n: remove obsolete bulk/header action messages where no longer referenced, preserving `en` and
  `pl` parity.
- Tests: update focused Nuxt and UI E2E coverage for the new header and removed controls.
- No backend, API, database, dependency, or deployment changes.