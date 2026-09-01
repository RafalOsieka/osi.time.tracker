## MODIFIED Requirements

### Requirement: REQ-142 Title binds an entry to a Task
The system SHALL treat a time entry's title as the name of the `Task` it points to; a `TimeEntry` SHALL carry no title column of its own. When a title is provided, the system SHALL resolve it to a `Task` within one transaction using the matching key `(userId, name, projectId, remoteIssueId)`, where `projectId = NULL` is a distinct scope and `remoteIssueId = NULL` means unlinked. When the caller supplies no remote issue, resolution SHALL consider all tasks matching `(userId, name, projectId)` and SHALL apply the most-recently-used tie-break of REQ-137, creating a new **unlinked** `Task` only when no candidate exists. When the caller supplies an explicit remote issue (REQ-179), resolution SHALL find-or-create against the full four-part key. When an **existing** entry that already has a task is retitled via PATCH without a `taskId` (REQ-143), resolution SHALL likewise use the full four-part key, taking that task's current `remoteIssueId` (null meaning unlinked) rather than the bare-title tie-break. A new entry started or created with a bare title SHALL still use the tie-break. A project-less title that matches an existing project-less task SHALL silently bind to it. An empty, whitespace-only, or omitted title SHALL leave `taskId` `null`.

#### Scenario: New title creates a task
- **WHEN** a title with no matching task in the target project scope is provided on a **new** entry (start or manual create) with no remote issue
- **THEN** the system SHALL create a new unlinked task in that scope and bind the entry to it

#### Scenario: Existing title matches a task
- **WHEN** a title matches exactly one existing task in the target project scope
- **THEN** the system SHALL bind the entry to that existing task without creating a new one

#### Scenario: Ambiguous title binds to the most recently used task
- **WHEN** a title matches several tasks in the target project scope differing only by remote issue
- **THEN** the entry SHALL bind to the most recently used of them and no new task SHALL be created

#### Scenario: Project-less silent match
- **WHEN** a title with no project matches an existing project-less task of the user
- **THEN** the entry SHALL silently bind to that project-less task

#### Scenario: Empty title leaves the entry untitled
- **WHEN** the title is empty or whitespace-only
- **THEN** the entry SHALL have `taskId` `null` and be shown as "(no task)"

#### Scenario: Retitle of a tasked entry uses the four-part key
- **WHEN** an existing entry that has a task is patched with a new title and no `taskId`
- **THEN** resolution SHALL find-or-create `(userId, name, projectId, remoteIssueId)` using the current task's remote issue and SHALL NOT apply the bare-title most-recently-used tie-break

### Requirement: REQ-143 Stop or retitle a running entry
The system SHALL allow an authenticated user to stop, retitle, and/or edit the timestamps of their own entry via `PATCH /api/time-entries/[id]`, addressed by its `uuidv7` `id` and scoped by `userId`. Setting `stoppedAt` (or requesting a stop) SHALL mark the entry as stopped. The request MAY include `startedAt` (ISO 8601 instant) to move the entry's start. Validation SHALL apply to the entry's effective post-patch state: `stoppedAt` SHALL be greater than or equal to `startedAt` for a stopped entry, and for an entry that remains running, `startedAt` SHALL NOT be in the future (beyond a small clock-skew tolerance). Overlap with the user's other entries SHALL be permitted. The request MAY include an optional `taskId`: when provided, it SHALL identify a task owned by the authenticated user (foreign or unknown resolves to HTTP 404) and the entry SHALL bind directly to that task, taking precedence over `title`/`projectId` resolution. When no `taskId` is provided, a provided `title` (with optional `projectId`) SHALL be re-resolved to a `taskId` using the same matching rules as REQ-142. The presence of the `projectId` field SHALL be significant when the task is re-resolved by title: **omitting** `projectId` SHALL preserve the entry's current project scope (the project of its current task, or project-less when it has none), while an explicit **`null`** SHALL resolve the entry into the project-less scope. The system SHALL NOT treat an absent `projectId` as an implicit `null`, so a title-only edit SHALL NOT re-home the entry into the no-project scope. When the entry currently has a task and no `taskId` is provided, title re-resolution SHALL also preserve that task's current remote issue (including `remoteIssueId` null for an unlinked task): the system SHALL find-or-create against `(userId, effectiveName, effectiveProjectId, currentRemoteIssueId)` and SHALL NOT create a new unlinked task merely because the PATCH body omitted a remote-issue field. The PATCH body SHALL NOT be required to include a remote issue field for this keep. When the entry is untitled (`taskId` null), there is no current remote issue to keep and bare-title resolution (REQ-142) SHALL apply. A foreign or unknown entry id SHALL resolve to HTTP 404 without confirming existence. On success the updated `TimeEntryDto` SHALL be returned.

#### Scenario: Stop the running entry
- **WHEN** an authenticated user patches their running entry with a stop request
- **THEN** the system SHALL set `stoppedAt` and return the stopped `TimeEntryDto`

#### Scenario: Retitle re-resolves the task
- **WHEN** an authenticated user patches an entry's title to a different value
- **THEN** the system SHALL re-resolve the title to a task and bind the entry to it

#### Scenario: Patch binds to an explicit taskId
- **WHEN** an authenticated user patches an entry with a `taskId` identifying one of their own tasks
- **THEN** the system SHALL bind the entry directly to that task and return the updated `TimeEntryDto`

#### Scenario: Title-only edit preserves the current project scope
- **WHEN** an authenticated user patches an entry's `title` without including a `projectId` field, and the entry's current task belongs to a project
- **THEN** the system SHALL re-resolve the title within that same project scope and the entry SHALL keep its project association rather than moving to the no-project scope

#### Scenario: Title-only edit preserves the current remote issue
- **WHEN** an authenticated user patches an entry's `title` without a `taskId`, and the entry's current task is linked to a remote issue
- **THEN** the system SHALL find-or-create the task of the new name in the current project scope with that same remote issue, and the updated entry SHALL still expose that remote issue reference

#### Scenario: Title-only edit of an unlinked task stays unlinked
- **WHEN** an authenticated user patches an entry's `title` without a `taskId`, and the entry's current task has no remote issue
- **THEN** the system SHALL resolve to the unlinked task of the new name in the current project scope and SHALL NOT bind the entry to a different remote-issue twin of that name

#### Scenario: Title-only edit does not steal a different remote issue via tie-break
- **WHEN** an authenticated user patches a linked entry's `title` to a name that already exists in the same project on a task with a **different** remote issue
- **THEN** the entry SHALL move to a find-or-create task carrying the **source** remote issue and SHALL NOT bind to the differently linked task

#### Scenario: Sibling entries keep the original task
- **WHEN** an authenticated user patches one entry's title in a group that has other entries on the same linked task
- **THEN** only the patched entry SHALL move, and the remaining entries SHALL keep the original task and remote issue

#### Scenario: Untitled entry titled without a remote issue stays on the bare-title path
- **WHEN** an authenticated user patches an untitled entry (`taskId` null) with a title and no `taskId`
- **THEN** the system SHALL resolve the title with no current remote issue to keep (REQ-142) and SHALL NOT invent a remote issue

#### Scenario: Running free-form retitle preserves the remote issue
- **WHEN** the user commits a free-form new title on the running top-bar widget (title-only PATCH, no `taskId`)
- **THEN** the running entry SHALL keep its current project and remote issue on the re-resolved task

#### Scenario: Explicit null moves the entry to the project-less scope
- **WHEN** an authenticated user patches an entry's `title` with an explicit `projectId` of `null`
- **THEN** the system SHALL resolve the title within the project-less scope and bind the entry to a project-less task

#### Scenario: Project-less move of a linked entry keeps the remote issue
- **WHEN** an authenticated user patches a linked entry's `title` with an explicit `projectId` of `null` and no `taskId`
- **THEN** the target SHALL be the project-less task of that name carrying the source remote issue

#### Scenario: Edit the start of a stopped entry
- **WHEN** an authenticated user patches a stopped entry's `startedAt` to an instant at or before its `stoppedAt`
- **THEN** the system SHALL update `startedAt` and return the updated `TimeEntryDto`

#### Scenario: Edit the start of the running entry
- **WHEN** an authenticated user patches their running entry's `startedAt` to a past instant
- **THEN** the system SHALL update `startedAt`, the entry SHALL remain running, and elapsed time SHALL derive from the new start

#### Scenario: Future start on a running entry rejected
- **WHEN** a patch would set a running entry's `startedAt` to a future instant (beyond clock-skew tolerance)
- **THEN** the system SHALL reject the request with `{ messageKey, params }`

#### Scenario: Start after stop rejected
- **WHEN** a patch would result in `startedAt` later than the entry's effective `stoppedAt`
- **THEN** the system SHALL reject the request with `{ messageKey, params }`

#### Scenario: Stop time before start rejected
- **WHEN** a patch would set `stoppedAt` earlier than the entry's effective `startedAt`
- **THEN** the system SHALL reject the request with `{ messageKey, params }`

#### Scenario: Overlapping entries permitted
- **WHEN** a patch moves an entry's `startedAt` so it overlaps another of the user's entries
- **THEN** the system SHALL accept the change without any overlap error

#### Scenario: Foreign or unknown entry id
- **WHEN** an authenticated user patches an entry id owned by another user or that does not exist
- **THEN** the system SHALL respond with HTTP 404 without revealing existence
