## Why

Users adopting OSI after years of logging time directly in Redmine/OpenProject have no local history: the monthly report shows those years as Direct hours only and the Timer view starts at the first OSI day. The tracker already holds every log (REQ-296) and REQ-305 already turns one remote log into local provenance; import is that in bulk, so historical reporting (WBS 4.x) has real data.

## What Changes

- A tracker-level **Import history** action (Trackers page) fetches the current account's remote logs for a chosen date range, routes each log to a local Project by the Project's remote project scope (REQ-325, subtree semantics of REQ-319), previews the result grouped by remote project, and imports it month by month; a failed run is retried by re-running the same range.
- Each imported log becomes a **Task** named after the log's comment (`"empty"` when blank), a stopped **time entry** with synthesized non-overlapping instants on the log's `spentOn` day, and **export provenance** (`remote_exports` + `remote_export_entries`) — exactly what REQ-305 linking produces.
- Import is **idempotent** by tracker-scoped remote-log identity (REQ-304): logs already exported or imported are skipped; a re-run after scoping a new Project picks up only the previously unmatched logs.
- Logs whose remote project matches no scoped Project are **reported and skipped**, never imported.
- `RemoteTimeLogDto` gains optional `remoteProjectId` / `remoteProjectTitle` / `remoteIssueTitle`, filled by both adapters from fields already in the payload; no new adapter operation.

## Capabilities

### New Capabilities

- `remote-log-import`: tracker-level import of historical remote logs — routing by scope, preview, idempotent batch persistence, synthesized entry placement, and the import dialog.

### Modified Capabilities

- `remote-adapter-contract`: optional project/issue-title fields on time-log fetches.
- `openproject-adapter`: map `_links.project` and `_links.entity.title` on time logs.
- `redmine-adapter`: map `project.id` / `project.name` on time logs.
- `remote-entry-reconciliation`: import-created provenance behaves like exported provenance.
- `tracker-management`: Trackers page exposes the import action.

## Non-goals

- Background/scheduled import; re-import of remotely changed logs; moving imported entries when a scope changes.
- Catch-all routing into unscoped Projects; auto-creating Projects from the catalog.
- Redmine project-level logs without an issue (already dropped by the adapter); local (tracker-less) Projects.
- Fetching issue titles for naming; preserving the comment beyond the task name.

## Impact

- New `POST /api/trackers/[id]/import` + `shared/types/remote-log-import.ts`; reuses `resolveTaskId`, `computeDayBoundary`, `remote_exports` uniqueness. No migration.
- `packages/remote-trackers` DTO + parsers; `packages/extension-protocol` `remoteTimeLogSchema` (optional fields only).
- `pages/trackers.vue`, new `TrackerImportDialog.vue` + `use-remote-log-import.ts`.
- i18n `en`/`pl`; unit, nuxt, e2e-api, e2e-ui tests.
