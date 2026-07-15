## MODIFIED Requirements

### Requirement: REQ-TTR-028 Edit a task
The system SHALL allow an authenticated user to update the `name` and `projectId` of their own task via `PATCH /api/tasks/[id]`, addressing the task by its `uuidv7` `id` and applying the same `name` validation as title resolution (trimmed, non-empty, length-bounded). Editing SHALL be scoped by `userId`. The `projectId` MAY be set to a new project, or cleared to `null` to make the task project-less. Project ownership and non-deleted validation SHALL only be enforced when the `projectId` is changed to a different non-null project; clearing to `null` SHALL always be allowed. When the `projectId` is unchanged from the task's current project, the system SHALL NOT validate that project's soft-delete status, so the task's `name` can still be edited after its project has been soft-deleted.

When the update would make the task's `(userId, name, projectId)` key collide with another existing task (the survivor), the system SHALL merge within a single transaction. If neither Task has a remote issue reference, all time entries of the edited Task SHALL be re-pointed to the survivor and the emptied edited Task SHALL be hard-deleted. If only one Task has a reference, that reference SHALL be preserved on the survivor. If both references identify the same remote issue using configuration provenance plus remote issue ID, one identical reference SHALL be preserved. If both Tasks have different references, the entire edit and merge SHALL be rejected with HTTP 409 and neither Task, its entries, nor its reference SHALL change. A successful merge SHALL return the survivor including its resolved `projectName`, `clientName`, and remote reference.

#### Scenario: Successful edit
- **WHEN** an authenticated user submits a valid new name and an owned `projectId` for their own task, with no key collision
- **THEN** the system SHALL update the task and return it (including the resolved `projectName`, `clientName`, and remote reference)

#### Scenario: Colliding edit merges unlinked Tasks
- **WHEN** an authenticated user renames or re-projects their unlinked Task so its `(name, projectId)` matches another unlinked Task
- **THEN** the system SHALL move all entries to the survivor, hard-delete the emptied Task, and return the survivor within one transaction

#### Scenario: Merge preserves a sole reference
- **WHEN** exactly one of the edited Task and survivor has a remote issue reference
- **THEN** the system SHALL preserve that reference on the survivor in the same merge transaction

#### Scenario: Merge collapses identical references
- **WHEN** both merging Tasks reference the same configuration provenance and remote issue ID
- **THEN** the system SHALL preserve one reference on the survivor and complete the merge atomically

#### Scenario: Merge rejects different references
- **WHEN** both merging Tasks have references that differ by configuration provenance or remote issue ID
- **THEN** the system SHALL respond with HTTP 409 and SHALL leave both Tasks, their entries, and their references unchanged

#### Scenario: Rename a task whose project is soft-deleted
- **WHEN** an authenticated user updates the `name` of their own task without changing its `projectId`, and that task's current project has been soft-deleted
- **THEN** the system SHALL allow the update and SHALL NOT reject it on account of the project's soft-delete status

#### Scenario: Clear the project assignment
- **WHEN** an authenticated user updates their own task and sets `projectId` to `null`
- **THEN** the system SHALL make the task project-less (merging per the collision and reference rules if a project-less task with that name exists) and return the resulting task

#### Scenario: Assign a project to a project-less task
- **WHEN** an authenticated user updates a project-less task, setting `projectId` to a non-deleted project they own
- **THEN** the system SHALL validate ownership, assign the project, and return the task with the resolved `projectName`, `clientName`, and remote reference

## Open Questions

None.