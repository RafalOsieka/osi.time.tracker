## MODIFIED Requirements

### Requirement: REQ-447 Patching binds an entry to a task
A PATCH MAY carry a `taskId`: it SHALL be one of the user's tasks (foreign or unknown → HTTP 404) and SHALL bind the entry directly, taking precedence over `title` and `projectId`. Without a `taskId`, a given `title` (with an optional `projectId`, REQ-448) SHALL be resolved again by REQ-142, moving only the patched entry; an untitled entry follows the bare-title path.

#### Scenario: Retitle re-resolves the task
- **WHEN** an authenticated user patches an entry's title to a different value
- **THEN** the system SHALL re-resolve the title to a task and bind the entry to it

#### Scenario: Patch binds to an explicit taskId
- **WHEN** an authenticated user patches an entry with a `taskId` identifying one of their own tasks
- **THEN** the system SHALL bind the entry directly to that task and return the updated `TimeEntryDto`

#### Scenario: Sibling entries keep the original task
- **WHEN** an authenticated user patches one entry's title in a group that has other entries on the same linked task
- **THEN** only the patched entry SHALL move, and the remaining entries SHALL keep the original task and remote issue

#### Scenario: Untitled entry titled without a remote issue stays on the bare-title path
- **WHEN** an authenticated user patches an untitled entry (`taskId` null) with a title and no `taskId`
- **THEN** the system SHALL resolve the title with no current remote issue to keep (REQ-142) and SHALL NOT invent a remote issue

#### Scenario: Moving the last entry away collects its previous task
- **WHEN** an authenticated user retitles or rebinds an entry that is the only entry of its task, so that it lands on a different task
- **THEN** the previous task SHALL be hard-deleted in the same transaction (REQ-491)

#### Scenario: Clearing the last entry's title collects its task
- **WHEN** an authenticated user patches the only entry of a task with `title` `null`
- **THEN** the entry SHALL become untitled and the previous task SHALL be hard-deleted in the same transaction (REQ-491)
