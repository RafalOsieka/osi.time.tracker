## Why

Tracker import (WBS 5.18) routes logs to a Project purely by remote-project scope, and that routing is final: a remote project with no matching scope — or the wrong one — can't be redirected without leaving the dialog to create or rescope a Project first, then re-scanning. Users need to pick the destination Project for any remote project before committing, without changing scopes.

## What Changes

- Add a **mapping** phase between scan and preview in the tracker import dialog: one row per remote project encountered in the scanned range (matched and unmatched unified, no more separate sections), each with an editable target-Project dropdown pre-filled with the scope-based suggestion (empty when unmatched), offering the tracker's non-deleted Projects plus a "don't import" option.
- Scan drops its dry-run calls entirely — it only fetches and routes logs client-side, keeping raw per-remote-project counts for the mapping phase (faster scan, fewer requests).
- Preview is generated from the finalized mapping: buckets are regrouped by chosen target Project (merging remote projects mapped to the same Project), then a single dry-run pass computes new/already-linked counts, shown per local Project as today.
- Navigation: preview's back button returns to mapping (re-runs the dry-run pass on re-entry, no re-scan); mapping's back button returns to range (discards the scan, matching today's behavior).
- The ancestor-scope walk becomes a default suggestion rather than a final decision; matched/unmatched is no longer a hard routing boundary, just the dropdown's starting value.
- No change to the import endpoint's contract (REQ-339): the client still submits `{projectId, logs}[]` groups, now built from the user's final mapping instead of the raw scope routing.

## Capabilities

### Modified Capabilities

- `remote-log-import`: REQ-334's scope-based routing becomes a client-side default suggestion, overridable before import; REQ-340's dialog gains a mapping phase, and the preview is generated from the finalized mapping instead of directly from scan routing.

## Non-goals

- No inline Project creation from the mapping dropdown — existing tracker-bound Projects only.
- No change to the import endpoint's validation, persistence, or idempotency behavior.
- Mapping selections do not persist across a re-scan (mapping → range discards them).

## Impact

- `apps/web/app/composables/use-remote-log-import.ts`: new mapping phase, per-remote-project selection state, deferred dry-run.
- `apps/web/app/components/TrackerImportDialog.vue`: new mapping UI (dropdowns), phase wiring, back-navigation.
- `apps/web/app/utils/remote/route-logs-by-scope.ts`: bucket matched logs by remote project (not local project) so mapping can address each one independently.
- `apps/web/i18n/locales/{en,pl}.json`: new strings for the mapping phase.
- Tests: `use-remote-log-import.spec.ts`, `tracker-import-dialog.spec.ts`, `tracker-import-ui.spec.ts` need coverage for the new phase and override behavior.
