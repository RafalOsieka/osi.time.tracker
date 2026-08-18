## MODIFIED Requirements

### Requirement: REQ-237 Remote issue reference stored on the task row
The `tasks` table SHALL carry the remote issue reference inline: the originating remote-system configuration provenance, the remote issue ID as nullable text (`remoteIssueId`), the cached issue title, an optional cached remote project title, and the reference timestamps. A task with `remoteIssueId IS NULL` SHALL be an unlinked task. The separate one-to-one `remote_issue_refs` table SHALL be dropped; the task row SHALL be the single source of truth for the reference, and no remote issue URL SHALL be stored (it stays derived per REQ-104). The task row SHALL NOT store a remote project id.

A migration SHALL fan every existing `remote_issue_refs` row onto its owning task, drop the table, and rebuild the task uniqueness indexes per REQ-136. Because the source table was unique per `taskId`, the migration SHALL neither merge nor split any task row, and every `remote_exports.taskId` SHALL continue to reference the same task.

A later widening SHALL add a nullable cached remote project title column on `tasks`. Existing linked rows MAY leave that column null. The widening SHALL NOT rewrite uniqueness indexes and SHALL NOT backfill titles from the remote tracker.

Boundary types SHALL keep exposing the reference as the nested `remoteIssueRef` shape on `TaskDto` and `TimeEntryDto`, derived from the task row, so a task without a `remoteIssueId` SHALL expose `remoteIssueRef` as absent. When the reference is present, the nested shape SHALL include the cached remote project title only when a non-empty value is stored.

Task hard-deletion (garbage collection, REQ-132) SHALL remove the reference with the row it lives on. Export provenance SHALL survive task garbage collection: the foreign key from an export record to its task SHALL NOT allow garbage collection to orphan an export record, nor SHALL it block garbage collection.

#### Scenario: Reference lives on the task row
- **WHEN** a task is linked to a remote issue
- **THEN** its configuration provenance, remote issue ID and cached title SHALL be persisted on the task row and no separate reference record SHALL exist

#### Scenario: Cached remote project title is stored when provided
- **WHEN** a newly linked task is created from a search result that includes a remote project title
- **THEN** that title SHALL be persisted on the task row and the nested `remoteIssueRef` SHALL expose it

#### Scenario: Cached remote project title may be absent
- **WHEN** a linked task was created without a remote project title, or predates the column
- **THEN** the task SHALL remain linked, the column SHALL be null, and the nested `remoteIssueRef` SHALL omit the cached remote project title

#### Scenario: Unlinked task has a null remote issue id
- **WHEN** a task has no remote issue
- **THEN** its `remoteIssueId` SHALL be `NULL` and its DTO SHALL expose no `remoteIssueRef`

#### Scenario: Migration preserves every reference and task
- **WHEN** the migration runs against a database containing linked, unlinked and project-less tasks
- **THEN** each previously linked task SHALL carry its reference inline, no task row SHALL be merged or removed, and the reference table SHALL be gone

#### Scenario: Project-title widening is additive
- **WHEN** the cached remote project title column is added
- **THEN** existing task rows SHALL remain valid with a null project title, uniqueness SHALL be unchanged, and no remote call SHALL be made to fill the column

#### Scenario: Export provenance survives garbage collection
- **WHEN** a task with an export record is garbage-collected because its last entry moved away
- **THEN** the export record SHALL remain readable and the deletion SHALL NOT fail on the foreign key
