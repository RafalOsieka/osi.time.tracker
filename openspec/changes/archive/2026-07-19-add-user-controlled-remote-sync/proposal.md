## Why

The delivered day review cannot yet export time, and the planned lock cascade would make local
entries unnecessarily difficult to correct. Story 11b should instead make remote synchronization a
user-controlled export with enough remote and local provenance context to make repeat pushes an
informed decision.

## What Changes

- Let users select individual local entries per task, with eligible entries selected by default, and
  push one aggregate OpenProject time log for the selected entries.
- Load same-day work logs for the current OpenProject account and linked issue as informational
  context; do not infer local-entry matches from arbitrary remote logs.
- Persist successful export provenance, including the remote log ID and selected local entry IDs,
  without locking entries or tasks.
- Warn when selected entries are known to have been exported before, while allowing the user to
  export them again.
- Treat a successful empty activity response as a read-only no-activity state with a stated reason;
  keep activity-request failures distinct and retryable.
- Show per-task export outcomes and preserve user-reviewed duration and required-field behavior.
- Keep the browser as the two-phase export orchestrator while supporting equivalent OpenProject
  requests either directly from the browser or through an authenticated Nitro proxy.
- Reconcile `docs/vision.md`, `docs/user-stories.md`, and `docs/wbs.md` with the user-controlled
  export model wherever they still prescribe locking, permanent pushed states, or stronger
  idempotency than the browser-orchestrated flow can guarantee.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `remote-sync-review`: Extend the day review into entry-selectable export, remote-log context,
  provenance and repeat-export warnings, explicit no-activity handling, and per-task results.

## Impact

The change affects the Remote Sync UI and shared contracts, OpenProject client adapter and Nitro
proxy, sync APIs, database schema and migrations, validation, i18n, accessibility behavior, and
unit/Nuxt/E2E tests. It also updates product documentation whose current locking model is
superseded.

## Non-goals

- Locking or otherwise making local entries and tasks immutable after export.
- Automatically matching arbitrary remote logs to local entries or preventing intentional repeats.
- Displaying other users' remote logs or validating combined local/remote daily totals.
- Eliminating the narrow browser-orchestrated failure window between remote creation and local
  finalization.
- Adding Redmine or server-orchestrated export.