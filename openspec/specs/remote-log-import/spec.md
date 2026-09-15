# remote-log-import Specification

## Purpose

Define how a user backfills local history from a tracker: fetching the current account's remote time logs for a date range, routing each log to a local Project by remote project scope, previewing, and persisting each log as a task, a stopped time entry, and export provenance — idempotently and without writing to the tracker.

## Requirements

### Requirement: REQ-334 Tracker-level import routes logs by Project scope
The system SHALL let an authenticated user import the current account's remote time logs from one active tracker for an inclusive local-date range. The browser SHALL fetch the tracker's remote project catalog (REQ-318) and the range logs (REQ-296) using the browser-held secret under the tracker's execution path; the secret SHALL NOT be sent to an OSI API. Each fetched log SHALL be assigned a default target Project equal to the user's non-deleted Project bound to that tracker whose remote project scope (REQ-325) equals the log's remote project id or the nearest ancestor of it in the catalog, walking parent links from the log's project upward; the first match SHALL win, so a scope on a descendant project takes precedence over a scope on its ancestor. A log whose walk reaches the root without a match, whose remote project id is absent from the catalog, or that carries no remote project id SHALL be classified as unmatched and given no default target. A Project without a scope SHALL never be a default target. This default assignment is only the mapping phase's starting selection (REQ-358): the user MAY override it, including for an unmatched remote project, before anything is imported. Unmatched logs SHALL be reported with their remote project title and count and SHALL NOT be imported unless the user assigns them a target Project.

#### Scenario: Log in a scoped descendant project
- **WHEN** a Project is scoped to remote project `R12` and a fetched log belongs to `R14`, a child of `R12`
- **THEN** the log's default target SHALL be that Project

#### Scenario: Nested scopes resolve to the most specific Project
- **WHEN** one Project is scoped to `R12` and another to its child `R13`, and a log belongs to `R13`
- **THEN** the log's default target SHALL be the Project scoped to `R13`

#### Scenario: Log outside every scope is unmatched
- **WHEN** a fetched log belongs to a remote project none of whose ancestors is a Project scope
- **THEN** the log SHALL have no default target, SHALL be reported as unmatched under its remote project title in the mapping phase, and SHALL NOT be imported unless the user assigns it a target Project there

#### Scenario: Unscoped Project receives nothing
- **WHEN** the tracker has a bound Project without a scope and a log matches no scoped Project
- **THEN** the log SHALL remain unmatched rather than defaulting to the unscoped Project, though the user MAY still assign it there explicitly (REQ-358)

#### Scenario: Log without a remote project id
- **WHEN** a fetched log carries no remote project id (for example from an older extension build)
- **THEN** it SHALL be reported as unmatched, grouped with any other such logs, and the import SHALL surface a translated hint that default project routing is unavailable for them

#### Scenario: Catalog or range fetch fails
- **WHEN** the catalog or a month's range fetch raises the shared translated error
- **THEN** the import SHALL stop at that month, show the translated error, and SHALL NOT persist a partial month

### Requirement: REQ-335 An imported log becomes a task, a stopped entry, and provenance
For every routed log the system SHALL, within one transaction per request, resolve or create a linked Task in the routed Project keyed by `(user, Project, task name, remote issue id)` with the tracker as provenance, the provider-supplied issue title as cached issue title when present (otherwise the remote issue id), and the log's remote project title as cached remote project title when present; create one stopped time entry bound to that Task on the log's `spentOn` local day; and persist export provenance for the tracker, Task, local date, remote issue id, remote log id, the log's duration as the exact export duration, and the log's activity id as the activity required-field value when present, together with the covered-entry association for the new entry. The import SHALL NOT create, update, or delete anything on the tracker.

#### Scenario: New task and entry are created
- **WHEN** a routed log references an issue and comment for which no Task exists in the routed Project
- **THEN** a linked Task, one stopped entry of the log's duration on the log's date, and one provenance record with its covered-entry association SHALL be created atomically

#### Scenario: Existing task is reused across days
- **WHEN** two routed logs on different days share the same remote issue and the same comment
- **THEN** both entries SHALL bind to the same Task and no duplicate Task SHALL be created

#### Scenario: Different comments on one issue are sibling tasks
- **WHEN** two routed logs share a remote issue but have different comments
- **THEN** two Tasks with the same remote issue reference and different names SHALL exist

#### Scenario: Provenance mirrors the remote log
- **WHEN** a log with duration 5400 seconds and activity `7` is imported
- **THEN** the provenance SHALL record `exportDurationSeconds` 5400 and the activity `7` as its required-field value, and the entry SHALL be reported as Linked in Remote Sync and as App hours in the monthly report

#### Scenario: Request fails mid-way
- **WHEN** persisting any log in a request fails
- **THEN** no task, entry, or provenance from that request SHALL remain

### Requirement: REQ-336 Task name is the remote log comment
The task name for an imported log SHALL be the log's comment, trimmed. When the comment is null, empty, or whitespace-only, the task name SHALL be the literal `empty`. The system SHALL NOT fetch the remote issue title to name the task.

#### Scenario: Comment becomes the task name
- **WHEN** a routed log's comment is `Fix invoice rounding`
- **THEN** the Task SHALL be named `Fix invoice rounding`

#### Scenario: Blank comment
- **WHEN** a routed log's comment is null or whitespace-only
- **THEN** the Task SHALL be named `empty` and no remote issue lookup SHALL be performed

### Requirement: REQ-337 Imported entries are placed after the day's last entry without overlap
For each `(user, local date)` in a request, the system SHALL compute the day's `[dayStart, dayEnd)` instants in the user's stored timezone (UTC when unset) and SHALL place that day's routed logs, ordered by numeric remote log id ascending, back to back starting from a cursor equal to the later of `dayStart + 08:00` and the latest `stoppedAt` among the user's stopped entries whose `startedAt` falls in that day. When placing the logs from that cursor would start the last one (by remote log id) on or after `dayEnd`, the cursor SHALL instead start at the later of `dayStart` and that latest `stoppedAt` — so a single entry, however long, keeps the `08:00` anchor and simply ends after midnight, while only a later entry that would otherwise start on the next local day forces the whole day back to `dayStart`. Each entry's `startedAt` SHALL be the cursor and its `stoppedAt` the cursor plus the log's duration; the cursor SHALL then advance. Running entries SHALL be ignored. Every placed `startedAt` SHALL fall inside `[dayStart, dayEnd)` whenever the day's total stopped and imported duration is at most 24 hours.

#### Scenario: Empty day starts at 08:00
- **WHEN** a day has no local entries and three logs of 2 h, 1.5 h and 0.5 h are imported
- **THEN** the entries SHALL occupy 08:00–10:00, 10:00–11:30 and 11:30–12:00 local time

#### Scenario: Second tracker continues after the first
- **WHEN** a day already holds imported entries ending at 12:00 local time and two logs of 3 h and 1 h from another tracker are imported
- **THEN** the new entries SHALL occupy 12:00–15:00 and 15:00–16:00 and SHALL NOT overlap the existing ones

#### Scenario: Day with real local entries
- **WHEN** a day has a stopped local entry 09:00–10:30 and a 2 h log is imported
- **THEN** the imported entry SHALL occupy 10:30–12:30

#### Scenario: Spill past midnight keeps the day
- **WHEN** a day's imported logs total 17 h and the day is otherwise empty
- **THEN** every entry SHALL start on that local day, the last one ending after midnight

#### Scenario: Anchor drops to midnight when needed
- **WHEN** a day is otherwise empty and two imported logs of 19 h and 1 h are placed by remote log id in that order, so the second would start on the following local day under the `08:00` anchor
- **THEN** placement SHALL start at `dayStart` instead, so both entries start on the requested local day

#### Scenario: DST day
- **WHEN** the local day is 23 hours long because of a DST transition
- **THEN** `dayEnd` SHALL be the next local midnight and placement SHALL respect it

### Requirement: REQ-338 Import is idempotent by tracker-scoped remote-log identity
Before persisting, the system SHALL skip every submitted log whose `(user, tracker, remote log id)` already has export provenance (REQ-304), and SHALL report skipped counts separately from imported counts. Re-running an import over the same range SHALL create nothing new for previously imported or exported logs. A log previously unmatched SHALL be imported on a later run once a Project scope covers it. A scope change after import SHALL NOT move or re-import existing entries.

#### Scenario: Re-run skips everything
- **WHEN** the user re-imports a range that was fully imported before
- **THEN** the result SHALL report zero imported and all logs skipped, and no task, entry or provenance SHALL be created

#### Scenario: App-exported logs are skipped
- **WHEN** the range includes a log that the app itself exported earlier
- **THEN** that log SHALL be skipped as existing

#### Scenario: Newly scoped Project picks up leftovers
- **WHEN** the user scopes a new Project to a remote project whose logs were previously unmatched and re-runs the import
- **THEN** only those logs SHALL be imported and every previously imported log SHALL be skipped

#### Scenario: Changed scope does not move entries
- **WHEN** a Project's scope is changed after its logs were imported and the import is re-run
- **THEN** the already-imported entries SHALL stay in their Project and SHALL be reported as skipped

### Requirement: REQ-339 Import endpoint validation and dry run
The system SHALL expose `POST /api/trackers/[id]/import` following `api-endpoint-conventions`. The body SHALL be validated by a shared boundary schema: `dryRun` boolean; a non-empty `groups` array of `{ projectId, logs }` where each log has `remoteLogId`, `remoteIssueId`, `spentOn` (ISO date), `durationSeconds` (positive integer), nullable `activityId`, nullable `comment`, and optional `remoteIssueTitle` / `remoteProjectTitle`; at most 500 logs per request; remote log ids unique within the request. The tracker SHALL be resolved from the route for the authenticated user (unknown, foreign, or soft-deleted → HTTP 404). Every `projectId` SHALL identify the user's non-deleted Project bound to that tracker; otherwise the request SHALL be rejected with a `422` `{ messageKey, params }` and nothing persisted. When `dryRun` is true the endpoint SHALL perform validation and the existing-identity check and SHALL return per-Project `wouldImport` and `skippedExisting` counts without persisting. When false it SHALL persist per REQ-335/337/338 and return per-Project `imported` and `skippedExisting` counts plus totals.

#### Scenario: Dry run reports counts only
- **WHEN** a valid request with `dryRun: true` includes two new logs and one already-linked log
- **THEN** the response SHALL report `wouldImport` 2 and `skippedExisting` 1 and no row SHALL be written

#### Scenario: Write run persists and counts
- **WHEN** the same request is sent with `dryRun: false`
- **THEN** two logs SHALL be persisted, the response SHALL report `imported` 2 and `skippedExisting` 1

#### Scenario: Project not bound to the tracker
- **WHEN** a group's `projectId` belongs to the user but is bound to a different tracker, is local, or is soft-deleted
- **THEN** the endpoint SHALL respond 422 with a translated `messageKey` and persist nothing

#### Scenario: Foreign or deleted tracker
- **WHEN** the route id is unknown, foreign, or soft-deleted
- **THEN** the endpoint SHALL respond 404 without revealing existence

#### Scenario: Invalid body
- **WHEN** `groups` is empty, a log has a non-positive duration or malformed date, the request exceeds 500 logs, or a remote log id repeats
- **THEN** the endpoint SHALL respond 422 with `{ messageKey, params }` and persist nothing

#### Scenario: Missing authentication or CSRF
- **WHEN** the request lacks a valid session or CSRF token
- **THEN** it SHALL be rejected per shared conventions and persist nothing

### Requirement: REQ-340 Import dialog on the Trackers page
The Trackers page SHALL offer an "Import history" action per tracker that opens a dialog with these phases: a range phase with one labelled inclusive date-range field (the shared segmented date-range field with calendar affordance, REQ-359 in shared-ui-components) defaulting to five years before today through today, rejecting an inverted or incomplete range inline, and a list of the tracker's non-deleted Projects with their remote project scope, marking unscoped Projects as not receiving a default target (this list SHALL NOT call the tracker); a scanning phase that walks the range month by month, fetching logs and computing each log's default target Project by scope (REQ-334), with an accessible progress indicator and a cancel action, and SHALL NOT call the dry-run endpoint; a mapping phase (REQ-358) listing one row per remote project encountered across the whole range with its raw log count and an editable target-Project control, defaulting to the scope-based suggestion or to "do not import" when there is none; a preview phase, generated from the mapping phase's current selections, listing each target Project the user assigned with the count to import and the count already linked, plus totals, and excluding every remote project left unassigned; an importing phase with per-month progress and no cancel action, because each month commits atomically and a re-run resumes by skipping; and a done phase with totals, a reminder of unassigned counts, and a note that entry times are synthetic while durations are exact. Every log assigned a target Project in the mapping phase SHALL be sent for import; the endpoint's existing-identity skip (REQ-338) makes resubmitting an already-linked log a no-op, and this is also how the done phase's already-linked count is produced without the client tracking it separately. The preview phase's "back" action SHALL return to the mapping phase without discarding the scan; the mapping phase's "back" action SHALL return to the range phase and discard the scan. Advancing from the mapping phase to the preview phase SHALL (re-)run the dry run against the current selections. A month that fails during scanning or importing SHALL stop the run, show the translated error, state the months already committed, and offer a retry that re-runs the same range. The action SHALL be disabled with a translated hint when no secret is stored in the browser for the tracker. The dialog SHALL meet WCAG 2.1 AA (labelled fields, keyboard operable, progress and results announced) and all strings SHALL exist in `en` and `pl` in parity.

#### Scenario: Unscoped project flagged before scanning
- **WHEN** the range phase opens for a tracker with a bound Project that has no scope
- **THEN** the project list SHALL show that Project marked as not receiving a default target, without any remote request

#### Scenario: Range phase opens with the default range filled
- **WHEN** the range phase opens
- **THEN** the date-range field SHALL show a start of five years before today and an end of today, both ends complete, under a single translated label

#### Scenario: Cancel only while scanning
- **WHEN** the dialog is scanning
- **THEN** a cancel action SHALL abort the scan and return to the range phase; while importing, no cancel action SHALL be offered

#### Scenario: Retry resumes after a failed month
- **WHEN** a month fails during import and the user activates retry
- **THEN** the dialog SHALL re-run the same range, report the previously committed months as skipped, and continue from the failed month

#### Scenario: Preview before writing
- **WHEN** the user submits a range
- **THEN** the dialog SHALL scan month by month without a dry run, show the mapping phase for the user to confirm or adjust each remote project's target, and only then run the dry run and show the per-Project preview before any write

#### Scenario: Unmatched projects are visible
- **WHEN** the scan finds logs in a remote project without a scope-matched Project
- **THEN** the mapping phase SHALL list that remote project with no default target selected, and unless the user assigns one there, the preview phase SHALL exclude it from import

#### Scenario: Preview reflects the finalized mapping, not raw scope matches
- **WHEN** the user changes a mapping row's target away from its scope-matched default and advances to preview
- **THEN** the preview SHALL group that remote project's logs under the newly chosen Project, not the original scope match

#### Scenario: Nothing to import
- **WHEN** every remote project row is left at "do not import" in the mapping phase, or the scan found no logs
- **THEN** the import action SHALL be disabled and the preview SHALL say so

#### Scenario: Import completes
- **WHEN** the user confirms the preview
- **THEN** the dialog SHALL import month by month with progress and finish with totals of imported, skipped, and unassigned logs

#### Scenario: No secret in the browser
- **WHEN** the tracker has no stored secret
- **THEN** the action SHALL be disabled and its hint SHALL point to entering the secret in the tracker form

#### Scenario: Inverted range
- **WHEN** the range field's start is after its end
- **THEN** an inline error SHALL be shown and no fetch SHALL start

#### Scenario: Incomplete range
- **WHEN** either end of the range field is incomplete (a cleared segment)
- **THEN** the translated "range required" inline error SHALL be shown and no fetch SHALL start

#### Scenario: Range picked from the calendar
- **WHEN** the user opens the range field's calendar and picks a start day and then an end day
- **THEN** both ends of the field SHALL update, the calendar SHALL close after the end day, and submitting SHALL scan exactly that inclusive range

#### Scenario: Keyboard and announcements
- **WHEN** a keyboard user operates the dialog
- **THEN** every phase, including mapping, SHALL be reachable, the range field's segments and calendar SHALL be operable from the keyboard, and progress and results SHALL be announced via a live region

### Requirement: REQ-358 Mapping phase lets the user override the routed target Project
Before any dry run or write, the import dialog SHALL let the user assign or change the target Project for each remote project encountered during the scan, independent of the scope-based default (REQ-334). The mapping phase SHALL present one row per remote project id encountered across the scanned range, with logs carrying no remote project id grouped into a single row; each row SHALL show the remote project's title (or a translated fallback) and its total log count across the range, alongside a control listing every non-deleted Project bound to the tracker plus an explicit "do not import" choice. Each row SHALL default to its scope-based suggestion (REQ-334) when one exists and to "do not import" otherwise. Multiple rows MAY be assigned to the same target Project. Changing a row's target SHALL NOT trigger a network request. The user's selections at the moment the mapping phase is left, not the scope-based defaults, SHALL determine which logs are grouped into which Project for the preview's dry run and for the import write.

#### Scenario: Default selection matches scope routing
- **WHEN** the mapping phase opens and a remote project has a scope-matched Project
- **THEN** that remote project's row SHALL default to the matched Project

#### Scenario: Unmatched remote project defaults to no selection
- **WHEN** a remote project has no scope-matched Project
- **THEN** that remote project's row SHALL default to "do not import"

#### Scenario: User redirects a matched remote project
- **WHEN** the user changes a row's target away from its scope-matched Project to a different Project
- **THEN** the chosen Project SHALL receive that remote project's logs instead, and no network request SHALL be triggered by the change

#### Scenario: User assigns a previously unmatched remote project
- **WHEN** the user selects a target Project for a row that defaulted to "do not import"
- **THEN** that remote project's logs SHALL be included in the next preview and import

#### Scenario: Two remote projects merged into one Project
- **WHEN** the user assigns the same target Project to two different remote project rows
- **THEN** the preview phase SHALL report one combined row for that Project covering both remote projects' logs

#### Scenario: Row left unassigned is excluded
- **WHEN** a row is left at "do not import" through the mapping phase
- **THEN** its logs SHALL NOT appear in the preview or be sent for import, and its count SHALL be reflected in the done phase's unassigned total

#### Scenario: Logs without a remote project id form one row
- **WHEN** the scan finds logs missing a remote project id
- **THEN** the mapping phase SHALL group them into a single row with no default target, overridable like any other row
