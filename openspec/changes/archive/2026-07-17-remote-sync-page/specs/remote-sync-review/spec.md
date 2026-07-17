## ADDED Requirements

### Requirement: REQ-TTR-114 Per-day Remote Sync page lists all of the day's tasks

The application SHALL provide a Remote Sync page for a specific day, reachable from each day header in the Timer view. The page SHALL list **all** Tasks that have time entries on that day, plus a "(no task)" bucket when untitled entries exist that day, so the page's total matches the Timer view's day total. The day boundary SHALL be computed in the user's configured timezone using the same rule as the Timer view. The page SHALL be private (authentication required) and SHALL be **review-only**: it SHALL NOT expose any push action or persist reviewed values.

#### Scenario: Open the Remote Sync page for a day
- **WHEN** an authenticated user activates the Remote Sync action on a Timer-view day
- **THEN** the application SHALL navigate to the Remote Sync page for that date and list every Task with entries on that day, including a read-only "(no task)" bucket when untitled entries exist

#### Scenario: Day with no entries
- **WHEN** the user opens the Remote Sync page for a day with no time entries
- **THEN** the page SHALL render a translated empty state and no task rows

#### Scenario: Cross-midnight entries follow the timezone day rule
- **WHEN** an entry starts near midnight in the user's timezone
- **THEN** it SHALL be attributed to the same day the Timer view attributes it to

#### Scenario: Unauthenticated access is redirected
- **WHEN** an unauthenticated visitor requests the Remote Sync page
- **THEN** the global guard SHALL redirect to `/login` with the page as the redirect target before any protected markup is sent

### Requirement: REQ-TTR-115 Explicit per-row state with stated reason

Each task row on the Remote Sync page SHALL be in exactly one explicit state, derived by a pure shared function: **read-only with a translated stated reason** — the Task has no Project (or no resolvable Client), the Client has no `RemoteSystemConfig`, or the configuration's system type is not implemented yet (e.g. `redmine`); **read-only but linkable** — the Task's configuration is usable but the Task has no `RemoteIssueRef`; or **manageable** — all prerequisites are met. The "(no task)" bucket SHALL always be read-only. Read-only rows SHALL still display the task name and original duration.

#### Scenario: Task without a Project is read-only
- **WHEN** a listed Task has no Project
- **THEN** its row SHALL be read-only and display a translated reason indicating the missing Client/Project

#### Scenario: Client without a remote configuration is read-only
- **WHEN** a listed Task's Client has no `RemoteSystemConfig`
- **THEN** its row SHALL be read-only and display a translated reason indicating the missing remote configuration

#### Scenario: Unsupported system type is read-only
- **WHEN** a listed Task's configuration has a system type without an implemented adapter (e.g. `redmine`)
- **THEN** its row SHALL be read-only and display a translated reason indicating the system is not supported yet

#### Scenario: Unlinked task is read-only but linkable
- **WHEN** a listed Task resolves to a usable OpenProject configuration but has no `RemoteIssueRef`
- **THEN** its row SHALL be read-only for duration and required fields while exposing an inline link action

#### Scenario: Fully eligible task is manageable
- **WHEN** a listed Task has a Project, a usable OpenProject configuration, and a `RemoteIssueRef`
- **THEN** its row SHALL be manageable, exposing the editable rounded duration and required-field controls

### Requirement: REQ-TTR-116 Original and editable rounded durations

Each task row SHALL display the **original duration** — the sum of that Task's entry durations for the day. Each **manageable** row SHALL additionally display a separately labeled, **editable rounded duration**, pre-filled by applying the Client configuration's rounding rule **once** to the summed duration via a shared pure utility (`none` passes the sum through; `up_15m`/`up_30m`/`up_1h` round up to the next multiple, leaving exact multiples unchanged and `0` as `0`). The user SHALL be able to override the rounded value; a value of `0` SHALL mark the task as excluded from any future push and SHALL display a translated hint. Edited values SHALL be page state only and SHALL NOT be persisted.

#### Scenario: Rounded default is computed once from the sum
- **WHEN** a manageable Task has entries summing to 50 minutes under an `up_15m` rule
- **THEN** its editable rounded duration SHALL be pre-filled with 60 minutes while the original duration still shows 50 minutes

#### Scenario: Exact multiple is unchanged
- **WHEN** a manageable Task's summed duration is already an exact multiple of the rounding increment
- **THEN** the pre-filled rounded duration SHALL equal the original duration

#### Scenario: User overrides the rounded value
- **WHEN** the user edits the rounded duration to a different valid value
- **THEN** the row SHALL retain the edited value as page state without any server persistence

#### Scenario: Zero excludes from a future push
- **WHEN** the user sets a manageable Task's rounded duration to 0
- **THEN** the row SHALL display a translated indication that the task is excluded from any future push

#### Scenario: Invalid duration input reverts
- **WHEN** the user enters a value that cannot be normalized to a valid duration
- **THEN** the field SHALL revert to the previous value without emitting a change

### Requirement: REQ-TTR-117 Required remote fields with fetched options and config-default pre-fill

For each **manageable** row, the Remote Sync page SHALL expose the remote system's required fields — for OpenProject, the time-entry **activity** — as a labeled select control. The available options SHALL be fetched from the remote system via the adapter using the configuration's transport (browser-direct or server proxy), once per remote configuration per page load, with browser-held credential rules unchanged. The control SHALL be pre-selected from the configuration's `requiredFieldDefaults` when the stored default matches a fetched option. Selected values SHALL be page state only and SHALL NOT be persisted. A failed options fetch SHALL show a translated inline error for the affected rows without blocking the rest of the page.

#### Scenario: Activities are fetched and selectable
- **WHEN** the page loads with manageable OpenProject rows
- **THEN** the adapter SHALL fetch the available time-entry activities once for that configuration and each manageable row SHALL offer them in a labeled select

#### Scenario: Config default pre-selects an activity
- **WHEN** the configuration's `requiredFieldDefaults` contains an activity matching a fetched option
- **THEN** that option SHALL be pre-selected on the row's activity control

#### Scenario: No matching default leaves the control unselected
- **WHEN** the configuration has no activity default or the default matches no fetched option
- **THEN** the activity control SHALL render unselected without an error

#### Scenario: Options fetch fails
- **WHEN** the remote activities request fails (credential rejected, CORS, network)
- **THEN** the affected rows SHALL show a translated accessible error state while other rows and page content remain functional

### Requirement: REQ-TTR-118 Day-review data is aggregated server-side and user-scoped

The application SHALL provide an authenticated read endpoint that returns the day-review aggregate for a given date: per task with entries that day — task identity and name, project and client names, the summed original duration, the Client configuration surface needed for state derivation (system type, rounding rule, required-field defaults, transport mode, base URL, configuration id), and the remote issue reference (remote issue ID and cached title) when present — plus the untitled-entries total. All data SHALL be scoped to the authenticated user; durations SHALL be returned unrounded; timestamps SHALL be ISO strings; no credential material SHALL ever be included. Invalid dates SHALL be rejected with a `{ messageKey, params }` validation error.

#### Scenario: Aggregate returns one row per task with config and link state
- **WHEN** an authenticated user requests the day review for a valid date
- **THEN** the response SHALL contain one row per Task with entries that day, carrying the summed duration, resolvable config surface, and issue reference when present

#### Scenario: Foreign data is never included
- **WHEN** another user has entries on the same date
- **THEN** the response SHALL contain only the authenticated user's tasks and entries

#### Scenario: Invalid date is rejected
- **WHEN** the date parameter is missing or not a valid calendar date
- **THEN** the endpoint SHALL respond with a 422 `{ messageKey, params }` validation error

#### Scenario: No credentials in the payload
- **WHEN** the day review is returned for clients with remote configurations
- **THEN** the payload SHALL include no API secret or credential material

### Requirement: REQ-TTR-119 Remote Sync page accessibility and i18n

The Remote Sync page SHALL meet WCAG 2.1 AA: row states and reasons SHALL be conveyed in text (not color alone), duration and field controls SHALL have accessible labels, asynchronous option loading and errors SHALL be announced via live regions, and all interactions SHALL be keyboard operable. All user-facing strings SHALL come from the i18n catalogs with `en`/`pl` parity, and stable `data-testid` hooks SHALL be provided for rows, states, durations, and field controls.

#### Scenario: States are announced as text
- **WHEN** a row is read-only for any reason
- **THEN** the reason SHALL be available as translated text to assistive technologies, not conveyed by styling alone

#### Scenario: Keyboard-only review
- **WHEN** a keyboard user tabs through the page
- **THEN** the day navigation, rounded-duration fields, activity selects, and inline link actions SHALL all be reachable and operable without a pointer
