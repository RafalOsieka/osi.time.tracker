## ADDED Requirements

### Requirement: REQ-501 Group row layout and live group
Each task group SHALL be a row of the shared column list (REQ-496) with the columns expansion, entry count, title, project, remote issue, duration and continue/stop. In the narrow layout (REQ-500) its first line SHALL hold expansion, count, title, duration and continue/stop, and its second line project and remote issue. A group holding the running entry SHALL show the shell widget's animated stop control, which stops it, and no separate live-status phrase.

#### Scenario: Wide list keeps a single-row group
- **WHEN** the timer view list is in its column layout
- **THEN** each group SHALL keep expansion, count, title, project, remote issue, duration and continue on one row, each in its column

#### Scenario: Narrow list uses a two-line group
- **WHEN** the timer view list uses the narrow layout
- **THEN** a group SHALL place count, title, duration and continue on its first line and project and remote issue on its second, without horizontal overflow

#### Scenario: Live group uses the shell stop control
- **WHEN** a group contains the running entry
- **THEN** the group SHALL NOT show a separate live-status phrase, and the group action SHALL be the same animated stop control as the shell timer widget

#### Scenario: Live group stop stops the running entry
- **WHEN** the user activates the stop control on a live group
- **THEN** the running entry SHALL stop through the shared timer stop operation

### Requirement: REQ-502 Entry rows use the group's columns
An expanded entry SHALL be a row of the same list: its editable title in the title column, its time-range field ending where the remote-issue column ends, its duration in the duration column and its delete control in the action column. In the narrow layout (REQ-500) its first line SHALL hold the time range, duration and delete control, and its second line the editable title.

#### Scenario: Entry duration lines up with the group
- **WHEN** a group is expanded in the column layout
- **THEN** each entry's duration SHALL share the group duration's end edge, and each delete control SHALL sit in the group's action column

#### Scenario: Entry title lines up with the group title
- **WHEN** a group is expanded in the column layout
- **THEN** each entry title SHALL start at the group title's start edge

#### Scenario: Narrow entry shows times first
- **WHEN** a group is expanded in the narrow layout
- **THEN** each entry SHALL show its time range, duration and delete control on its first line and its editable title on the second

### Requirement: REQ-503 One list across days
All loaded days SHALL share one list with one header row naming the Task, Project, Issue and Duration columns. Each day SHALL begin with a heading row holding its date and Remote Sync link, with the day total in the duration column. Rows added by load more or a refresh SHALL join the same columns.

#### Scenario: Days share their columns
- **WHEN** the timer view shows groups of two or more days
- **THEN** the project, issue and duration columns SHALL have the same edges in every day

#### Scenario: Day total sits in the duration column
- **WHEN** a day heading row is rendered
- **THEN** its total SHALL share the group durations' end edge, and its date and Remote Sync link SHALL sit at the row's start

#### Scenario: Loaded days join the same columns
- **WHEN** load more appends older days
- **THEN** their rows SHALL use the same columns and SHALL NOT change any column width

## REMOVED Requirements

### Requirement: REQ-457 Group header layout and live group
**Reason**: Group headers were laid out per row on a viewport breakpoint, and entry rows stayed one line even where their title had no room.
**Migration**: REQ-501 (group row and live group), REQ-502 (entry rows) and REQ-503 (one list across days), on the shared column list REQ-496 and its narrow layout REQ-500.
