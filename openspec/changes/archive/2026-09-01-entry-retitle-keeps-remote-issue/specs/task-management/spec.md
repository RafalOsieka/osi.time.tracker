## MODIFIED Requirements

### Requirement: REQ-137 Implicit task creation and matching via time entries
The system SHALL create and match tasks implicitly from time-entry titles as defined by the time-tracking capability, using the matching key `(userId, name, projectId, remoteIssueId)`. Implicitly created tasks SHALL be first-class tasks that appear in `GET /api/tasks` and its `search` results. No task `number` SHALL be assigned to any task (implicit or explicit).

Because a bare title no longer identifies a single task, resolution from a title alone SHALL apply a defined tie-break: among the user's tasks matching `(userId, name, effectiveProjectId)` the system SHALL select the task whose entries were **most recently used** (greatest `startedAt` among its time entries, falling back to the task's own creation order when it has none), and SHALL create a task only when no candidate exists. The system SHALL NOT reject a title for being ambiguous, and SHALL NOT create a duplicate task when a candidate exists. A caller that needs a specific task SHALL send that task's `id` instead of a title (REQ-143, REQ-180).

The bare-title tie-break SHALL apply to **new** entries (start or manual create) whose request supplies no remote issue. When the caller supplies an explicit remote issue (REQ-179), or when an existing entry that already has a task is retitled via PATCH without a `taskId` (REQ-143), resolution SHALL use `(userId, name, projectId, remoteIssueId)` and find-or-create exactly that task, using the current task's remote issue on PATCH-retitle (null meaning unlinked).

#### Scenario: Titling an entry creates a matching task
- **WHEN** a user starts or manually creates a time entry with a new title in a project scope and no remote issue
- **THEN** the system SHALL create an unlinked task with that name in that scope and it SHALL appear in the task list

#### Scenario: Retitling a linked entry keeps the remote issue
- **WHEN** a user retitles an existing time entry whose task is linked to a remote issue, using a new title and no `taskId`
- **THEN** the system SHALL find-or-create a task with that name in the same project scope carrying the same remote issue, and SHALL NOT create an unlinked task for that name

#### Scenario: Retitling an unlinked entry stays in the unlinked key
- **WHEN** a user retitles an existing time entry whose task has no remote issue, using a new title and no `taskId`
- **THEN** the system SHALL find-or-create the unlinked task of that name in the same project scope and SHALL NOT bind to a differently linked twin via the most-recently-used tie-break

#### Scenario: Titling an entry reuses an existing task
- **WHEN** a user titles a **new** time entry with a name that already exists in the target project scope and supplies no remote issue
- **THEN** the entry SHALL bind to the existing task (most recently used when several remote-issue twins exist) and no duplicate task SHALL be created

#### Scenario: Ambiguous title binds to the most recently used task
- **WHEN** a **new** entry's title matches several tasks in the target project scope that differ by remote issue
- **THEN** the entry SHALL bind to the one whose entries were used most recently and no new task SHALL be created

#### Scenario: Ambiguity is never an error
- **WHEN** a title matches several tasks
- **THEN** the system SHALL NOT reject the request and SHALL NOT require the caller to disambiguate

#### Scenario: Explicit remote issue bypasses the tie-break
- **WHEN** a caller supplies a title together with an explicit remote issue
- **THEN** resolution SHALL use `(userId, name, projectId, remoteIssueId)` and find-or-create exactly that task
