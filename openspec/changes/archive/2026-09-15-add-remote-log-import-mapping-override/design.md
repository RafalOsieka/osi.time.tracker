## Context

See proposal.md - Why. The relevant existing code:

- `apps/web/app/utils/remote/route-logs-by-scope.ts` — pure function, buckets fetched logs into `matched: {projectId, logs}[]` (by **local** Project, already merged) and `unmatched: {remoteProjectId, remoteProjectTitle, logs}[]` (by **remote** project). Matched buckets lose per-remote-project granularity.
- `apps/web/app/composables/use-remote-log-import.ts` — phase state machine (`range → scanning → preview → importing → done/error`). `startScan` calls `routeLogsByScope` per month, immediately dry-runs each month's matched groups, and accumulates `routedByMonth: RouteLogsByScopeGroup[][]` (already keyed by local Project) that `startImport` replays verbatim.
- `apps/web/app/components/TrackerImportDialog.vue` — renders each phase; preview table is driven by `preview.matched`/`preview.unmatched`.
- Server endpoint (`POST /api/trackers/[id]/import`, REQ-339) is untouched by this change — it already accepts arbitrary `{projectId, logs}[]` groupings and its skip check (REQ-338) is keyed by `(user, tracker, remoteLogId)`, independent of `projectId`.

## Goals / Non-Goals

**Goals:**
- Let the user assign/override the target Project per remote project before any write, with no server round-trip while adjusting.
- Keep the per-month transactional import (REQ-337/REQ-339) and its retry semantics unchanged.
- Keep the wire contract with the import endpoint unchanged.

**Non-Goals:**
- Inline Project creation or editing from the dialog.
- Persisting mapping choices across a re-scan or across dialog sessions.
- Changing how the dry-run/write endpoint computes `wouldImport`/`skippedExisting`.

## Decisions

### Bucket by remote project throughout scan and mapping, not by local Project

`routeLogsByScope` changes its `matched` shape from `{projectId, logs}[]` to the same shape `unmatched` already uses: `{remoteProjectId, remoteProjectTitle, logs, defaultProjectId}[]` (one bucket per remote project id encountered, `null` id for logs with no remote project id, `defaultProjectId` set from the scope walk or `null`). This removes the artificial matched/unmatched split at the routing layer — a bucket either has a default target or it doesn't, and the mapping phase treats every row the same way.

Alternative considered: keep `routeLogsByScope` as-is (bucketed by local Project) and have the mapping phase work off `unmatched` plus a reverse-lookup from matched groups back to remote project titles (already partially done today via `mergeRemoteProjectTitles` for display). Rejected: it only supports overriding *away from* an existing match, not disambiguating which of several remote projects feeding one local Project should move — the UI needs one row per remote project regardless of how the scope walk grouped them.

### Scan no longer dry-runs; the composable holds raw per-month, per-remote-project logs

`startScan` keeps fetching + routing per month but drops the `importLogs({ dryRun: true, ... })` loop. It accumulates `logsByMonth: RemoteTimeLogDto[][]` tagged with remote project id (or reuses the routed buckets directly, merged across months for the mapping totals) instead of `routedByMonth`. A new `mappingRows` computed/state aggregates raw counts per remote project id across all months, each with `defaultProjectId` and a mutable `selectedProjectId` (`ref<Map<string, string | null>>`, keyed by remote project id, `''` for the "no remote project id" bucket).

Advancing mapping → preview does the regroup-and-dry-run step: for each month, re-bucket that month's logs by `selectedProjectId.get(remoteProjectId)`, drop buckets whose selection is `null`, merge same-target buckets, run the existing dry-run loop (`splitGroupsIntoRequestBatches` + `importLogs({ dryRun: true })`) against these final groups, and store the result as today's `routedByMonth: RouteLogsByScopeGroup[][]` for `startImport` to replay unchanged.

Alternative considered: keep dry-running per remote-project bucket during scan (lazily, on first selection) as explored in conversation before settling on "defer everything." Rejected per explicit user direction — one dry-run pass at mapping→preview is simpler to reason about and matches "select projects, then preview, then import."

### Selection state lives in the composable, keyed by remote project id

`selectedProjectId: Ref<Map<string, string | null>>`, initialized from `defaultProjectId` per row when mapping is entered (i.e., right after scan completes). The dialog binds each row's `USelect`/native select to a setter that mutates this map — no watcher-driven side effects, no network call.

### Navigation

`phase` gains `'mapping'` between `'scanning'` and `'preview'`. `backToMapping()` (from preview) just sets `phase = 'mapping'`; the selection map and raw per-month logs are untouched, so re-advancing re-runs only the dry-run step. `backToRange()` (from mapping) calls the existing `reset()` (clears selection map, raw logs, everything) — identical to today's preview→range back button.

## Risks / Trade-offs

- [More dialog states to test] → the existing phase-based Vitest/Playwright suites already parametrize by phase; add `mapping` alongside them rather than restructuring the test harness.
- [Users could merge unrelated remote projects into one Project by mistake, silently] → out of scope to prevent (this is the explicit "override" feature); no confirmation step is proposed beyond the existing preview totals, matching REQ-340's existing "review before write" pattern.
- [Regrouping logic (per-month re-bucket by current selection) is new code, not a small diff on the existing `routeLogsByScope`] → mitigated by keeping it a pure function (`groupLogsBySelection(logsByRemoteProject, selection): RouteLogsByScopeGroup[]`) unit-testable independent of the composable's async flow.

## Migration Plan

Purely additive client-side change behind the same dialog entry point; no data migration, no endpoint version bump. Ships as a normal PR; no feature flag needed since the dialog is opt-in per tracker action.
