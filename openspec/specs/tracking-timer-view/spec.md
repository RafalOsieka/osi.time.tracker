# tracking-timer-view Specification

## Purpose
Define the timer view rendered as the home page at `/`: the day/task-grouped list fed by the timer-view feed, load-more paging, the page-level manual-entry dialog, inline entry editing and deletion, group continue, the day-scoped mini task editor (name, project, remote issue picker), row density and truncation rules, and the page's accessibility and i18n guarantees. The endpoints it calls are specified in `tracking-api`; the remote-issue picker's server-side rules live in `remote-issue-linking`.

## Requirements

### Requirement: REQ-150 Timer view page
The application SHALL render the timer view as the home page at `/`. The page SHALL display the user's time entries grouped per calendar day using the user's effective timezone (REQ-165; day boundaries via REQ-168) from each entry's `startedAt`, newest day first. Days without entries SHALL NOT render empty sections. Within a day, entries SHALL be grouped by task: each task group SHALL show the task name with its **project** context only when present (no client or tracker secondary label), the group's total duration, and the entry count; expanding a group SHALL list its entries with start–stop times and derived duration. Untitled entries of a day SHALL collect in a "(no task)" group.

The page SHALL load its list from the timer-view feed (REQ-264). The **initial feed page SHALL be fetched during SSR** (authenticated request-forwarding as with other list pages) so the day/group list can render on first paint from the payload. Client regrouping when the effective timezone upgrades after mount (unsaved timezone → browser) is allowed; hard hydration failures MAY be fixed in a follow-up if they appear.

**Initial content rules** (as delivered by REQ-264, reflected in the UI):
- No entries at all → **never-tracked** empty state; the CTA SHALL focus the shell timer widget (`AppTimer`) and the page SHALL NOT show "load more".
- Entries present (30-day window or single newest-day fallback) → day list; "load more" only when `hasMore` is true.
- The page SHALL NOT render an "empty window with load more only" state and SHALL NOT render an anchored-week banner or "back to this week" control.

**Load more:** activating the control SHALL request the next feed page with the current `nextBefore` cursor and **append** the returned entries into the client list; when the response has `hasMore` false the control SHALL disappear. Load more SHALL add up to seven further **activity days**, not seven empty calendar days.

Each day section SHALL show a localized date heading, the day's total duration, and a **Remote Sync** navigation action for that day (`/sync/{dayKey}`). Day sections SHALL NOT host a per-day "add entry" control.

**Page-level add entry:** the page header SHALL provide a primary create action (same pattern as Trackers' "Add tracker" / shared table header). It SHALL open the manual-entry dialog with an optional title (task autocomplete), a **date** field defaulting to **today** in the effective timezone, and a start–end pair entered through one segmented time-range field (REQ-361) under a single label. Wall-clock date+times SHALL convert to instants in the effective timezone (REQ-168) and submit via `POST /api/time-entries` (REQ-140 manual pair); end before start SHALL be blocked client-side with an inline error, and an incomplete start or end SHALL block submission the same way. On success the page SHALL **smart-include** the new entry: if its local day is not yet in the loaded set, that day SHALL be added to the visible list so the entry is shown without requiring load more; `hasMore` SHALL remain consistent with whether older unloaded activity days still exist.

Each listed entry SHALL remain inline-editable (start, stop, title) and deletable with confirmation as previously required (REQ-143, REQ-151). Start and stop are edited through the row's segmented time field (REQ-361, layout per REQ-265); an edit SHALL change only the hour and minute of the edited bound and SHALL preserve the entry's stored seconds and milliseconds, so the patched instant differs from the stored one only in the segments the user changed. Committing a time field whose value is unchanged SHALL send no request. Because seconds are invisible, the row SHALL enable the field's same-minute clamp: when an edit leaves both bounds in the same minute with the start's seconds after the stop's, the edited bound SHALL take the other bound's seconds so the patch is accepted as a zero-duration entry instead of surfacing a "stopped before started" error. Retitling a single entry SHALL re-resolve only that entry's task. Cross-midnight start edits SHALL regroup under the new local day. The page SHALL observe the shell running-timer state and refresh/merge the list when the running entry stops or is replaced so finished work appears without a full navigation.

When the user's **timezone** setting changes, the page SHALL regroup already-loaded entries under the new day boundaries (pure re-render); a full feed refetch is NOT required for correctness of grouping of already-held entries.

Group continue, titling the "(no task)" group, mini task editor, and remote-issue controls remain as specified in REQ-152, REQ-153, and related requirements (unchanged by this requirement's windowing rewrite).

#### Scenario: Entries grouped by effective-timezone day and task
- **WHEN** the authenticated user opens `/` with entries on multiple days in the feed
- **THEN** the page SHALL show one section per day in the effective timezone, newest first, each with a day total and per-task groups showing name, project context only (when present), entry count, and group total

#### Scenario: Group label omits tracker and client
- **WHEN** a task group belongs to a project that has a tracker
- **THEN** the group label SHALL show the project name only and SHALL NOT append a client or tracker name

#### Scenario: Day list renders from the SSR-resolved feed
- **WHEN** the timer view is served with server-side rendering enabled
- **THEN** the initial feed payload SHALL be resolved during SSR and the day/group list (or never-tracked empty state) SHALL render from that payload on first paint (client-only-only rendering is no longer required)

#### Scenario: Stale history opens on the newest activity day
- **WHEN** the user opens `/` with no entries in the last 30 local days while older entries exist
- **THEN** the initial feed SHALL show the single newest local activity day rather than an empty week-aligned window

#### Scenario: No anchored-week banner or reset control
- **WHEN** the initial feed uses the newest-day fallback or any period that is not "today's" rolling window alone
- **THEN** the page SHALL NOT show an anchored-week banner or reset-to-current-week control

#### Scenario: Recent activity uses the rolling 30-day window
- **WHEN** the user's newest entries fall within the last 30 local days
- **THEN** the initial list SHALL show the last-30-days feed content and SHALL NOT apply week-start alignment

#### Scenario: Never-tracked user sees a start-tracking empty state
- **WHEN** the user has no time entries at all
- **THEN** the page SHALL render the never-tracked empty state whose CTA focuses the timer widget and SHALL NOT offer "load more"

#### Scenario: History outside the window falls back instead of an empty state
- **WHEN** the user has history only outside the last 30 days
- **THEN** the page SHALL show the newest activity day (fallback) and SHALL NOT show a dedicated empty-window message whose only action is load more; further history uses load more only when `hasMore` is true after that fallback page

#### Scenario: Expanding a task group lists its entries
- **WHEN** the user expands a task group
- **THEN** the group SHALL list its individual entries with start/stop times and durations, each with inline edit and delete controls

#### Scenario: Untitled entries form the "(no task)" group
- **WHEN** a day contains entries with `taskId` `null`
- **THEN** those entries SHALL appear in a "(no task)" group for that day

#### Scenario: Load more pages further back
- **WHEN** the user activates "load more" while `hasMore` is true
- **THEN** the page SHALL append entries for up to seven older activity days; when a response reports `hasMore` false the control SHALL not be shown

#### Scenario: Add a manual entry to a day
- **WHEN** the user activates the page header add-entry action and submits a valid date, start/end pair, and optional title
- **THEN** a stopped entry SHALL be created for that date (times in the effective timezone) and appear under the matching day/task group

#### Scenario: Smart include outside loaded set
- **WHEN** the user creates a manual entry on a local day not currently present in the loaded feed
- **THEN** that day SHALL appear in the list with the new entry without requiring the user to press load more

#### Scenario: Manual form accepts compact typed times
- **WHEN** the user focuses the start group of the manual form's time-range field and types `9` `0` `0`
- **THEN** the start SHALL show `09:00` without a separate commit step and the form SHALL submit that time

#### Scenario: Manual form blocks inverted times
- **WHEN** the user submits the manual-entry form with an end time earlier than the start time
- **THEN** an inline error SHALL be shown and no request SHALL be sent

#### Scenario: Manual form blocks an incomplete time
- **WHEN** the user clears a segment of the start or end group and submits
- **THEN** an inline error SHALL be shown and no request SHALL be sent

#### Scenario: Inline edit of an entry's times
- **WHEN** the user changes a segment of an entry's start or stop in the row's time field and commits (focus leaving the field or Enter)
- **THEN** the entry SHALL be patched and the row, group, and day totals SHALL update from the response

#### Scenario: Invalid inline time reverts silently
- **WHEN** the user types digits that cannot form a valid segment value (e.g. `7` `5` into an entry's minute segment) or presses Escape while editing
- **THEN** the field SHALL keep a valid value (Escape restores the committed one), no invalid time SHALL be committed, and no request SHALL be sent on that basis

#### Scenario: Inline edit preserves stored seconds
- **WHEN** an entry stopped at `10:42:31` and the user changes its stop minute segment to `45` and commits
- **THEN** the patch SHALL set `stoppedAt` to `10:45:31` on the same day (seconds and milliseconds unchanged)

#### Scenario: Unchanged inline time sends no request
- **WHEN** an entry started at `10:42:17` and stopped at `10:42:31`, and the user focuses the stop minute segment, retypes `42`, and leaves the field
- **THEN** no request SHALL be sent and no error toast SHALL appear

#### Scenario: Same-minute inversion is clamped before patching
- **WHEN** an entry started at `10:42:50` and stopped at `10:43:10`, and the user changes the start minute segment to `43` and commits
- **THEN** the patch SHALL set `startedAt` to `10:43:10`, the server SHALL accept it, and the row SHALL show `10:43 – 10:43` with a zero duration

#### Scenario: Inline retitle splits the entry off
- **WHEN** the user retitles a single entry inside an expanded group
- **THEN** the entry SHALL move to the group of the re-resolved task and the remaining entries of the original group SHALL be unaffected

#### Scenario: Cross-midnight edit regroups the entry
- **WHEN** an inline `startedAt` edit moves an entry to a different day in the effective timezone
- **THEN** the page SHALL show the entry under the new day's section

#### Scenario: Top-bar stop refreshes the list
- **WHEN** the user stops the running timer from the top-bar widget while viewing the timer page
- **THEN** the page SHALL refresh or merge its entries so the finished entry appears in its day/task group without a manual reload

#### Scenario: Delete an entry with confirmation
- **WHEN** the user activates an entry's delete action and confirms
- **THEN** the entry SHALL be deleted, removed from the page, and a group left with no entries SHALL disappear

#### Scenario: Timezone change regroups without refetch
- **WHEN** the user changes their timezone setting while entries are displayed
- **THEN** the page SHALL regroup the loaded entries under the day boundaries of the new timezone without requiring a reload


### Requirement: REQ-152 Continue a task from the timer view
Each task group on the timer view SHALL offer a continue action that starts a new running entry via the existing `POST /api/time-entries`. The action SHALL pass the group's **task identity** so the new entry binds to that exact task and therefore **inherits its remote issue reference** as well as its project, rather than re-resolving the name and risking a different task under the most-recently-used tie-break (REQ-137). Stop-on-new-start (REQ-141) SHALL apply unchanged, and the shell's timer widget SHALL reflect the new running entry. The "(no task)" group SHALL offer the same continue/stop control (starting an untitled entry) and SHALL NOT offer a separate bulk-assign button; a title committed on it reassigns that day's untitled entries through the day-scoped reassignment operation (REQ-179), as specified in REQ-265.

#### Scenario: Continue starts a timer for the task
- **WHEN** the user activates continue on a task group
- **THEN** a new running entry SHALL be started bound to that group's task, stopping any currently running entry first

#### Scenario: Continue inherits the remote issue
- **WHEN** the user continues a task group that is linked to a remote issue
- **THEN** the new running entry SHALL be bound to that same linked task and SHALL show the same remote issue

#### Scenario: Continue is unambiguous under duplicate names
- **WHEN** the continued task shares its name and project with another task carrying a different remote issue
- **THEN** the new entry SHALL bind to the continued task and SHALL NOT be re-resolved to the other one

#### Scenario: Running entry reflected in the shell
- **WHEN** a continue action succeeds
- **THEN** the shell timer widget SHALL show the new running entry's title and live elapsed time

#### Scenario: Titling the "(no task)" group assigns the day's untitled entries
- **WHEN** the user commits a title on a day's "(no task)" group
- **THEN** all of that day's untitled entries SHALL be reassigned via the day-scoped reassignment operation and the page SHALL regroup them under the resolved task


### Requirement: REQ-153 Mini task editor on the timer view
Each task group on the timer view SHALL allow inline (in-place) editing of the task, replacing any modal editor: the task name, the project, and the remote issue SHALL each be editable directly in the group header.

Committing an inline group edit SHALL be **day-scoped**: it SHALL reassign only that day's entries of the group to the find-or-create target task via the day-scoped reassignment operation (REQ-179), passing the group's entry ids for that day. It SHALL NOT rename, re-project, or re-link the underlying task globally, so the same task's entries on other days SHALL be unaffected. This SHALL hold for **every** group-level edit without exception, including the remote issue: the timer view SHALL make no task-global mutation. When the group is the task's only day, the edit still goes through the day-scoped reassignment (move-only), which MAY leave the source task garbage-collected.

The group title SHALL be an activatable control that swaps to a text input; the edit SHALL be committed on blur or Enter and cancelled on Escape. A committed name that is empty or whitespace-only SHALL silently revert to the previous name without sending a request (a task cannot be unnamed).

The project context SHALL be an activatable control that swaps to a project select with a clear option; when the task has no project, the group SHALL render a localized "(no project)" placeholder that is equally activatable. The select SHALL include the task's current project as an option even when that project has been soft-deleted. Committing a selection (including clearing) SHALL reassign that day's entries per REQ-179; dismissing without selection SHALL change nothing. Project options SHALL be labeled by project name only (no client/tracker secondary segment).

The remote issue control (REQ-107) SHALL likewise commit through REQ-179, sending the chosen `remoteIssueId` — or an explicit `null` to unlink — together with that day's entry ids.

Inline editing SHALL be single-click and exclusive: at most one inline editor (group title, group project, or remote issue picker, across all groups and days) SHALL be active at a time. Activating an editor SHALL cancel any other active inline editor — reverting its control to the read-only display without committing — and SHALL immediately make the new editor ready for input: the swapped-in text input SHALL receive focus, and the swapped-in project select SHALL open its option list, so no second click is required.

On success the page SHALL update the affected groups (including regrouping when entries move between tasks) and refresh the running-timer state. The "(no task)" group SHALL offer the same inline title editor (committing a title reassigns that day's untitled entries), SHALL keep its project control disabled until a title exists, and SHALL NOT offer remote issue editing (it has no task); see REQ-265.

#### Scenario: Inline rename is day-scoped
- **WHEN** the user activates the group title, types a new name, and commits (blur or Enter)
- **THEN** only that day's entries SHALL move to the find-or-create target task via the day-scoped reassignment, and the same task's entries on other days SHALL keep the old name

#### Scenario: Rename onto an existing task merges that day's entries
- **WHEN** the user renames a day's group so it matches another existing task with the same remote issue state
- **THEN** that day's entries SHALL move into the existing task's group and the page SHALL show them under the survivor for that day

#### Scenario: Remote issue change is day-scoped
- **WHEN** the user links, replaces or unlinks the remote issue on a day's group while the same task has entries on other days
- **THEN** only that day's entries SHALL move to the find-or-create target task and the other days' groups SHALL keep their previous remote issue

#### Scenario: No task-global mutation from the timer view
- **WHEN** any group-level edit (title, project, or remote issue) is committed
- **THEN** the request SHALL be the day-scoped reassignment and the page SHALL make no call that mutates a task row directly

#### Scenario: Empty name silently reverts
- **WHEN** the user commits an empty or whitespace-only name in the inline title editor
- **THEN** the title SHALL revert to the previous name and no request SHALL be sent

#### Scenario: Escape cancels the inline edit
- **WHEN** the user presses Escape while editing the group title, choosing a project, or picking a remote issue
- **THEN** the edit SHALL be discarded and no request SHALL be sent

#### Scenario: Project changed inline is day-scoped
- **WHEN** the user activates the group's project context and selects a different project (or clears it)
- **THEN** only that day's entries SHALL be reassigned to the target task in the chosen project scope and the group SHALL show the updated context for that day

#### Scenario: Missing project shows a clickable placeholder
- **WHEN** a task group has no project assigned
- **THEN** the group SHALL render a localized "(no project)" placeholder that the user can activate to assign a project inline

#### Scenario: Project editor opens on a single click
- **WHEN** the user activates the group's project context (or the "(no project)" placeholder)
- **THEN** the project select SHALL render with its option list already open, without requiring a second click

#### Scenario: Activating one editor cancels another
- **WHEN** an inline editor is active in one group and the user activates a title, project or remote issue editor elsewhere (in the same or a different group)
- **THEN** the previously active editor SHALL close without committing, its control SHALL return to the read-only display, and the newly opened editor SHALL receive focus

#### Scenario: Soft-deleted project retained in the select
- **WHEN** the task's current project has been soft-deleted
- **THEN** the project select SHALL still list it as the current option

#### Scenario: No task group has no remote issue editor
- **WHEN** the "(no task)" group is rendered
- **THEN** it SHALL offer the inline title editor, SHALL keep the project control disabled with an accessible name explaining that a title is required first, and SHALL NOT offer a remote issue control

### Requirement: REQ-154 Accessible, localized, tokenized timer view
The timer view SHALL meet WCAG 2.1 AA: day and group structures SHALL use semantic headings/landmarks, expand/collapse controls SHALL be keyboard operable and expose their expanded state, action controls (continue, assign) SHALL be labelled, and the inline editors (group title, group project, entry fields, and the shared smart time inputs) SHALL be activatable buttons or labelled inputs with accessible names, keyboard operable including Escape to cancel, with the project select reachable and operable by keyboard. Interactive controls SHALL NOT be nested inside one another: a group header row that combines an expand/collapse action with inline edit triggers SHALL use a non-interactive layout container with the controls as siblings. The page SHALL prefer existing Nuxt UI components — edit triggers and inline editors SHALL use Nuxt UI `UButton` and `UInput`/`USelect` rather than native `<button>`/`<input>`/`<select>` elements, and any date entry SHALL follow REQ-359 (ui-shared-components) — derive styling from Nuxt UI `--ui-*` theme tokens (no ad-hoc inline colors), format dates and durations via the active locale, and keep all user-facing strings (including the "(no project)" placeholder) in `en` and `pl` in parity. Server/network failures SHALL surface as a Toast translated from the `{ messageKey, params }` contract.

#### Scenario: Group toggle is accessible
- **WHEN** a task group's expand control is rendered
- **THEN** it SHALL be keyboard operable and expose its expanded/collapsed state to assistive technology

#### Scenario: No nested interactive controls in the group header
- **WHEN** a group header renders the expand control together with the inline title/project edit triggers
- **THEN** the controls SHALL be rendered as siblings inside a non-interactive container, with no button or input nested inside another interactive element

#### Scenario: Inline group editors are accessible
- **WHEN** a task group's title and project context are rendered
- **THEN** they SHALL be activatable buttons with accessible names, and the swapped-in input/select SHALL be labelled, keyboard operable, and cancellable with Escape

#### Scenario: Native form elements are not used for editors
- **WHEN** the timer view renders an edit trigger, an inline editor, or the manual add-entry dialog's fields
- **THEN** they SHALL be Nuxt UI components (`UButton`, `UInput`, `USelect`, the shared time input, the shared date field) rather than native `<button>`, `<input>`, or `<select>` elements

#### Scenario: Strings localized in parity
- **WHEN** new user-facing timer-view strings are added
- **THEN** they SHALL exist in both `en.json` and `pl.json` with matching keys

#### Scenario: API failure surfaced
- **WHEN** a timer-view action fails with an API error
- **THEN** the client SHALL show a Toast translated from the returned `messageKey`


### Requirement: REQ-265 Timer view group and entry row density
On the timer view, each task group header and each expanded entry row SHALL keep its primary text inside a stable layout slot so long names do not overflow the row and so activating an inline editor does not shift neighboring controls. Each task group header SHALL be composed from the shared compact expandable-row shell (REQ-303): expansion, title (with entry-count indicator), project as secondary, remote-issue chrome as meta, group duration, and continue/stop as actions. Entry rows SHALL NOT use that shell.

When a group's task name, project context (including the localized "(no project)" placeholder), or an entry's title exceeds the space allocated to its slot, the visible text SHALL be truncated with an ellipsis. The complete string SHALL be available on pointer hover and on keyboard focus (a tooltip) and SHALL remain the control's accessible name. A value that already fits the slot SHALL omit the tooltip so the tip is not anchored to empty space in the slot. Activating a truncated title SHALL show the complete value in the editor.

On viewports at or above the authenticated shell's desktop rail breakpoint (ui-shell REQ-066), a task group header SHALL occupy a single row. Below that breakpoint the header SHALL use two rows: expand control, entry-count indicator, title, group duration, and continue on the first row; project context and remote-issue chrome on the second. Entry rows SHALL remain a single row at both tiers. A group that contains the running entry SHALL NOT show a separate live-status phrase. That group SHALL show the same animated stop control as the shell timer widget; activating it SHALL stop the running entry. Idle groups keep the continue play control. The untitled "(no task)" group SHALL use the same title, project, and continue/stop controls as a named group; assigning a title SHALL reassign that day's untitled entries via the day-scoped reassignment operation. It SHALL NOT offer a separate bulk-assign button.

The group's entry count SHALL be shown as a compact numeric indicator immediately to the left of the task title, with a fixed width that does not grow with the count. Visible text SHALL be the integer when the count is 1–9 and a capped `9+` marker when the count is greater than 9. The localized count phrase (one vs many, using the actual count) SHALL remain the indicator's accessible name and SHALL NOT be required as visible text. A group with one entry SHALL still show the numeric indicator.

Group and entry duration values SHALL use the same monospace, tabular-numeral presentation as the shell running-timer elapsed display. Those totals SHALL NOT be activating controls.

An expanded entry's start and stop SHALL be one permanently rendered segmented time-range field (REQ-361) in a none-variant presentation, occupying a fixed-width slot derived from the field's segment widths; there SHALL be no separate read-only display that swaps to an editor. A running entry SHALL render a single start field plus the localized "now" label inside a slot of the same width, so every row's time slot and the duration column align regardless of whether the entry has stopped. The field SHALL display complete `HH:mm` values without clipping. It SHALL edit wall-clock time on the entry's existing local calendar day only; this requirement does not add a date control.

Typing into a title, project, or time editor SHALL NOT grow or shrink the reserved slot or the surrounding row.

#### Scenario: Long task name truncates with a full-name tooltip
- **WHEN** a task group's name is longer than the title slot
- **THEN** the visible title SHALL end with an ellipsis, and hover or keyboard focus SHALL expose the complete name

#### Scenario: Fitting task name has no tooltip
- **WHEN** a task group's name fits entirely in the title slot
- **THEN** the group SHALL NOT show a title tooltip

#### Scenario: Long project context truncates
- **WHEN** a group's project name or "(no project)" placeholder is longer than the project slot
- **THEN** the visible project text SHALL be truncated and the complete string SHALL be available on hover or focus

#### Scenario: Long entry title truncates
- **WHEN** an expanded entry's title is longer than its title slot
- **THEN** the visible title SHALL be truncated and the complete string SHALL be available on hover or focus

#### Scenario: Activating a truncated title shows the full value
- **WHEN** the user activates a truncated group or entry title
- **THEN** the editor SHALL contain the complete current value

#### Scenario: Wide viewport keeps a single-row group header
- **WHEN** the timer view is shown at or above the shell desktop rail breakpoint
- **THEN** the group header SHALL keep expand, count, title, project, duration, remote-issue chrome, and continue on one row without horizontal overflow

#### Scenario: Narrow viewport uses a two-line group header
- **WHEN** the timer view is shown below the shell desktop rail breakpoint
- **THEN** the group header SHALL place count, title, duration, and continue on the first row and project and remote-issue chrome on the second, without horizontal overflow

#### Scenario: Entry count is a numeric indicator
- **WHEN** a group contains two or more entries and at most nine
- **THEN** the header SHALL show a compact numeric indicator to the left of the title whose visible text is that integer and whose accessible name is the localized many-count phrase

#### Scenario: Single-entry group still shows the count indicator
- **WHEN** a group contains exactly one entry
- **THEN** the header SHALL still show the numeric indicator `1` to the left of the title with the localized singular count phrase as its accessible name

#### Scenario: Entry count above nine is capped
- **WHEN** a group contains more than nine entries
- **THEN** the indicator's visible text SHALL be `9+` and its accessible name SHALL still use the actual count

#### Scenario: Durations match the shell elapsed presentation
- **WHEN** a group total, entry duration, or day-heading total is rendered
- **THEN** it SHALL use the same monospace tabular-numeral presentation as the shell running-timer elapsed display and SHALL NOT be an activating control

#### Scenario: Live group uses the shell stop control
- **WHEN** a group contains the running entry
- **THEN** the group SHALL NOT show a separate live-status phrase, and the group action SHALL be the same animated stop control as the shell timer widget

#### Scenario: Live group stop stops the running entry
- **WHEN** the user activates the stop control on a live group
- **THEN** the running entry SHALL stop through the shared timer stop operation

#### Scenario: Untitled group uses the same chrome as a named group
- **WHEN** a day's untitled entries are grouped
- **THEN** the group SHALL show the same title, project, and continue/stop controls as a named group and SHALL NOT offer a separate bulk-assign button

#### Scenario: Untitled title assign is day-scoped reassign
- **WHEN** the user commits a title on the untitled group
- **THEN** that day's untitled entry ids SHALL be sent to the day-scoped reassignment operation with the new name

#### Scenario: Project assign is disabled without a title
- **WHEN** a group has no task name
- **THEN** the project control SHALL be disabled and its accessible name SHALL explain that a title is required first

#### Scenario: Inline time editor shows a full HH:mm
- **WHEN** an expanded entry row is rendered
- **THEN** its start–stop field SHALL show both complete `HH:mm` values without clipping and without requiring activation

#### Scenario: Running and stopped rows align
- **WHEN** a group lists a running entry alongside stopped entries
- **THEN** the running row's start field plus "now" label SHALL occupy the same slot width as a stopped row's range field, and the duration column SHALL align across the rows

#### Scenario: Inline time edit stays on the same local day
- **WHEN** the user commits a new start or stop time from the expanded row
- **THEN** the entry SHALL keep its previous local calendar day and only the wall-clock time SHALL change

#### Scenario: Activating an editor does not jump the layout
- **WHEN** the user activates a group title, group project, or entry title control, or focuses a segment of an entry's time field
- **THEN** the reserved width of that control SHALL stay the same and neighboring controls SHALL NOT shift

#### Scenario: Typing does not resize the slot
- **WHEN** the user types a longer or shorter value in an active title, project, or time editor
- **THEN** the reserved slot and surrounding row SHALL NOT grow or shrink with the typed text

#### Scenario: Group header uses the shared compact row shell
- **WHEN** a timer task group header is rendered
- **THEN** its two-tier layout SHALL be the shared compact expandable-row shell used by Remote Sync day rows


### Requirement: REQ-107 Timer view remote issue picker
For each Task whose Project resolves to an active tracker, the Timer view SHALL display a compact two-part remote-issue control. For a linked Task, the first part SHALL be a `#<remoteIssueId>` link to the remote issue, with its URL derived from the tracker and issue ID and a tooltip containing the cached issue title and, when present, the cached remote project title. For an unlinked Task, the first part SHALL be a compact status icon whose accessible name and tooltip are the localized unlinked phrase; that phrase SHALL NOT appear as visible text. For a linked Task, hover or focus of that identifier SHALL reveal a dropdown with two actions, in this order: Edit (pencil icon plus the localized Edit label) and Unlink (localized Unlink label). Activating Edit, or the unlinked status icon, SHALL open a reusable search-and-attach `Popover`. Activating Unlink SHALL immediately perform the day-scoped unlink (REQ-105) with no confirmation dialog and SHALL NOT open the popover. The popover SHALL NOT contain an unlink action.

The popover SHALL open with **issue-ID** search selected, issue-ID listed first in the mode control, and keyboard focus on the query input. The query input SHALL be the primary control; the mode control SHALL be compact; Enter in the query input SHALL submit the search. Empty and error status SHALL appear only after a submit; the picker SHALL NOT show an empty-results phrase before the first search of that open. Each selectable result SHALL show the issue title on the first line and `#<remoteIssueId>` plus the remote project title when present on the second line. The result's accessible name SHALL include the issue id, title, and remote project title when present.

The picker SHALL expose translated validation, loading, empty, error, link, and replace states and SHALL meet WCAG 2.1 AA keyboard, labeling, focus, and status-announcement requirements. The issue link or status, dropdown actions, and other Task-row interactive controls SHALL remain siblings; interactive controls SHALL NOT be nested. When a Task cannot resolve a tracker (no project, local project, or missing tracker), the same slot SHALL still show a disabled compact unlinked-status icon so the group header layout stays aligned; that control SHALL NOT open the picker. The picker SHALL be enabled for every supported `systemType` with a registered adapter, including Redmine.

Committing a selection (link, replace or unlink) SHALL be **day-scoped**: the client SHALL send exactly the entry ids of that day's task group to the day-scoped reassignment operation (REQ-179) with the chosen remote issue (or an explicit null to unlink). It SHALL NOT mutate the underlying Task's reference, so the same Task's entries on other days SHALL be unaffected, and the group SHALL show the new reference for that day only. On success the page SHALL update the affected groups (including regrouping when entries move to another Task) and refresh the running-timer state.

The same reusable picker SHALL also be available inline on the Remote Sync page for a listed Task that resolves to a usable tracker but has no remote issue; because that page is scoped to a single local date, a successful link SHALL likewise reassign that date's entries for the row and SHALL update the row in place without a full page reload. The Remote Sync inline picker SHALL NOT gain an unlink control.

#### Scenario: Link from a Timer Task row
- **WHEN** the user activates the link action on an eligible Timer Task group
- **THEN** a labeled Popover SHALL open on issue-ID search with focus in the query input, and SHALL allow the user to switch mode, submit a query, and select a result by keyboard or pointer

#### Scenario: Picker defaults to issue-ID search
- **WHEN** the picker popover opens
- **THEN** issue-ID mode SHALL be selected, SHALL appear first in the mode control, and the query input SHALL have keyboard focus

#### Scenario: Result shows remote project title
- **WHEN** a search returns an issue that includes a remote project title
- **THEN** that result SHALL display the issue title, the `#<id>`, and the remote project title

#### Scenario: Result without a remote project title still selectable
- **WHEN** a search returns an issue with no remote project title
- **THEN** the result SHALL still be selectable and SHALL display the issue title and `#<id>` without a project line required

#### Scenario: Linking is day-scoped
- **WHEN** the user links a remote issue on a task group of one day while the same Task also has entries on other days
- **THEN** only that day's entries SHALL move to the Task carrying the issue, and the other days' groups SHALL keep their previous reference

#### Scenario: Unlink is in the linked dropdown
- **WHEN** a linked Task's identifier is hovered or focused
- **THEN** the dropdown SHALL show Edit and then Unlink, and the popover SHALL NOT contain an unlink action

#### Scenario: Unlink is instant
- **WHEN** the user activates Unlink in the linked dropdown
- **THEN** the system SHALL perform the day-scoped unlink immediately without a confirmation dialog and SHALL NOT open the picker

#### Scenario: Unlinking is day-scoped
- **WHEN** the user unlinks a remote issue on one day's task group
- **THEN** only that day's entries SHALL move to the unlinked Task and the other days SHALL keep their reference

#### Scenario: Linked Task displays cached data
- **WHEN** a Timer Task has a remote reference
- **THEN** its group row SHALL display `#<remoteIssueId>` as a direct link derived from the configured tracker URL and issue ID, show the cached issue title (and cached remote project title when present) in a tooltip on hover or focus, and reveal a dropdown with Edit then Unlink below or above the identifier

#### Scenario: Eligible Task is unlinked
- **WHEN** a Timer Task has an active tracker but no remote reference
- **THEN** its group row SHALL display a compact unlinked status icon whose accessible name and tooltip are a localized sentence that the task is not linked, and SHALL NOT display that sentence as visible text

#### Scenario: Unlinked icon and one-digit id share a slot
- **WHEN** one group is unlinked and another shows `#<single digit>`
- **THEN** both remote-issue controls SHALL occupy the same reserved width so the columns align

#### Scenario: Redmine search is available
- **WHEN** the Task's Project is attached to a Redmine tracker
- **THEN** the row SHALL display the same compact control with an enabled picker action, and the picker SHALL search Redmine issues via the configured execution mode

#### Scenario: Task cannot resolve a tracker
- **WHEN** a Task is project-less, its project is local, or its tracker is missing or deleted
- **THEN** the Timer row SHALL display a disabled compact unlinked-status icon in the same slot, whose accessible name and tooltip explain that a remote issue cannot be linked, and SHALL NOT open the picker

#### Scenario: Picker is keyboard accessible
- **WHEN** a keyboard user opens, searches, selects, or dismisses the picker
- **THEN** focus order, form controls, result announcements, selection, and dismissal SHALL remain operable without a pointer

#### Scenario: Empty state waits for a search
- **WHEN** the picker opens and the user has not submitted a query
- **THEN** the picker SHALL NOT announce an empty-results phrase

#### Scenario: Link inline from the Remote Sync page
- **WHEN** the user activates the inline link action on an unlinked Remote Sync row whose tracker is usable
- **THEN** the same picker Popover SHALL open, and a successful selection SHALL reassign that date's entries for the row and flip it to the manageable state in place


