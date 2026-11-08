## ADDED Requirements

### Requirement: REQ-521 Unavailable Export states why
While Export is disabled because nothing can be exported, it SHALL stay in place and give a short translated reason: the trackers cannot be reached when rows' activities failed to load, an activity is still needed when Ready rows with time lack one, otherwise that no task is ready. The reason SHALL be available on hover and keyboard focus (REQ-269) and SHALL show under the page header on wide layouts.

#### Scenario: Activity still needed
- **WHEN** the only Ready rows with time to send have no activity chosen
- **THEN** Export SHALL be disabled and its reason SHALL say that the tasks to send need an activity

#### Scenario: Trackers cannot be reached
- **WHEN** a row's activities failed to load and no row can be exported
- **THEN** Export's reason SHALL say that the trackers cannot be reached

#### Scenario: Reason from the keyboard
- **WHEN** a keyboard user moves focus to the disabled Export
- **THEN** the reason SHALL be shown in a tooltip and be part of what assistive technology reads

#### Scenario: Narrow layout keeps the tooltip
- **WHEN** the page is viewed at a narrow viewport and Export is disabled
- **THEN** the reason SHALL remain available from the tooltip, even where the line under the header is not shown

#### Scenario: Exporting is not a stated reason
- **WHEN** Export is disabled because an export is running
- **THEN** no reason SHALL be shown

## MODIFIED Requirements

### Requirement: REQ-229 Export runs through a review, running and report dialog

Activating Export SHALL open a confirmation listing only the included tasks, each with its title, destination and to-send duration.
Export SHALL include every Ready row with non-zero duration and a selected activity. No remote request SHALL occur before confirmation. Cancelling SHALL close the dialog without changing page state or tracker data. While export is running, duplicate confirmation SHALL be prevented.

#### Scenario: Review lists exactly what will be sent
- **WHEN** Export is activated with eligible rows
- **THEN** the dialog SHALL name the day, then list each included title, its destination (Tracker, issue and activity) and its duration, plus their total when more than one task is included

#### Scenario: One included task shows no separate total
- **WHEN** exactly one task is included
- **THEN** the dialog SHALL show its duration once, on its row, without a separate total

#### Scenario: Skipped tasks are stated with reasons
- **WHEN** the day contains ineligible tasks
- **THEN** their durable row states SHALL state why they are excluded, and the dialog SHALL count the tasks neither included nor Sent by reason in one line, without listing them

#### Scenario: Nothing is sent before confirmation
- **WHEN** the confirmation is open
- **THEN** no remote creation or local finalization SHALL have occurred

#### Scenario: Cancelling changes nothing
- **WHEN** the user cancels confirmation
- **THEN** no remote creation or local finalization SHALL occur

#### Scenario: Confirmation advances to the running phase
- **WHEN** the user confirms the batch
- **THEN** export SHALL begin and the dialog SHALL prevent dismissal or duplicate confirmation until complete

#### Scenario: Export is disabled when nothing is Ready
- **WHEN** no Ready row has non-zero duration and a selected activity
- **THEN** Export SHALL be disabled
