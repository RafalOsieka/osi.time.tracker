## ADDED Requirements

### Requirement: REQ-396 Timer view page
The application SHALL render the timer view as the home page at `/`. The page SHALL display the user's time entries grouped per calendar day using the user's effective timezone (REQ-165; day boundaries via REQ-168) from each entry's `startedAt`, newest day first. Days without entries SHALL NOT render empty sections. Within a day, entries SHALL be grouped by task: each task group SHALL show the task name with its **project** context only when present (no client or tracker secondary label), the group's total duration, and the entry count; expanding a group SHALL list its entries with start–stop times and derived duration. Untitled entries of a day SHALL collect in a "(no task)" group.

The page SHALL load its list from the timer-view feed (REQ-395). The **initial feed page SHALL be fetched during SSR** (authenticated request-forwarding as with other list pages) so the day/group list can render on first paint from the payload. On **client-side navigation** to `/` the page SHALL render immediately without waiting for the feed (REQ-391): while the initial feed is pending and no entries are held, the page SHALL show a day-list loading skeleton (never the never-tracked empty state), then render the list when the feed arrives. Client regrouping when the effective timezone upgrades after mount (unsaved timezone → browser) is allowed; hard hydration failures MAY be fixed in a follow-up if they appear.

**Initial content rules** (as delivered by REQ-395, reflected in the UI):
- No entries at all → **never-tracked** empty state; the CTA SHALL focus the shell timer widget (`AppTimer`) and the page SHALL NOT show "load more".
- Entries present → day list of the newest seven activity days; "load more" only when `hasMore` is true.
- The page SHALL NOT render an "empty window with load more only" state and SHALL NOT render an anchored-week banner or "back to this week" control.

**Load more:** activating the control SHALL request the next feed page with the current `nextBefore` cursor and **append** the returned entries into the client list; when the response has `hasMore` false the control SHALL disappear. Load more SHALL add up to seven further **activity days**, not seven empty calendar days. Load more SHALL also trigger automatically as specified in REQ-392; the control SHALL remain available as a keyboard- and assistive-technology-reachable fallback.

Each day section SHALL show a localized date heading, the day's total duration, and a **Remote Sync** navigation action for that day (`/sync/{dayKey}`). Day sections SHALL NOT host a per-day "add entry" control.

**Page-level add entry:** the page header SHALL provide a primary create action (same pattern as Trackers' "Add tracker" / shared table header). It SHALL open the manual-entry dialog with an optional title (task autocomplete), a **date** field defaulting to **today** in the effective timezone, and a start–end pair entered through one segmented time-range field (REQ-361) under a single label. Wall-clock date+times SHALL convert to instants in the effective timezone (REQ-168) and submit via `POST /api/time-entries` (REQ-140 manual pair); end before start SHALL be blocked client-side with an inline error, and an incomplete start or end SHALL block submission the same way. On success the page SHALL **smart-include** the new entry: if its local day is not yet in the loaded set, that day SHALL be added to the visible list so the entry is shown without requiring load more; `hasMore` SHALL remain consistent with whether older unloaded activity days still exist.

Each listed entry SHALL remain inline-editable (start, stop, title) and deletable with confirmation as previously required (REQ-143, REQ-151). Start and stop are edited through the row's segmented time field (REQ-361, layout per REQ-265); an edit SHALL change only the hour and minute of the edited bound and SHALL preserve the entry's stored seconds and milliseconds, so the patched instant differs from the stored one only in the segments the user changed. Committing a time field whose value is unchanged SHALL send no request. Because seconds are invisible, the row SHALL enable the field's same-minute clamp: when an edit leaves both bounds in the same minute with the start's seconds after the stop's, the edited bound SHALL take the other bound's seconds so the patch is accepted as a zero-duration entry instead of surfacing a "stopped before started" error. Retitling a single entry SHALL re-resolve only that entry's task. Cross-midnight start edits SHALL regroup under the new local day. The page SHALL observe the shell running-timer state and refresh/merge the list when the running entry stops or is replaced so finished work appears without a full navigation.

When the user's **timezone** setting changes, the page SHALL regroup already-loaded entries under the new day boundaries (pure re-render); a full feed refetch is NOT required for correctness of grouping of already-held entries.

Group continue, titling the "(no task)" group, mini task editor, and remote-issue controls remain as specified in REQ-152, REQ-153, and related requirements.

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

#### Scenario: Old history opens on its newest activity days
- **WHEN** the user opens `/` and their newest entries are months old with nothing tracked since
- **THEN** the initial list SHALL show the newest seven local activity days of that history and SHALL NOT show a dedicated empty-window message whose only action is load more

#### Scenario: No anchored-week banner or reset control
- **WHEN** the initial list covers a period that does not include today
- **THEN** the page SHALL NOT show an anchored-week banner or reset-to-current-week control

#### Scenario: Initial list shows the newest seven activity days
- **WHEN** the user has entries on more than seven distinct local days
- **THEN** the initial list SHALL show exactly the newest seven of those days, SHALL NOT apply week-start alignment, and SHALL offer further history through load more

#### Scenario: Never-tracked user sees a start-tracking empty state
- **WHEN** the user has no time entries at all
- **THEN** the page SHALL render the never-tracked empty state whose CTA focuses the timer widget and SHALL NOT offer "load more"

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




### Requirement: REQ-392 Automatic load more on scroll
While `hasMore` is true, the timer view SHALL request the next feed page automatically when the end of the loaded day list scrolls into (or near) view, without requiring the user to activate "load more". At most one load-more request SHALL be in flight at a time. While a page is loading, the list end SHALL show a loading indicator announced politely to assistive technologies. A failed automatic load SHALL leave the "load more" control usable for a manual retry and SHALL NOT retry in a loop.

#### Scenario: Scrolling to the end loads older days
- **WHEN** `hasMore` is true and the user scrolls the end of the day list into view
- **THEN** the page SHALL append up to seven older activity days without the user activating "load more"

#### Scenario: No duplicate requests while loading
- **WHEN** the end of the list stays in view while a load-more request is in flight
- **THEN** the page SHALL NOT issue a second load-more request until the first one settles

#### Scenario: No automatic load when history is exhausted
- **WHEN** the last response reported `hasMore` false
- **THEN** reaching the end of the list SHALL NOT issue any feed request

#### Scenario: Failed automatic load falls back to the button
- **WHEN** an automatic load-more request fails
- **THEN** the page SHALL keep the already loaded days, SHALL show the "load more" control for a manual retry, and SHALL NOT repeatedly re-issue the failed request on its own

### Requirement: REQ-393 Single-request refresh of the loaded window
When the timer view refreshes its list after a mutation (entry edit, delete, add within the loaded range, continue, or the running entry stopping or being replaced), it SHALL re-fetch the whole loaded window in **one** feed request using the range-refresh mode of REQ-395 (`from` = the local start of the oldest loaded day), replacing the held entries with the response. The refresh SHALL NOT shrink the loaded window, and `hasMore` / `nextBefore` SHALL be taken from the response.

#### Scenario: Edit deep in loaded history refreshes in one request
- **WHEN** the user has loaded 28 activity days through load more and edits an entry
- **THEN** the page SHALL issue exactly one feed request to refresh the list and SHALL still show all 28 days afterwards

#### Scenario: Refresh keeps pagination consistent
- **WHEN** a refresh completes and older unloaded history exists
- **THEN** `hasMore` SHALL be true and the next load more SHALL continue from the oldest loaded day

#### Scenario: Failed refresh keeps the current list
- **WHEN** the refresh request fails
- **THEN** the page SHALL keep showing the previously held entries rather than clearing the list

### Requirement: REQ-394 Live duration updates scoped to the running entry
While a timer is running, the per-second live duration update SHALL change only the running entry's row duration, its task group's total, and its day's total. Stopped entries' groups and days SHALL NOT be recomputed or re-rendered by the tick. Displayed totals SHALL remain equal to the sum of their entries' durations, with the running entry measured up to the current second.

#### Scenario: Running group total ticks
- **WHEN** a timer is running and one second elapses
- **THEN** the running entry's row duration, its group total, and its day total SHALL each advance by one second

#### Scenario: Other groups are unaffected by the tick
- **WHEN** a timer is running and the page shows other task groups with only stopped entries
- **THEN** those groups' displayed totals SHALL stay constant and the tick SHALL NOT re-render them

#### Scenario: Totals include the running entry after it stops
- **WHEN** the running entry is stopped
- **THEN** its group and day totals SHALL show the stopped entry's final duration and SHALL stop advancing

## REMOVED Requirements

### Requirement: REQ-150 Timer view page
**Reason**: The initial list changes from a 30-calendar-day window with a newest-day fallback to the newest seven activity days, and client navigation renders a loading skeleton instead of waiting for the feed. Its scenarios about the 30-day window and the fallback no longer describe the system.
**Migration**: Superseded by REQ-396 Timer view page. Every other rule of REQ-150 carries over unchanged. References to REQ-150 point to REQ-396.
