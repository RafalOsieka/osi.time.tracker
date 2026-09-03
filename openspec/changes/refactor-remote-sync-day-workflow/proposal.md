## Why

The Remote Sync day page still treats every task as a review-and-maybe-resend unit: include checkboxes, per-entry picking, a State column, and a detail pane that is a second editor. After the header refactor, that workflow is the remaining friction. Consultants export at end of day; the page should send what has never been sent and otherwise stay compact and readable.

## What Changes

- **BREAKING** for the day-export workflow: Export always sends ready, never-exported tasks. Any finalized provenance for that task/day makes the row Sent; later local time stays local until a future undo (not this change). No include checkbox, no per-entry selection, no re-export confirmation path.
- Ready rows edit in place: title-to-send (export comment), activity, and to-send duration. Tracked, to-send, and delta stay on the collapsed row. Only ready rows expose those editors.
- Drop the State column. A compact badge (plus tooltip/accessible text) distinguishes Ready / Sent / not-exportable. Unlinked rows keep the link control.
- Replace `UTable` with the timer’s two-line compact grid. Extract a shared expandable-row shell (and shared ghost inline-edit) and switch the timer group header onto it in this change.
- Details are extra info only: local entries (read-only) beside same-day current-account remote logs; stacked on small viewports. No rounding chips, no comment field, no entry checkboxes.
- Reserve an empty actions slot on every row for a later undo; no undo, delete-remote, or bulk-remove in this change.

## Non-goals

- Deleting remote logs or purging local provenance (next change).
- Adapter DELETE / new sync endpoints.
- Re-exporting leftover time on a Sent row, bulk skip, or restoring per-entry selection.
- Phone/PWA layout (WBS 8.1). Changing the export dialog beyond dropping skip-because-unchecked / repeat-because-reselected copy.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `remote-sync-review`: never-exported-only export; row kinds; compact grid; in-place editors; two-column details; reserved actions slot; drop include/entry/state/rounding-chip requirements.
- `shared-ui-components`: shared compact expandable-row shell and ghost inline-edit used by timer and Remote Sync.
- `time-tracking`: timer group header uses that shared shell (REQ-265 layout unchanged in spirit).

## Impact

- Frontend: `app/pages/sync/[date].vue`, `SyncRowDetail.vue`, new row/shell/inline-edit components; `TimerTaskGroup.vue` (and possibly `TimerEntryRow.vue` for inline-edit only).
- i18n `en`/`pl`: badges, retired include/state/entry-selection copy, details headings.
- Tests: nuxt + UI e2e for Remote Sync; nuxt timer group density; unit tests for the shell/inline-edit if they hold logic.
- No database, adapter, or API contract changes: finalize still receives all of the task’s day entry ids for a never-exported ready row.
