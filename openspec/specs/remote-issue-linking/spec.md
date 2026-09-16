# remote-issue-linking Specification

## Purpose
Define how a Task is linked to a single remote issue: searching the configured tracker (by title phrase or exact issue ID) under the client or extension execution mode, applying the project's remote scope, storing at most one adapter-neutral issue reference per Task, deriving its issue URL, and unlinking locally as a day-scoped move. All rules are user-scoped and adapter-neutral. The reusable issue picker rendered on the Timer view and the Remote Sync page is specified in `tracking-timer-view` (REQ-107).

## Requirements

### Requirement: REQ-104 Persist one remote issue reference per Task
The system SHALL store at most one remote issue reference per Task, held **inline on the task row** (REQ-237): the owning user, remote-system configuration provenance, remote issue ID as nullable text, cached issue title, optional cached remote project **title**, and timestamps. A Task with a null remote issue ID SHALL be unlinked. It SHALL NOT store a remote issue URL. It SHALL NOT store a remote project id or any other remote-project identifier. For an active matching configuration, the system SHALL derive the issue URL from its normalized base URL and remote issue ID using the URL pattern of the configuration's `systemType` (e.g. OpenProject work-package URLs, Redmine issue URLs), resolved through a per-provider abstraction rather than conditional branching.

Because the remote issue ID is part of Task identity (REQ-136), "linking" SHALL NOT mutate an existing Task's reference. A reference SHALL be established only by resolving or creating the Task that carries it, and time entries SHALL be moved to that Task by the day-scoped reassignment operation (REQ-179). Two Tasks with the same user, project and name but different remote issues SHALL coexist.

When a newly linked Task is created, the system SHALL persist the remote project title supplied with the search result when that title is a non-empty string, and SHALL persist no remote project title when the result omitted it. An existing linked Task that has no cached remote project title SHALL remain valid. The nested `remoteIssueRef` boundary shape SHALL expose the cached remote project title when present and omit it when absent.

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
An authenticated user SHALL be able to unlink the remote issue from their own work without touching the remote tracker. Unlinking SHALL be expressed as a **day-scoped move**: the listed entries SHALL be reassigned (REQ-179, explicit null remote issue) to the find-or-create Task with the same name and project and no remote issue, and the source Task SHALL be garbage-collected when it is left with no entries. Unlinking SHALL NOT call, update, or delete any remote issue, and SHALL NOT affect the same Task's entries on other days. The task-global endpoints `POST /api/tasks/[id]/remote-issue-ref` and `DELETE /api/tasks/[id]/remote-issue-ref` SHALL be removed.

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
All local link and unlink operations SHALL require authentication, enforce CSRF protection for mutations, validate request bodies through shared boundary schemas, and scope Task and time-entry lookup to the authenticated user. Linking SHALL derive the active tracker from the owned source Task's Project (`project.trackerId` pointing at a non-deleted tracker) and SHALL reject project-less Tasks, local projects (null tracker), missing or soft-deleted trackers, foreign Tasks, unknown Tasks, and foreign or unknown time-entry ids without trusting client-supplied ownership or tracker identifiers. Any active tracker whose `systemType` has a registered adapter (OpenProject, Redmine) SHALL be eligible for linking. Because linking is performed by the day-scoped reassignment operation (REQ-179), these validations SHALL be enforced by that endpoint, and a rejected request SHALL leave every listed entry and Task unchanged.

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
When the Task's Project carries a remote project scope (REQ-325), the remote issue picker SHALL apply that scope to every search by default and SHALL show a labelled, keyboard-operable toggle whose text names the scoped remote project title (e.g. "Only in <title>"). The toggle SHALL be on each time the popover opens; turning it off SHALL search the whole tracker for subsequent submits in that open. When the Project has no scope, the toggle SHALL NOT be rendered and search SHALL be tracker-wide. Scope SHALL be forwarded to the adapter as a search parameter (REQ-319); the picker SHALL NOT filter results client-side. Scope SHALL apply equally under `client` and `extension` execution. The Remote Sync inline picker SHALL apply the same rules using the row's Project scope.

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
For an owned Task whose Project has an active tracker and registered adapter, the system SHALL search through `client` or `extension` according to `executionMode`. `client` SHALL query the configured tracker origin directly with the browser-held secret; `extension` SHALL execute through the approved desktop extension. Neither mode SHALL transmit the secret to an OSI API. Existing validation, bounded title search, exact-ID lookup, stale-response suppression, neutral results, and translated error behavior remain unchanged.

#### Scenario: Client execution-mode title search returns matching issues
- **WHEN** a user submits valid search input under `client`
- **THEN** the browser SHALL query the configured tracker origin and render neutral results

#### Scenario: Server execution-mode title search returns matching issues
- **WHEN** a stale client submits a search for a `server` tracker
- **THEN** the unsupported mode SHALL be rejected without contacting the tracker

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

#### Scenario: Server execution-mode credential is forwarded but not persisted
- **WHEN** a stale caller requests server search
- **THEN** validation SHALL reject it and SHALL NOT forward the credential

#### Scenario: Remote search fails
- **WHEN** a supported mode encounters authentication, CORS, connection, or extension failure
- **THEN** the picker SHALL expose a translated accessible error without changing the reference


### Requirement: REQ-329 Issue-ID search marks results outside the scope
In issue-ID mode with the scope toggle on, the picker SHALL request the exact lookup with the scope (REQ-320). A found issue with `inScope: false` SHALL still be listed and selectable, and SHALL carry a visible, translated "outside this project's scope" hint that is also part of the result's accessible name and is announced with the result status. A found issue with `inScope: true` SHALL show no hint. Not-found SHALL keep the existing not-found state. With the toggle off, or when the Project has no scope, no hint SHALL be shown.

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

