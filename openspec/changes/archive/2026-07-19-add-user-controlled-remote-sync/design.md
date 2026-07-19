## Context

The current server aggregate returns one row per task/day, while the browser fetches project-scoped
OpenProject activities and stores reviewed values only in page state. Story 11b must add remote
writes and reads while retaining browser orchestration and supporting both direct and Nitro-proxied
client transport. Earlier roadmap text assumes one permanent push per task/day and a local lock
cascade; the agreed model instead treats each push as an explicit export of selected entries.

## Goals / Non-Goals

**Goals:**

- Let users choose the local entries included in each task export and default eligible entries to
  selected.
- Show current-account, same-issue, same-day OpenProject logs as context.
- Persist successful-export provenance without changing local entry mutability.
- Distinguish activity loading, empty, and failure states and report per-task export outcomes.
- Provide behaviorally equivalent direct and Nitro-proxied OpenProject transport.

**Non-Goals:**

- Transactional consistency across PostgreSQL and OpenProject.
- Automatic matching of remote logs that were not finalized locally.
- Locking local data, preventing intentional repeats, supporting Redmine, or server orchestration.

## Decisions

### Export is a browser-orchestrated two-phase operation

The browser SHALL validate current page state, create one OpenProject log per pushable task, and then
finalize each success through an authenticated local endpoint. Finalization SHALL re-authorize the
task and selected entries, validate that they belong to the requested local day and task, and persist
the exact payload plus returned remote ID atomically. Remote creation and supporting reads MAY be
sent directly to OpenProject or proxied through Nitro; choosing the proxy SHALL NOT transfer batch
orchestration, outcome handling, or finalization control away from the browser.

Alternative considered: server-orchestrated export. This would couple remote execution to Nitro and
change the client-mode failure and reachability model.

### Direct and proxied transports have equivalent behavior

The OpenProject client adapter SHALL expose one operation contract for account resolution,
activities, paginated time-log context, and time-entry creation. A transport selected from the
remote configuration SHALL execute those operations either directly in the browser or through
authenticated Nitro proxy endpoints. Proxy requests SHALL be user-authorized, restrict destinations
to the user's configured OpenProject origin, forward credentials only for the current request, and
never persist or log credentials. Both paths SHALL preserve response parsing, pagination, error
classification, retry behavior, request deduplication, and per-task isolation.

Alternative considered: treating the proxy as a second integration implementation. That would make
the two modes drift and produce mode-specific review and export behavior.

### Provenance is append-only and non-locking

Store one export record per successful remote log and a junction row for every selected entry. The
record includes user, task, local date, remote issue/log identifiers, exact exported duration,
required-field values, and timestamps. There is no task/day uniqueness constraint because later and
intentional repeat exports are valid. Day-review data identifies entries with prior provenance so the
browser can warn, but all completed entries remain selectable and editable.

Alternative considered: a pushed flag or uniqueness constraint on entry/task-day. Both incorrectly
turn provenance into policy and prevent intentional re-export.

### Entry selection owns the export aggregate

The day endpoint SHALL include completed entry identity, timestamps, and duration under each task.
Eligible entries are selected by default. The reviewed duration defaults to applying the configured
rounding rule once to the selected sum; selection changes recompute that default unless the user has
explicitly overridden it. No selection or a reviewed duration of zero excludes the task.

Alternative considered: keep task-level selection only. This cannot express the user's decision when
only some entries should be exported.

### Remote logs are context, not deduplication evidence

Using the selected client transport, the page resolves the current OpenProject account and fetches
that account's time entries for the selected date and linked work packages. Results are deduplicated
by request scope and displayed beside each task. They do not alter selection or block export.

Alternative considered: infer duplicates by duration/date/issue. Such matching is ambiguous and
could hide legitimate work or associate the wrong local entries.

### Activity outcomes remain distinct

A successful non-empty response enables selection of an activity. A successful empty response moves
affected task rows to a read-only `no_activity` state with a stated reason that no activity is
available and no remote log will be created. Transport/authentication failures remain accessible,
retryable errors and are never converted to `no_activity`.

### Repeat-export warnings are confirmation, not prevention

If any selected entry has local provenance, the page SHALL identify the affected task and require an
explicit confirmation before starting the batch. Remote-only logs remain visible context but do not
trigger this provenance warning.

## Risks / Trade-offs

- [Remote creation succeeds but local finalization fails] → Show the task as uncertain/failed,
  refresh remote logs, and explain that retry can duplicate the log; do not claim strict idempotency.
- [Local entries change after page load] → Revalidate ownership, task, date, and completed state during
  finalization and reject stale selections with a translated validation error.
- [Many tasks trigger many browser requests] → Deduplicate account, activity-scope, and remote-log
  requests and keep failures isolated per affected task.
- [The proxy becomes an SSRF or credential-leak path] → Require a local session, derive and validate
  the destination against the user's configuration, redact sensitive headers, and avoid persistence.
- [Direct and proxy behavior drifts] → Reuse transport-agnostic builders/parsers and run contract
  tests against both transports.
- [User override becomes stale after selection changes] → Clearly retain the override and selected
  total, or provide an explicit reset-to-rounded-total action; never silently change an override.
- [Remote APIs return partial/paginated results] → Follow OpenProject pagination before presenting
  the contextual list.

## Migration Plan

1. Add export and export-entry tables with user-scoped foreign keys and indexes; existing data needs
   no backfill because pushing has not shipped.
2. Deploy expanded day contracts, finalization and proxy APIs, adapter operations, and UI together.
3. Update vision, user-story, and WBS text in the same change so locking and absolute idempotency are
   no longer presented as MVP behavior.
4. Rollback may remove the new UI/API while retaining provenance tables; dropping them requires an
   explicit reverse migration because successful export history is user data.

## Open Questions

None.