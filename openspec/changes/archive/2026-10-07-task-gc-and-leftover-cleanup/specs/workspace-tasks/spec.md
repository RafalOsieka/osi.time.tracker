## REMOVED Requirements

### Requirement: REQ-132 Task hard-delete lifecycle and merge invariant
**Reason**: Garbage collection was stated only for merges, so an entry patch could leave an orphan task. The migration sentence and the endpoint-absence scenario only recorded past changes.
**Migration**: Replaced by REQ-491, which states one garbage-collection rule for every operation that empties a task. No task-create or task-delete endpoint exists; tasks still come only from entry titles.

## ADDED Requirements

### Requirement: REQ-491 Task lifecycle and garbage collection
Tasks SHALL have no soft-delete state and SHALL only ever be hard-deleted. Tasks SHALL be created only from time-entry titles (REQ-137) and deleted only by garbage collection: whenever an operation leaves a task with no entries (deleting an entry, retitling or rebinding it, a day-scoped reassignment, or a merge), the task SHALL be hard-deleted in the same transaction.

#### Scenario: Merge hard-deletes the emptied task
- **WHEN** an edit merges a task into a survivor, leaving it with no entries
- **THEN** the emptied task row SHALL be hard-deleted in the same transaction

#### Scenario: Retitling the last entry deletes the old task
- **WHEN** the only entry of a task, running or stopped, is retitled so that it resolves to a different task
- **THEN** the previous task SHALL be hard-deleted in the same transaction and SHALL be absent from the task list

#### Scenario: Rebinding the last entry deletes the old task
- **WHEN** the only entry of a task is patched with a `taskId` of a different task
- **THEN** the previous task SHALL be hard-deleted in the same transaction

#### Scenario: A task that still has entries is kept
- **WHEN** one of several entries of a task is retitled or rebound, or an entry is retitled to a title that resolves to its current task
- **THEN** that task SHALL remain with its other entries
