## MODIFIED Requirements

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

### Requirement: REQ-340 Import dialog on the Trackers page
The Trackers page SHALL offer an "Import history" action per tracker that opens a dialog with these phases: a range phase with labelled from/to date fields defaulting to five years before today and today, rejecting an inverted range inline, and a list of the tracker's non-deleted Projects with their remote project scope, marking unscoped Projects as not receiving a default target (this list SHALL NOT call the tracker); a scanning phase that walks the range month by month, fetching logs and computing each log's default target Project by scope (REQ-334), with an accessible progress indicator and a cancel action, and SHALL NOT call the dry-run endpoint; a mapping phase (REQ-358) listing one row per remote project encountered across the whole range with its raw log count and an editable target-Project control, defaulting to the scope-based suggestion or to "do not import" when there is none; a preview phase, generated from the mapping phase's current selections, listing each target Project the user assigned with the count to import and the count already linked, plus totals, and excluding every remote project left unassigned; an importing phase with per-month progress and no cancel action, because each month commits atomically and a re-run resumes by skipping; and a done phase with totals, a reminder of unassigned counts, and a note that entry times are synthetic while durations are exact. Every log assigned a target Project in the mapping phase SHALL be sent for import; the endpoint's existing-identity skip (REQ-338) makes resubmitting an already-linked log a no-op, and this is also how the done phase's already-linked count is produced without the client tracking it separately. The preview phase's "back" action SHALL return to the mapping phase without discarding the scan; the mapping phase's "back" action SHALL return to the range phase and discard the scan. Advancing from the mapping phase to the preview phase SHALL (re-)run the dry run against the current selections. A month that fails during scanning or importing SHALL stop the run, show the translated error, state the months already committed, and offer a retry that re-runs the same range. The action SHALL be disabled with a translated hint when no secret is stored in the browser for the tracker. The dialog SHALL meet WCAG 2.1 AA (labelled fields, keyboard operable, progress and results announced) and all strings SHALL exist in `en` and `pl` in parity.

#### Scenario: Unscoped project flagged before scanning
- **WHEN** the range phase opens for a tracker with a bound Project that has no scope
- **THEN** the project list SHALL show that Project marked as not receiving a default target, without any remote request

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
- **WHEN** `from` is after `to`
- **THEN** an inline error SHALL be shown and no fetch SHALL start

#### Scenario: Keyboard and announcements
- **WHEN** a keyboard user operates the dialog
- **THEN** every phase, including mapping, SHALL be reachable and progress and results SHALL be announced via a live region

## ADDED Requirements

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
