# time-tracking Specification

## Purpose
Define authenticated live time-entry tracking with a single running entry per user, title-to-task resolution within project scope, stop/retitle behavior, server-backed running-entry reads, derived durations, a persistent shell indicator, and auth/CSRF guarantees.

## Requirements

### Requirement: REQ-TTR-036 Start a live timer
The system SHALL allow an authenticated user to start a live timer via `POST /api/time-entries`, creating a `TimeEntry` scoped to the user with `startedAt` set to the current server time and `stoppedAt` `null` (a running entry). The request MAY include an optional `title` (trimmed, length-bounded) and an optional `projectId`; both MAY be omitted or `null`. The title SHALL be resolved to a `taskId` server-side (see REQ-TTR-038); an empty or omitted title SHALL create an untitled running entry (`taskId = null`). On success the created `TimeEntry` SHALL be returned as a `TimeEntryDto` with timestamps serialized as strings.

#### Scenario: Start with a title and project
- **WHEN** an authenticated user posts a start request with a non-empty title and an owned `projectId`
- **THEN** the system SHALL create a running entry (`stoppedAt` null) bound to the resolved task and return the `TimeEntryDto`

#### Scenario: Start untitled
- **WHEN** an authenticated user posts a start request with no title
- **THEN** the system SHALL create a running entry with `taskId` `null` and return it

#### Scenario: Invalid project value rejected
- **WHEN** the start request provides a non-null `projectId` that is not a valid uuid
- **THEN** the system SHALL reject the request with `{ messageKey, params }`

### Requirement: REQ-TTR-037 At most one running entry per user
The system SHALL guarantee that an authenticated user has at most one running `TimeEntry` (`stoppedAt IS NULL`) at any time, enforced by a partial unique index on `(userId) WHERE stoppedAt IS NULL`. When a user starts a new timer while another entry is running, the system SHALL first stop the currently running entry (setting its `stoppedAt` to the new entry's `startedAt`) and then create the new running entry, within a single transaction (Toggl stop-on-new-start behavior).

#### Scenario: Starting a new timer stops the running one
- **WHEN** an authenticated user with a running entry starts a new timer
- **THEN** the previously running entry SHALL be stopped and exactly one running entry (the new one) SHALL remain

#### Scenario: Concurrent starts do not create two running entries
- **WHEN** an authenticated user issues two start requests concurrently
- **THEN** the partial unique index SHALL prevent two running entries and the system SHALL end with exactly one running entry

### Requirement: REQ-TTR-038 Title binds an entry to a Task
The system SHALL treat a time entry's title as the name of the `Task` it points to; a `TimeEntry` SHALL carry no title column of its own. When a title is provided, the system SHALL resolve it to a `Task` within one transaction using the matching key `(userId, name, projectId)`, where `projectId = NULL` is a distinct scope. If a non-deleted task with that name exists in the given project scope, the entry SHALL bind to it; otherwise a new `Task` SHALL be created in that scope and the entry SHALL bind to it. A project-less title that matches an existing project-less task SHALL silently bind to it. An empty, whitespace-only, or omitted title SHALL leave `taskId` `null`.

#### Scenario: New title creates a task
- **WHEN** a title with no matching task in the target project scope is provided
- **THEN** the system SHALL create a new task in that scope and bind the entry to it

#### Scenario: Existing title matches a task
- **WHEN** a title matches an existing non-deleted task in the target project scope
- **THEN** the system SHALL bind the entry to that existing task without creating a new one

#### Scenario: Project-less silent match
- **WHEN** a title with no project matches an existing project-less task of the user
- **THEN** the entry SHALL silently bind to that project-less task

#### Scenario: Empty title leaves the entry untitled
- **WHEN** the title is empty or whitespace-only
- **THEN** the entry SHALL have `taskId` `null` and be shown as "(no task)"

### Requirement: REQ-TTR-039 Stop or retitle a running entry
The system SHALL allow an authenticated user to stop and/or retitle their own entry via `PATCH /api/time-entries/[id]`, addressed by its `uuidv7` `id` and scoped by `userId`. Setting `stoppedAt` (or requesting a stop) SHALL mark the entry as stopped; `stoppedAt` SHALL be greater than or equal to `startedAt`. A provided `title` (with optional `projectId`) SHALL be re-resolved to a `taskId` using the same matching rules as REQ-TTR-038. A foreign or unknown entry id SHALL resolve to HTTP 404 without confirming existence. On success the updated `TimeEntryDto` SHALL be returned.

#### Scenario: Stop the running entry
- **WHEN** an authenticated user patches their running entry with a stop request
- **THEN** the system SHALL set `stoppedAt` and return the stopped `TimeEntryDto`

#### Scenario: Retitle re-resolves the task
- **WHEN** an authenticated user patches an entry's title to a different value
- **THEN** the system SHALL re-resolve the title to a task and bind the entry to it

#### Scenario: Stop time before start rejected
- **WHEN** a patch would set `stoppedAt` earlier than `startedAt`
- **THEN** the system SHALL reject the request with `{ messageKey, params }`

#### Scenario: Foreign or unknown entry id
- **WHEN** an authenticated user patches an entry id owned by another user or that does not exist
- **THEN** the system SHALL respond with HTTP 404 without revealing existence

### Requirement: REQ-TTR-040 Read the running entry
The system SHALL expose the authenticated user's current running entry via `GET /api/time-entries/running`, returning the single running `TimeEntryDto` (`stoppedAt` null) or `null` when none is running. The response SHALL be scoped strictly to the authenticated user.

#### Scenario: Running entry returned
- **WHEN** an authenticated user with a running entry requests the running endpoint
- **THEN** the system SHALL return that entry's `TimeEntryDto`

#### Scenario: No running entry
- **WHEN** an authenticated user with no running entry requests the running endpoint
- **THEN** the system SHALL return `null`

### Requirement: REQ-TTR-041 Duration derived from timestamps
The system SHALL always derive a time entry's duration from `stoppedAt − startedAt`; a running entry's elapsed time SHALL be computed against the current time. The system SHALL NOT store a separate duration column.

#### Scenario: Duration is computed, not stored
- **WHEN** a stopped entry is displayed
- **THEN** its duration SHALL be computed as `stoppedAt − startedAt` rather than read from a stored duration field

### Requirement: REQ-NFR-026 Persistent running-timer indicator
The application shell SHALL display an always-visible running indicator whenever the authenticated user has a running entry, showing the running entry's title (or "(no task)") and its live-updating elapsed time. The running state SHALL be sourced from the server (`GET /api/time-entries/running`) so it survives page reloads and is consistent across devices. The indicator and timer widget SHALL meet WCAG 2.1 AA (labelled controls, keyboard operable) and derive styling from PrimeVue theme tokens; all user-facing strings SHALL exist in `en` and `pl` in parity.

#### Scenario: Indicator visible while running
- **WHEN** the authenticated user has a running entry
- **THEN** the shell SHALL show a running indicator with the entry's title and a live elapsed time

#### Scenario: Running state survives reload
- **WHEN** a user with a running entry reloads the app
- **THEN** the shell SHALL re-fetch and display the running entry from the server

#### Scenario: Strings localized in parity
- **WHEN** new user-facing timer strings are added
- **THEN** they SHALL exist in both `en.json` and `pl.json` with matching keys

### Requirement: REQ-NFR-027 Authenticated and CSRF-guarded time-entry endpoints
All time-entry endpoints SHALL require authentication via `requireAuth`, and mutating endpoints (`POST`, `PATCH`) SHALL be CSRF-protected; client-side mutations SHALL use `$csrfFetch` / `useCsrfFetch`. API errors SHALL use the `{ messageKey, params }` contract translated client-side via `t()`; server/network failures SHALL surface as a Toast. Every read and write SHALL be scoped by the authenticated user's id.

#### Scenario: Unauthenticated request rejected
- **WHEN** any time-entry endpoint is called without a valid session
- **THEN** the system SHALL respond with HTTP 401

#### Scenario: Missing CSRF token rejected
- **WHEN** a mutating time-entry request is made without a valid CSRF token
- **THEN** the system SHALL reject the request