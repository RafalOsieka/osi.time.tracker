## Why

The Remote Sync export dialog repeats controls and outcome details already represented by the improved
day review, while speculative duplicate warnings expose internal uncertainty without giving users a
clear correction workflow. Remote-entry deletion and linking provide simpler, explicit ways to reconcile
OSI provenance with the tracker.

## What Changes

- Replace the detailed export workflow dialog with a compact confirmation listing each task title and
  duration plus the batch total.
- Close the dialog after execution, refresh the Remote Sync review, and summarize the batch with a
  success toast when all exports finalize or a warning toast otherwise.
- Remove the "possible remote duplicate" inference and uncertain-export recovery UI; failed items remain
  normally exportable.
- Show fetched remote entries as explicitly linked or unlinked in task details.
- Allow a linked remote entry to be deleted remotely, then automatically remove its local provenance so
  its covered local time becomes exportable again. Treat remote not-found as successful cleanup, but
  retain provenance after ambiguous failures.
- Allow an eligible unlinked remote entry to be linked to a matching local task/day without mutating the
  tracker, recording the remote entry's actual values as provenance.
- Scope remote-entry identity to its tracker and update reports when provenance is added or removed.

## Capabilities

### New Capabilities

- `remote-entry-reconciliation`: User-visible discovery, identity, linking, and deletion rules for remote
  time entries and local export provenance.

### Modified Capabilities

- `remote-sync-review`: Simplify export confirmation and post-export outcomes, remove speculative
  duplicate messaging, and expose reconciliation actions in task details.
- `remote-adapter-contract`: Add provider-neutral time-entry deletion with consistent not-found and
  ambiguous-failure semantics across client and extension execution.
- `reports`: Classify live remote time as App or Direct according to provenance after links and deletions.

## Impact

The change affects the Remote Sync page, export composable and dialogs, shared boundary types, sync APIs,
Drizzle provenance schema and migrations, monthly report aggregation, adapter contracts and provider
implementations for OpenProject and Redmine, extension execution protocol, i18n catalogs, and focused
unit/Nuxt/e2e coverage.

## Non-goals

- No tombstone or retained local audit record after confirmed remote deletion.
- No local-only provenance deletion, bulk reconciliation, remote-entry editing, or automatic matching.
- No live background synchronization or dedicated reconciliation page.