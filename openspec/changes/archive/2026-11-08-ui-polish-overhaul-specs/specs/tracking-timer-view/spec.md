## ADDED Requirements

### Requirement: REQ-517 Manual entry dialog explains what it will create
The manual-entry dialog (REQ-455) SHALL tell the user what the entry will be before it is saved: how the title field works, the timezone its times are in, whether the title creates a Task, and the entry's length. These cues SHALL be translated and SHALL update as the fields change.

#### Scenario: Title help
- **WHEN** the manual-entry dialog is open
- **THEN** the title field SHALL say that a new title may be typed or an existing Task picked, with `@` picking a Project

#### Scenario: Times name their timezone
- **WHEN** the manual-entry dialog is open
- **THEN** the times SHALL show the effective timezone with its UTC offset on the chosen date

#### Scenario: A new Task is marked
- **WHEN** the user picks the create-new-task option (REQ-467) in the dialog's title field
- **THEN** the field SHALL show a "New task" cue with the entry's Project, or that it has none, until the title text is edited

#### Scenario: Length preview in words
- **WHEN** the start–end pair is complete and not inverted
- **THEN** the dialog SHALL preview the entry's length under the field in words (for example "1 godz. 30 min" in Polish), leaving out a zero part

#### Scenario: No preview for an inverted pair
- **WHEN** the end is earlier than the start
- **THEN** the dialog SHALL show the inline error (REQ-455) and no length preview

### Requirement: REQ-518 Issue picker context and keyboard picking
The issue picker (REQ-460), opened from a Timer group, SHALL name the Task, its day and its Tracker, since a link moves only that day's entries (REQ-461). Its mode control SHALL come before the query in reading and tab order. Once results are listed, the first SHALL be active and Enter SHALL link it until the query, mode or scope changes. The picker SHALL open below its row, scrolling the page first when that makes room.

#### Scenario: Picker names its day and Tracker
- **WHEN** the picker opens from a Timer group
- **THEN** its heading SHALL name the Task and one line under it SHALL name the group's day and the Tracker

#### Scenario: Mode control precedes the query
- **WHEN** the picker is open
- **THEN** the search mode control SHALL come before the query input in reading and tab order, and the query input SHALL still receive the initial focus

#### Scenario: Enter picks the active result
- **WHEN** a search has listed results and the query, mode and scope toggle are unchanged since
- **THEN** the first result SHALL be visibly active, the arrow keys SHALL move between the query and the results, and Enter in the query SHALL link the active result instead of searching again

#### Scenario: Edited query searches again
- **WHEN** the user edits the query after results were listed and presses Enter
- **THEN** the picker SHALL search again and focus SHALL stay in the query input

#### Scenario: Title search marks the match
- **WHEN** a title search returns results whose titles contain the searched text
- **THEN** that text SHALL be visibly marked inside each result title

#### Scenario: Picker opens below its row
- **WHEN** the user opens the picker on a row near the bottom of the viewport and the page can scroll
- **THEN** the page SHALL first scroll that row up so the popover opens below it; it SHALL open above the row only when the page cannot make room

## MODIFIED Requirements

### Requirement: REQ-396 Timer view page
The timer view at `/` SHALL group entries by the local day of `startedAt` in the user's timezone (REQ-398), newest first, skipping empty days, then by task. A group shows the task name with its project only, total and count, expanding into entries. A day shows its date, total and a Remote Sync link (`/sync/{dayKey}`), no add control. The first feed page SHALL render in SSR; client navigation shows a skeleton until it arrives (REQ-391). A timezone change SHALL regroup without refetching.

#### Scenario: Entries grouped by effective-timezone day and task
- **WHEN** the authenticated user opens `/` with entries on multiple days in the feed
- **THEN** the page SHALL show one section per day in the effective timezone, newest first, each with a day total and per-task groups showing name, project context only (when present), entry count, and group total

#### Scenario: Group label omits tracker and client
- **WHEN** a task group belongs to a project that has a tracker
- **THEN** the group label SHALL show the project name only and SHALL NOT append a client or tracker name

#### Scenario: Day list renders from the SSR-resolved feed
- **WHEN** the timer view is served with server-side rendering enabled
- **THEN** the initial feed payload SHALL be resolved during SSR and the day/group list (or never-tracked empty state) SHALL render from that payload on first paint

#### Scenario: Client navigation shows a skeleton, not the empty state
- **WHEN** the user navigates client-side to `/` and the feed response has not arrived yet
- **THEN** the page SHALL already be shown with a day-list loading skeleton and SHALL NOT show the never-tracked empty state, and SHALL replace the skeleton with the day list once the feed arrives

#### Scenario: Expanding a task group lists its entries
- **WHEN** the user expands a task group
- **THEN** the group SHALL list its individual entries with start/stop times and durations, each with inline edit and delete controls

#### Scenario: Untitled entries form the "(no task)" group
- **WHEN** a day contains entries with `taskId` `null`
- **THEN** those entries SHALL appear in a "(no task)" group for that day

#### Scenario: Timezone change regroups without refetch
- **WHEN** the user changes their timezone setting while entries are displayed
- **THEN** the page SHALL regroup the loaded entries under the day boundaries of the new timezone without requiring a reload

#### Scenario: Day heading spells out the date
- **WHEN** a day section is rendered
- **THEN** its heading SHALL show the full weekday, day, month name and year in the active locale's casing (core-i18n REQ-516), the same form the Remote Sync date uses

### Requirement: REQ-460 Remote issue picker popover
Edit, or the unlinked icon, SHALL open a reusable search popover with issue-ID mode selected and listed first, focus in the query input, and Enter searching or picking (REQ-518). Empty and error states SHALL appear only after a submit. Each result SHALL show the issue title, then `#<id>` and the remote project title when present, all in its accessible name. It SHALL have no unlink action, SHALL translate all its states, and SHALL meet WCAG 2.1 AA.

#### Scenario: Link from a Timer Task row
- **WHEN** the user activates the link action on an eligible Timer Task group
- **THEN** a labeled Popover SHALL open on issue-ID search with focus in the query input, and SHALL allow the user to switch mode, submit a query, and select a result by keyboard or pointer

#### Scenario: Picker defaults to issue-ID search
- **WHEN** the picker popover opens
- **THEN** issue-ID mode SHALL be selected, SHALL appear first in the mode control, and the query input SHALL have keyboard focus

#### Scenario: Result shows remote project title
- **WHEN** a search returns an issue that includes a remote project title other than the scoped project searched in
- **THEN** that result SHALL display the issue title, the `#<id>`, and the remote project title

#### Scenario: Scoped search names only other projects
- **WHEN** a search ran inside the Project's remote scope (REQ-328) and a result belongs to the scoped remote project itself
- **THEN** that result SHALL NOT repeat the scoped project's title visibly, SHALL keep it in its accessible name, and results from its subprojects SHALL still show their project title

#### Scenario: Result without a remote project title still selectable
- **WHEN** a search returns an issue with no remote project title
- **THEN** the result SHALL still be selectable and SHALL display the issue title and `#<id>` without a project line required

#### Scenario: Picker is keyboard accessible
- **WHEN** a keyboard user opens, searches, selects, or dismisses the picker
- **THEN** focus order, form controls, result announcements, selection, and dismissal SHALL remain operable without a pointer

#### Scenario: Empty state waits for a search
- **WHEN** the picker opens and the user has not submitted a query
- **THEN** the picker SHALL NOT announce an empty-results phrase
