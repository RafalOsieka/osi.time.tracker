# remote-issue-linking Specification

## Purpose
How a task gets linked to one remote issue: searching the tracker by title or exact issue id, directly or through the extension, within the project's remote scope; linking and unlinking as day-scoped moves of entries between tasks. The picker UI on the Timer view and Remote Sync is in `tracking-timer-view` (REQ-107).

## Requirements

### Requirement: REQ-104 Persist one remote issue reference per Task
A task SHALL hold at most one remote issue reference, stored on the task row (workspace-tasks REQ-237), with its issue URL derived from the active tracker (REQ-205). The issue id is part of task identity (REQ-136), so linking SHALL NOT edit a reference: it SHALL find or create the task with the issue and move the entries (REQ-179), so same-named tasks with different issues coexist. A new linked task SHALL cache the result's remote project title only when non-empty; tasks without one stay valid.

#### Scenario: Link an issue
- **WHEN** an authenticated user selects an issue for the Task of a given day's entries
- **THEN** the system SHALL find or create the Task carrying that configuration provenance and remote issue ID with the same name and project, move that day's entries to it, and return the resulting reference

#### Scenario: Link persists the remote project title
- **WHEN** the user selects a search result that includes a remote project title
- **THEN** the created or resolved Task's reference SHALL include that cached remote project title and SHALL NOT store a remote project id

#### Scenario: Link succeeds without a remote project title
- **WHEN** the user selects a search result that has a remote issue ID and title but no remote project title
- **THEN** the system SHALL persist the reference with no cached remote project title and SHALL NOT reject the link

#### Scenario: Replace an existing link
- **WHEN** the user selects a different issue for a day whose entries are on a linked Task
- **THEN** the system SHALL move that day's entries to the Task carrying the new issue so each Task still has exactly one reference, and SHALL leave other days' entries on the original Task

#### Scenario: Two tasks share a name but differ by issue
- **WHEN** the user links one day's `title1` entries in project A to issue `4711` and another day's `title1` entries in project A to issue `4899`
- **THEN** both Tasks SHALL exist, each with its own reference, and neither SHALL overwrite the other

#### Scenario: Derive a usable issue URL
- **WHEN** a reference's originating configuration is active and available
- **THEN** the system SHALL derive a direct issue URL from the current base URL and encoded remote issue ID using the configuration's provider URL pattern

#### Scenario: Reference has no usable configuration
- **WHEN** the reference's configuration is not active or available
- **THEN** the system SHALL return its cached ID, cached issue title, and cached remote project title when present, without a generated URL or remote-search capability


### Requirement: REQ-105 Unlink a remote issue locally
Unlinking SHALL be a local, **day-scoped move**: the listed entries SHALL be reassigned (REQ-179, explicit null remote issue) to the find-or-create task with the same name and project and no issue, and an emptied source task garbage-collected. It SHALL NOT call, update or delete any remote issue, nor touch the task's entries on other days. No task-global `POST` or `DELETE /api/tasks/[id]/remote-issue-ref` endpoint SHALL exist.

#### Scenario: Unlink one day's entries
- **WHEN** the user unlinks the remote issue for a day's task group
- **THEN** that day's entries SHALL move to the unlinked Task of the same name and project, the remote tracker SHALL be unchanged, and the same Task's entries on other days SHALL keep their reference

#### Scenario: Unlink an already unlinked group
- **WHEN** the user requests unlinking for entries already on an unlinked Task
- **THEN** the operation SHALL succeed idempotently and the entries SHALL remain on that Task

#### Scenario: Emptied source task is garbage-collected
- **WHEN** unlinking moves the source Task's last remaining entries away
- **THEN** the emptied source Task SHALL be hard-deleted in the same transaction

#### Scenario: Task-global reference endpoints are gone
- **WHEN** a client calls `POST` or `DELETE` on `/api/tasks/[id]/remote-issue-ref`
- **THEN** the system SHALL respond with HTTP 404 or 405 (route absent)


### Requirement: REQ-106 Remote issue linking is user-scoped and validated
Link and unlink follow `core-api-conventions` and run through the reassignment endpoint (REQ-179), which SHALL enforce these rules. Linking SHALL take the tracker from the owned task's project, never from the client, and SHALL reject project-less tasks, local projects, missing or soft-deleted trackers, and foreign or unknown task or entry ids. Any active tracker whose `systemType` has an adapter (OpenProject, Redmine) SHALL be eligible. A rejected request SHALL change no entry or task.

#### Scenario: Link an eligible owned Task
- **WHEN** an authenticated user submits a valid issue selection for a day's entries of their own Task under a Project with an active supported tracker (OpenProject or Redmine)
- **THEN** the system SHALL link it using the server-derived tracker provenance

#### Scenario: Ineligible Task is rejected
- **WHEN** the source Task is project-less, its project has no tracker, or its tracker is missing/soft-deleted
- **THEN** the system SHALL reject linking with a translated `{ messageKey, params }` error, persist nothing, and move no entry

#### Scenario: Foreign or unknown Task or entry is concealed
- **WHEN** a user attempts to link or unlink using a foreign or unknown Task id or time-entry id
- **THEN** the system SHALL respond with HTTP 404 without revealing whether it exists

#### Scenario: Missing authentication or CSRF is rejected
- **WHEN** a local mutation lacks a valid session or CSRF token
- **THEN** the system SHALL reject it and SHALL persist nothing


### Requirement: REQ-328 Picker applies the project's remote scope by default
When the task's project has a remote scope (REQ-325), the picker (also inline on Remote Sync) SHALL apply it to every search by default, with a labelled, keyboard-operable toggle naming the scoped project ("Only in <title>"), on each time the popover opens; off, later searches cover the whole tracker. Without a scope there is no toggle. The scope SHALL be sent to the adapter (REQ-319), directly or through the extension, never applied by filtering results in the client.

#### Scenario: Scoped title search
- **WHEN** the user submits a title search in the picker for a Task whose Project is scoped and the toggle is on
- **THEN** only issues from the scoped remote project and its descendants SHALL be listed

#### Scenario: Widen to the whole tracker
- **WHEN** the user turns the toggle off and submits a title search
- **THEN** the picker SHALL search the whole tracker and list results from any remote project

#### Scenario: Toggle resets on reopen
- **WHEN** the user turned the toggle off, closed the popover, and opens it again
- **THEN** the toggle SHALL be on

#### Scenario: Unscoped project shows no toggle
- **WHEN** the Task's Project has no remote project scope
- **THEN** the picker SHALL NOT render the toggle and SHALL search tracker-wide

#### Scenario: Scoped project no longer exists remotely
- **WHEN** a scoped search fails because the remote project is gone
- **THEN** the picker SHALL show the translated search error and the toggle SHALL remain available to widen the search


### Requirement: REQ-103 Search the configured tracker by execution mode
For an owned task whose project has an active tracker with an adapter, search SHALL run directly (`client`) or through the approved extension (`extension`) according to the tracker's direct-browser capability (REQ-311): directly it queries the tracker origin with the browser-held secret, and neither path sends the secret to an OSI API. Search SHALL validate input, bound title results, support exact-id lookup, ignore stale responses, return neutral results and show translated errors.

#### Scenario: Client execution-mode title search returns matching issues
- **WHEN** a user submits valid search input under `client`
- **THEN** the browser SHALL query the configured tracker origin and render neutral results

#### Scenario: Exact issue-ID search returns an issue
- **WHEN** a valid exact-ID search runs through `client` or `extension`
- **THEN** the matching issue SHALL be shown regardless of status

#### Scenario: Search result includes remote project title
- **WHEN** the provider supplies a usable project title
- **THEN** the neutral result SHALL include it without a project id

#### Scenario: Search result omits a missing remote project title
- **WHEN** the provider omits a usable project title
- **THEN** the issue id and title SHALL remain selectable

#### Scenario: Extension search bypasses CORS
- **WHEN** a desktop user submits valid search input under `extension`
- **THEN** the approved extension SHALL perform the tracker request without routing it through OSI

#### Scenario: Mobile extension mode is unavailable
- **WHEN** a mobile browser encounters a tracker configured for `extension`
- **THEN** remote search SHALL expose an actionable extension-unavailable state and SHALL NOT fall back to another mode

#### Scenario: Invalid search input does not call the tracker
- **WHEN** title input is too short or an issue ID is invalid
- **THEN** the picker SHALL show translated validation and make no remote request

#### Scenario: New search supersedes an older response
- **WHEN** an older request completes after a newer search
- **THEN** only the newer result SHALL be displayed

#### Scenario: Client execution-mode credential remains browser-only
- **WHEN** client search runs
- **THEN** the secret SHALL travel only to the configured tracker origin

#### Scenario: Remote search fails
- **WHEN** a supported mode encounters authentication, CORS, connection, or extension failure
- **THEN** the picker SHALL expose a translated accessible error without changing the reference


### Requirement: REQ-329 Issue-ID search marks results outside the scope
In issue-ID mode with the scope toggle on, the picker SHALL look up with the scope (REQ-320). A found issue with `inScope: false` SHALL still be listed and selectable, with a visible translated "outside this project's scope" hint that is part of its accessible name and announced with the result status; `inScope: true` shows no hint. Not-found keeps the not-found state. With the toggle off, or no scope, no hint SHALL show.

#### Scenario: ID inside the scope
- **WHEN** the user looks up an issue id that belongs to the scoped subtree
- **THEN** the result SHALL be listed without an outside-scope hint

#### Scenario: ID outside the scope
- **WHEN** the user looks up an existing issue id from an unrelated remote project
- **THEN** the result SHALL be listed with the outside-scope hint and SHALL remain selectable for linking

#### Scenario: Linking an outside-scope issue
- **WHEN** the user selects a result marked outside the scope
- **THEN** the day-scoped link (REQ-179) SHALL proceed exactly as for any other result and SHALL NOT persist a remote project id

#### Scenario: ID not found
- **WHEN** the lookup resolves to not-found under either step
- **THEN** the picker SHALL show the existing translated not-found state

#### Scenario: Hint is accessible
- **WHEN** an outside-scope result is rendered
- **THEN** the hint SHALL be readable by assistive technology through the result's accessible name and the live status region

