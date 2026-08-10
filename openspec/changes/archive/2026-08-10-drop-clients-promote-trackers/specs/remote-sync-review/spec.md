## MODIFIED Requirements

### Requirement: REQ-112 Explicit per-row state with stated reason
Each task row on the Remote Sync page SHALL expose exactly one effective state: **read-only with a translated stated reason** when the Task has no Project, the Project has no tracker, the tracker is soft-deleted/missing, the system type is unsupported, or a successful activity fetch yielded no activities; **read-only but linkable** when the tracker is usable but no remote issue reference exists; **temporarily unavailable with a retryable error** when required remote data failed to load; or **manageable** when every prerequisite is met. The "(no task)" bucket SHALL always be read-only. Read-only rows SHALL still display task name, entries, original duration, and any successfully loaded remote-log context.

#### Scenario: Task without a Project is read-only
- **WHEN** a listed Task has no Project
- **THEN** its row SHALL be read-only and display a translated reason indicating the missing Project

#### Scenario: Project without a tracker is read-only
- **WHEN** a listed Task's Project has no tracker (`trackerId` null)
- **THEN** its row SHALL be read-only and display a translated reason indicating the missing tracker

#### Scenario: Soft-deleted or missing tracker is read-only
- **WHEN** a listed Task's Project points at a missing or soft-deleted tracker
- **THEN** its row SHALL be read-only and display a translated reason indicating the missing tracker

#### Scenario: Unsupported system type is read-only
- **WHEN** a listed Task's tracker has a system type without an implemented adapter
- **THEN** its row SHALL be read-only and display a translated reason indicating the system is not supported yet

#### Scenario: Unlinked task is read-only but linkable
- **WHEN** a listed Task resolves to a usable tracker but has no remote issue reference
- **THEN** its row SHALL be read-only for export controls while exposing an inline link action

#### Scenario: Fully eligible task is manageable
- **WHEN** a listed Task is linked and all required remote data loaded successfully with at least one activity
- **THEN** its row SHALL be manageable and expose entry selection, duration, activity, and export controls

### Requirement: REQ-113 Original and editable rounded durations
Each task row SHALL display the **original duration**, calculated from all of that Task's entries for the day. Each manageable row SHALL additionally display the selected-entry total and a separately labeled editable export duration, pre-filled by applying the Project's active tracker's rounding rule once to the selected-entry total. Eligible completed entries SHALL be selected by default. A user override SHALL be retained when selection changes until explicitly reset. No selected entries or an export duration of `0` SHALL exclude the task from export. Reviewed values SHALL remain page state until a successful export is finalized.

#### Scenario: Rounded default is computed from selected entries
- **WHEN** selected entries sum to 50 minutes under an `up_15m` rule
- **THEN** the editable export duration SHALL default to 60 minutes while original and selected totals remain separately visible

#### Scenario: Exact multiple is unchanged
- **WHEN** the selected total is an exact multiple of the rounding increment
- **THEN** the default export duration SHALL equal the selected total

#### Scenario: Selection changes a non-overridden default
- **WHEN** the user changes entry selection before overriding the export duration
- **THEN** the application SHALL recompute the rounded default once from the new selected total

#### Scenario: Selection does not silently replace an override
- **WHEN** the user changes entry selection after overriding the export duration
- **THEN** the application SHALL retain the override until the user explicitly resets it

#### Scenario: Zero or empty selection excludes the task
- **WHEN** no entries are selected or the export duration is `0`
- **THEN** the task SHALL be excluded and display a translated explanation

#### Scenario: Invalid duration input reverts
- **WHEN** the user enters a value that cannot be normalized to a valid duration
- **THEN** the field SHALL revert to the previous value without emitting a change

### Requirement: REQ-115 Day-review data is aggregated server-side and user-scoped
The application SHALL provide an authenticated read endpoint that returns the day-review aggregate for a given date: per task with entries that day — task identity and name, project name, optional tracker name, the summed original duration, the Tracker configuration surface needed for state derivation (system type, rounding rule, required-field defaults, execution mode, base URL, tracker id), and the remote issue reference (remote issue ID and cached title) when present — plus the untitled-entries total. All data SHALL be scoped to the authenticated user; durations SHALL be returned unrounded; timestamps SHALL be ISO strings; no credential material SHALL ever be included. Invalid dates SHALL be rejected with a `{ messageKey, params }` validation error. The payload SHALL NOT include a Client identity or `clientName`.

#### Scenario: Aggregate returns one row per task with tracker and link state
- **WHEN** an authenticated user requests the day review for a valid date
- **THEN** the response SHALL contain one row per Task with entries that day, carrying the summed duration, resolvable tracker surface when present, and issue reference when present

#### Scenario: Foreign data is never included
- **WHEN** another user has entries on the same date
- **THEN** the response SHALL contain only the authenticated user's tasks and entries

#### Scenario: Invalid date is rejected
- **WHEN** the date parameter is missing or not a valid calendar date
- **THEN** the endpoint SHALL respond with a 422 `{ messageKey, params }` validation error

#### Scenario: No credentials in the payload
- **WHEN** the day review is returned for projects with trackers
- **THEN** the payload SHALL include no API secret or credential material
