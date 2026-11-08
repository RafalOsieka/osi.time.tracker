# remote-log-import Specification

## Purpose

Define how a user backfills local history from a tracker: fetching the current account's remote time logs for a date range, routing each log to a local Project by remote project scope, previewing, and persisting each log as a task, a stopped time entry, and export provenance — idempotently and without writing to the tracker.

## Requirements

### Requirement: REQ-334 Tracker-level import routes logs by Project scope
A user SHALL be able to import their own remote logs from one active tracker for an inclusive local-date range. The browser SHALL fetch the catalog (REQ-318) and range logs (REQ-296) with the browser-held secret, never sending it to OSI. A log's default target SHALL be the user's non-deleted Project on that tracker scoped (REQ-325) to the log's remote project or its nearest scoped ancestor, so a descendant's scope wins. It is only the mapping phase's starting choice (REQ-358).

#### Scenario: Log in a scoped descendant project
- **WHEN** a Project is scoped to remote project `R12` and a fetched log belongs to `R14`, a child of `R12`
- **THEN** the log's default target SHALL be that Project

#### Scenario: Nested scopes resolve to the most specific Project
- **WHEN** one Project is scoped to `R12` and another to its child `R13`, and a log belongs to `R13`
- **THEN** the log's default target SHALL be the Project scoped to `R13`

#### Scenario: Catalog or range fetch fails
- **WHEN** the catalog or a month's range fetch raises the shared translated error
- **THEN** the import SHALL stop at that month, show the translated error, and SHALL NOT persist a partial month

### Requirement: REQ-478 Unmatched logs
A log SHALL be unmatched, with no default target, when its walk reaches the root without a scope, its remote project id is not in the catalog, or it has no remote project id. A Project without a scope SHALL never be a default target. Unmatched logs SHALL be reported with their remote project title and count and SHALL NOT be imported unless the user assigns them a target in the mapping phase.

#### Scenario: Log outside every scope is unmatched
- **WHEN** a fetched log belongs to a remote project none of whose ancestors is a Project scope
- **THEN** the log SHALL have no default target, SHALL be reported as unmatched under its remote project title in the mapping phase, and SHALL NOT be imported unless the user assigns it a target Project there

#### Scenario: Unscoped Project receives nothing
- **WHEN** the tracker has a bound Project without a scope and a log matches no scoped Project
- **THEN** the log SHALL remain unmatched rather than defaulting to the unscoped Project, though the user MAY still assign it there explicitly (REQ-358)

#### Scenario: Log without a remote project id
- **WHEN** a fetched log carries no remote project id (for example from an older extension build)
- **THEN** it SHALL be reported as unmatched, grouped with any other such logs, and the import SHALL surface a translated hint that default project routing is unavailable for them

### Requirement: REQ-335 An imported log becomes a task, a stopped entry, and provenance
For each log, in one transaction per request, the system SHALL find or create a linked Task in its Project keyed by `(user, Project, task name, remote issue id)`, tracker as provenance, caching issue title (else id) and remote project title if present; create a stopped entry on the log's `spentOn` day; and record export provenance (tracker, Task, date, issue and log ids, exact duration, activity as required field when present) with its covered-entry link. Nothing SHALL be written to the tracker.

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
For each `(user, local date)`, with day bounds `[dayStart, dayEnd)` in the user's timezone, the system SHALL place that day's logs back to back in ascending numeric remote-log-id order, from a cursor at the later of `dayStart + 08:00` and the latest `stoppedAt` among the user's stopped entries starting that day (running entries ignored). Each entry starts at the cursor and lasts the log's duration, and the cursor advances.

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

#### Scenario: DST day
- **WHEN** the local day is 23 hours long because of a DST transition
- **THEN** `dayEnd` SHALL be the next local midnight and placement SHALL respect it

### Requirement: REQ-479 Placement falls back to the day start
When placing a day's logs from the cursor would start the last one (by remote log id) on or after `dayEnd`, the cursor SHALL instead start at the later of `dayStart` and the latest stopped entry's `stoppedAt`. A single long entry keeps the 08:00 start and simply ends after midnight. Every placed `startedAt` SHALL fall in `[dayStart, dayEnd)` whenever the day's stopped and imported time totals at most 24 hours.

#### Scenario: Anchor drops to midnight when needed
- **WHEN** a day is otherwise empty and two imported logs of 19 h and 1 h are placed by remote log id in that order, so the second would start on the following local day under the `08:00` anchor
- **THEN** placement SHALL start at `dayStart` instead, so both entries start on the requested local day

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
`POST /api/trackers/[id]/import` SHALL validate: `dryRun`; non-empty `groups` of `{ projectId, logs }`, each log with `remoteLogId`, `remoteIssueId`, `spentOn` (ISO date), positive integer `durationSeconds`, nullable `activityId` and `comment`, optional `remoteIssueTitle`/`remoteProjectTitle`; at most 500 logs with unique ids. An unknown, foreign or deleted tracker SHALL give 404; a `projectId` not the user's live Project on it, `422` `{ messageKey, params }`, persisting nothing.

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

### Requirement: REQ-480 Dry run and write responses
With `dryRun: true` the endpoint SHALL validate and check existing identities, returning per-Project `wouldImport` and `skippedExisting` counts without persisting. With `dryRun: false` it SHALL persist per REQ-335, REQ-337 and REQ-338 and return per-Project `imported` and `skippedExisting` counts plus totals.

#### Scenario: Dry run reports counts only
- **WHEN** a valid request with `dryRun: true` includes two new logs and one already-linked log
- **THEN** the response SHALL report `wouldImport` 2 and `skippedExisting` 1 and no row SHALL be written

#### Scenario: Write run persists and counts
- **WHEN** the same request is sent with `dryRun: false`
- **THEN** two logs SHALL be persisted, the response SHALL report `imported` 2 and `skippedExisting` 1

### Requirement: REQ-340 Import dialog on the Trackers page
Each tracker's "Import history" action SHALL open a dialog moving through range, scanning, mapping (REQ-358), preview, importing and done phases. The range phase SHALL show one labelled inclusive date-range field (REQ-359) defaulting to five years ago through today, rejecting an inverted or incomplete range inline, and list the tracker's non-deleted Projects with their remote scope, marking unscoped ones as getting no default target, without calling the tracker.

#### Scenario: Unscoped project flagged before scanning
- **WHEN** the range phase opens for a tracker with a bound Project that has no scope
- **THEN** the project list SHALL show that Project marked as not receiving a default target, without any remote request

#### Scenario: Range phase opens with the default range filled
- **WHEN** the range phase opens
- **THEN** the date-range field SHALL show a start of five years before today and an end of today, both ends complete, under a single translated label

#### Scenario: Inverted range
- **WHEN** the range field's start is after its end
- **THEN** an inline error SHALL be shown and no fetch SHALL start

#### Scenario: Incomplete range
- **WHEN** either end of the range field is incomplete (a cleared segment)
- **THEN** the translated "range required" inline error SHALL be shown and no fetch SHALL start

#### Scenario: Range picked from the calendar
- **WHEN** the user opens the range field's calendar and picks a start day and then an end day
- **THEN** both ends of the field SHALL update, the calendar SHALL close after the end day, and submitting SHALL scan exactly that inclusive range

### Requirement: REQ-481 Scanning phase
Scanning SHALL walk the range month by month, fetching logs and computing each log's default target by scope (REQ-334), with an accessible progress indicator and a cancel action that returns to the range phase. It SHALL NOT call the dry-run endpoint; the dry run runs only on moving from mapping to preview.

#### Scenario: Cancel only while scanning
- **WHEN** the dialog is scanning
- **THEN** a cancel action SHALL abort the scan and return to the range phase; while importing, no cancel action SHALL be offered

#### Scenario: Preview before writing
- **WHEN** the user submits a range
- **THEN** the dialog SHALL scan month by month without a dry run, show the mapping phase for the user to confirm or adjust each remote project's target, and only then run the dry run and show the per-Project preview before any write

### Requirement: REQ-482 Preview, importing and done phases
Each entry to preview SHALL run the dry run on the current mapping; the preview lists each assigned Project with counts to import and already linked, plus totals, leaving out unassigned ones. All assigned logs SHALL be sent; the skip (REQ-338) yields the linked count. Importing SHALL go month by month, with progress, no cancel, each month atomic. Done SHALL show totals, unassigned counts, and that times are synthetic but durations exact. Preview's back keeps the scan; mapping's back drops it.

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

### Requirement: REQ-483 Import failures, secret and accessibility
A month that fails while scanning or importing SHALL stop the run, show the translated error and the months already committed, and offer a retry of the same range, which skips what was committed. Without a browser-held secret the action SHALL be disabled with a translated hint. The dialog SHALL meet WCAG 2.1 AA (labelled fields, keyboard operable, progress and results announced), with all strings in `en` and `pl` parity.

#### Scenario: Retry resumes after a failed month
- **WHEN** a month fails during import and the user activates retry
- **THEN** the dialog SHALL re-run the same range, report the previously committed months as skipped, and continue from the failed month

#### Scenario: No secret in the browser
- **WHEN** the tracker has no stored secret
- **THEN** the action SHALL be disabled and its hint SHALL point to entering the secret in the tracker form

#### Scenario: Keyboard and announcements
- **WHEN** a keyboard user operates the dialog
- **THEN** every phase, including mapping, SHALL be reachable, the range field's segments and calendar SHALL be operable from the keyboard, and progress and results SHALL be announced via a live region

### Requirement: REQ-358 Mapping phase lets the user override the routed target Project
Before any dry run or write, the mapping phase SHALL show a row per remote project in the range (logs without one share a row) with its title (or a translated fallback), log count, and a target control of the tracker's non-deleted Projects plus "do not import", defaulting to the scope match (REQ-334) or "do not import". Rows MAY share a target; a change SHALL make no request. The selections when leaving the phase, not the defaults, SHALL decide the grouping for the dry run and the write.

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
