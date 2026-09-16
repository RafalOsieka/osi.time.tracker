## MODIFIED Requirements

### Requirement: REQ-146 Persistent running-timer indicator
The application shell SHALL display an always-visible running indicator whenever the authenticated user has a running entry, showing the running entry's title and its live-updating elapsed time. The running state SHALL be sourced from the server (`GET /api/time-entries/running`) so it survives page reloads and is consistent across devices. On a full document load of an authenticated page, that fetch SHALL complete during SSR and seed shared timer state so the widget's running vs idle mode and title are correct on first paint (see frontend-shell REQ-258).

The timer widget's title input SHALL be bound to the running entry's title (`taskName`) whenever a timer is running (so the title remains visible after starting and after a reload). When the running entry is untitled (`taskName` is `null`), the title input SHALL be shown **blank** — it SHALL NOT show a placeholder and SHALL NOT show a "(no task)" label.

While the initial running-entry resolution is still in flight (including any client-only path that has not yet resolved), the widget SHALL expose a `loading` state and SHALL disable the title input and the start/stop toggle until the result is known; the widget SHALL NOT allow starting or editing against an unresolved pre-fetch idle state. When SSR has already resolved the running entry into shared state before first paint, the widget SHALL NOT remain in that disabled loading gate solely because a redundant client bootstrap has not run.

Live elapsed time SHALL be client-first: until the client ticker starts after hydration, the elapsed display SHALL show zero (`00:00:00` or equivalent) rather than a server-computed wall-clock duration. After the client ticker starts, elapsed time SHALL update from `startedAt` against the client clock at least once per second while running.

The running title SHALL be editable in place: an edit SHALL be committed via `PATCH /api/time-entries/[id]` (REQ-143) on blur or on Enter, and SHALL NOT be committed per keystroke. Committing a blank (empty or whitespace-only) title SHALL detach the task by sending `title = null`, resulting in `taskId = null`.

Pressing Enter in the title input SHALL start the timer when the suggestion overlay is closed; when the suggestion overlay is open, Enter SHALL retain the autocomplete's default select/close behavior and SHALL NOT start the timer.

While a timer is running, the elapsed-time display SHALL be an activatable control: activating it SHALL open a popover for editing the running entry's start, containing a date field and a single hour-and-minute time field, seeded with the entry's current start in the user's effective timezone (REQ-165, user-settings). The time field SHALL be the shared segmented clock-time field (REQ-361, shared-ui-components): digits typed into the hour and minute segments SHALL fill the time without a separate commit step (`9` `0` `0` fills `09:00`), and the field SHALL never hold an invalid time. The date field SHALL be the shared segmented date field with its calendar affordance (REQ-359, shared-ui-components): digits typed into the day, month, and year segments SHALL fill the date without a separate commit step, the field SHALL never hold an invalid date, and a day chosen from the calendar popover SHALL fill the segments. While either the date field or the time field is incomplete the save action SHALL be disabled and no request SHALL be sent. Opening the calendar popover from inside the start editor SHALL NOT dismiss the start editor, and choosing a day SHALL close only the calendar. Committing SHALL convert the combined date and time from the effective timezone to a UTC instant (REQ-168) and send it as `startedAt` via `PATCH /api/time-entries/[id]` (REQ-143); a resulting instant in the future SHALL be blocked client-side with an inline error. Past dates SHALL be allowed, so the elapsed time MAY legitimately exceed 24 hours. On success the widget SHALL update the running entry from the response and the elapsed ticker SHALL rebase from the new start; dismissing the popover without committing SHALL change nothing.

When a task edit affects the running entry (rename, project change, merge-on-collision, or bulk assignment binding the running entry to a task), the client SHALL re-fetch the running state (`GET /api/time-entries/running`) so the shell indicator reflects the updated title immediately.

The indicator and timer widget SHALL meet WCAG 2.1 AA (labelled controls, keyboard operable, disabled state conveyed) and derive styling from Nuxt UI `--ui-*` design tokens; all user-facing strings SHALL exist in `en` and `pl` in parity.

#### Scenario: Indicator visible while running
- **WHEN** the authenticated user has a running entry
- **THEN** the shell SHALL show a running indicator with the entry's title and a live elapsed time

#### Scenario: Title stays visible after starting
- **WHEN** the user starts a timer with a non-empty title
- **THEN** the title input SHALL continue to display that title rather than reverting to a placeholder

#### Scenario: Running state survives reload
- **WHEN** a user with a running entry reloads the app
- **THEN** the shell SHALL display the running entry (including its title) from the server-resolved state on first paint of the authenticated shell, without requiring a client-only post-mount fetch to reveal the running mode

#### Scenario: Elapsed starts at zero until client ticker
- **WHEN** a full document load completes for a user with a running entry
- **THEN** the elapsed display SHALL show zero until the client-side ticker starts, after which it SHALL show live elapsed computed on the client from `startedAt`

#### Scenario: Untitled running entry shows blank
- **WHEN** the running entry has no title (`taskName` is `null`)
- **THEN** the title input SHALL be blank, showing neither a placeholder nor a "(no task)" label

#### Scenario: Widget disabled during running fetch
- **WHEN** the running-entry result is not yet known (initial resolution still in flight)
- **THEN** the title input and the toggle button SHALL be disabled until the result resolves, after which they SHALL reflect the resolved state

#### Scenario: Inline retitle committed on blur or Enter
- **WHEN** the user edits the running entry's title and blurs the input or presses Enter
- **THEN** the widget SHALL commit the new title via `PATCH /api/time-entries/[id]` and update the displayed running entry from the response

#### Scenario: Clearing the title detaches the task
- **WHEN** the user clears the running entry's title to blank and commits (blur or Enter)
- **THEN** the widget SHALL send `title = null` and the entry SHALL become untitled (`taskId = null`)

#### Scenario: Enter starts the timer when no overlay is open
- **WHEN** the user presses Enter in the title input while no timer is running and the suggestion overlay is closed
- **THEN** the timer SHALL start

#### Scenario: Enter with the overlay open does not start
- **WHEN** the user presses Enter while the suggestion overlay is open
- **THEN** the autocomplete SHALL handle the Enter (select/close) and the timer SHALL NOT start

#### Scenario: Elapsed time opens the start edit popover
- **WHEN** the user activates the elapsed-time control while a timer is running
- **THEN** a popover SHALL open with a segmented date field (with calendar affordance) and a segmented hour-and-minute time field seeded with the running entry's current start in the user's effective timezone

#### Scenario: Typed time is normalized in the popover
- **WHEN** the user focuses the popover's time field and types `9` `0` `0`
- **THEN** the field SHALL show `09:00` without a separate commit step and the save action SHALL use that time

#### Scenario: Incomplete time blocks saving
- **WHEN** the user clears the minute segment of the popover's time field
- **THEN** the save action SHALL be disabled and no request SHALL be sent until the time is complete again

#### Scenario: Typed date commits in the popover
- **WHEN** the user focuses the popover's date field and types the digits of `9 July 2026` in the active locale's segment order
- **THEN** the field SHALL show `2026-07-09` in that locale's presentation and the save action SHALL use that date without a separate commit step

#### Scenario: Invalid typed date reverts
- **WHEN** the user types digits that do not form a valid segment value (for example `3` `5` into the day segment, or `1` `3` into the month segment)
- **THEN** the segment SHALL keep a valid value, the field SHALL never resolve to an invalid date, and no request SHALL be sent on that basis

#### Scenario: Calendar pick stays inside the start editor
- **WHEN** the user opens the date field's calendar from inside the start editor and chooses a day
- **THEN** the calendar SHALL close, the start editor SHALL remain open with the chosen day in the date field, and no request SHALL be sent until the user saves

#### Scenario: Incomplete date blocks saving
- **WHEN** the user clears a segment of the popover's date field
- **THEN** the save action SHALL be disabled and no request SHALL be sent until the date is complete again

#### Scenario: Committing a new start rebases the ticker
- **WHEN** the user commits a valid past start date/time in the popover
- **THEN** the running entry SHALL be patched with the new `startedAt` (converted from the effective timezone) and the elapsed time SHALL rebase from it, remaining running

#### Scenario: Future start blocked in the popover
- **WHEN** the popover's combined date and time resolve to a future instant
- **THEN** an inline error SHALL be shown and no request SHALL be sent

#### Scenario: Start moved to a previous day
- **WHEN** the user commits a start on an earlier date
- **THEN** the change SHALL be accepted and the elapsed time MAY display a duration exceeding 24 hours

#### Scenario: Task edit refreshes the indicator
- **WHEN** the user renames or re-projects the task of the running entry (including via a merge or bulk assignment)
- **THEN** the client SHALL re-fetch the running state and the indicator SHALL show the updated title

#### Scenario: Strings localized in parity
- **WHEN** new user-facing timer strings are added
- **THEN** they SHALL exist in both `en.json` and `pl.json` with matching keys

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

Group continue, bulk-assign for "(no task)", mini task editor, and remote-issue controls remain as specified in REQ-152, REQ-153, and related requirements (unchanged by this requirement's windowing rewrite).

#### Scenario: Entries grouped by effective-timezone day and task
- **WHEN** the authenticated user opens `/` with entries on multiple days in the feed
- **THEN** the page SHALL show one section per day in the effective timezone, newest first, each with a day total and per-task groups showing name, project context only (when present), entry count, and group total

#### Scenario: Group label omits tracker and client
- **WHEN** a task group belongs to a project that has a tracker
- **THEN** the group label SHALL show the project name only and SHALL NOT append a client or tracker name

#### Scenario: Day list renders client-side only
- **WHEN** the timer view is served with server-side rendering enabled
- **THEN** the initial feed payload SHALL be resolved during SSR and the day/group list (or never-tracked empty state) SHALL render from that payload on first paint (client-only-only rendering is no longer required)

#### Scenario: Fresh week opens on the latest tracked week
- **WHEN** the user opens `/` with no entries in the last 30 local days while older entries exist
- **THEN** the initial feed SHALL show the single newest local activity day rather than an empty week-aligned window

#### Scenario: Anchored week is signposted with a way back
- **WHEN** the initial feed uses the newest-day fallback or any period that is not "today's" rolling window alone
- **THEN** the page SHALL NOT show an anchored-week banner or reset-to-current-week control

#### Scenario: Current week is used when the newest entry is in it
- **WHEN** the user's newest entries fall within the last 30 local days
- **THEN** the initial list SHALL show the last-30-days feed content and SHALL NOT apply week-start alignment

#### Scenario: Never-tracked user sees a start-tracking empty state
- **WHEN** the user has no time entries at all
- **THEN** the page SHALL render the never-tracked empty state whose CTA focuses the timer widget and SHALL NOT offer "load more"

#### Scenario: Empty window with entries elsewhere offers load more
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

### Requirement: REQ-265 Timer view group and entry row density
On the timer view, each task group header and each expanded entry row SHALL keep its primary text inside a stable layout slot so long names do not overflow the row and so activating an inline editor does not shift neighboring controls. Each task group header SHALL be composed from the shared compact expandable-row shell (REQ-303): expansion, title (with entry-count indicator), project as secondary, remote-issue chrome as meta, group duration, and continue/stop as actions. Entry rows SHALL NOT use that shell.

When a group's task name, project context (including the localized "(no project)" placeholder), or an entry's title exceeds the space allocated to its slot, the visible text SHALL be truncated with an ellipsis. The complete string SHALL be available on pointer hover and on keyboard focus (a tooltip) and SHALL remain the control's accessible name. A value that already fits the slot SHALL omit the tooltip so the tip is not anchored to empty space in the slot. Activating a truncated title SHALL show the complete value in the editor.

On viewports at or above the authenticated shell's desktop rail breakpoint (frontend-shell REQ-066), a task group header SHALL occupy a single row. Below that breakpoint the header SHALL use two rows: expand control, entry-count indicator, title, group duration, and continue on the first row; project context and remote-issue chrome on the second. Entry rows SHALL remain a single row at both tiers. A group that contains the running entry SHALL NOT show a separate live-status phrase. That group SHALL show the same animated stop control as the shell timer widget; activating it SHALL stop the running entry. Idle groups keep the continue play control. The untitled "(no task)" group SHALL use the same title, project, and continue/stop controls as a named group; assigning a title SHALL reassign that day's untitled entries via the day-scoped reassignment operation. It SHALL NOT offer a separate bulk-assign button.

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

