## MODIFIED Requirements

### Requirement: REQ-TTR-117 Required remote fields with fetched options and config-default pre-fill

For each **manageable** row, the Remote Sync page SHALL expose the remote system's required fields — for OpenProject, the time-entry **activity** — as a labeled select control. The available options SHALL be fetched from the remote system via the adapter using the configuration's transport (browser-direct or server proxy), **project-scoped** by posting the remote time-entry form keyed by the manageable row's linked work package, so the options reflect the activities enabled for that row's project. Options SHALL be fetched **once per resolved project/work package per page load**, deduplicated so that rows resolving to the same project reuse a single fetch, with browser-held credential rules unchanged. The control SHALL be pre-selected from the configuration's `requiredFieldDefaults` when the stored default matches a fetched option. Selected values SHALL be page state only and SHALL NOT be persisted. An empty options result SHALL render as a silent empty select without an error. A failed options fetch SHALL show a translated inline error for the affected rows without blocking the rest of the page.

#### Scenario: Activities are fetched and selectable

- **WHEN** the page loads with manageable OpenProject rows
- **THEN** the adapter SHALL fetch the available time-entry activities once per resolved project/work package and each manageable row SHALL offer that project's activities in a labeled select

#### Scenario: Rows sharing a project reuse one fetch

- **WHEN** multiple manageable rows resolve to the same project/work-package scope
- **THEN** the adapter SHALL fetch the activities once for that scope and reuse the result across those rows

#### Scenario: Config default pre-selects an activity

- **WHEN** the configuration's `requiredFieldDefaults` contains an activity matching a fetched option
- **THEN** that option SHALL be pre-selected on the row's activity control

#### Scenario: No matching default leaves the control unselected

- **WHEN** the configuration has no activity default or the default matches no fetched option
- **THEN** the activity control SHALL render unselected without an error

#### Scenario: Empty options render silently

- **WHEN** the project-scoped fetch returns no activities
- **THEN** the activity control SHALL render as an empty select without surfacing an error or hint

#### Scenario: Options fetch fails

- **WHEN** the remote activities request fails (credential rejected, CORS, network)
- **THEN** the affected rows SHALL show a translated accessible error state while other rows and page content remain functional
