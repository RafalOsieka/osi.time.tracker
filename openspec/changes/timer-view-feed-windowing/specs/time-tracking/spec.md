## ADDED Requirements

### Requirement: REQ-264 Timer view feed API
The system SHALL expose an authenticated timer-view feed at `GET /api/time-entries/feed` that returns a page of the caller's time entries together with pagination metadata. The response SHALL be a DTO of the form `{ entries: TimeEntryDto[], hasMore: boolean, nextBefore: string | null }` where each `TimeEntryDto` matches the list shape of REQ-148 (task/project context, optional remote issue ref, ISO timestamps, no client/tracker display name), `hasMore` is true when at least one of the user's entries belongs to a local calendar day strictly older than the oldest day represented in `entries`, and `nextBefore` is an opaque-or-ISO cursor the client MUST pass to load the next page (or `null` when `hasMore` is false).

Day boundaries for the feed SHALL be computed in the **feed timezone**: the authenticated user's stored `timezone` when present, otherwise `UTC` (matching the SSR-safe effective timezone of REQ-165). The feed endpoint SHALL follow `api-endpoint-conventions` for authentication and errors.

**Initial page** (no `before` query parameter):
1. If the user has no time entries at all, the response SHALL be `{ entries: [], hasMore: false, nextBefore: null }`.
2. Otherwise the server SHALL collect every entry of the user whose local day (from `startedAt` in the feed timezone) falls within the inclusive rolling window of the most recent **30** local calendar days ending on "today" in that timezone.
3. If that 30-day window yields zero entries while older entries exist, the server SHALL instead return **all** entries whose local day equals the local day of the user's newest entry (`max(startedAt)`), i.e. a single newest activity day.
4. `hasMore` / `nextBefore` SHALL reflect whether any entry exists on a strictly older local day than the oldest day in the returned set.

**Subsequent page** (`before` required): the server SHALL return all entries belonging to the next **7** distinct local activity days (days with ≥1 entry) strictly older than the cursor, ordered newest day first within the page, and SHALL set `hasMore` / `nextBefore` from whether any older activity day remains. A missing, malformed, or foreign cursor SHALL be rejected with `{ messageKey, params }` (or equivalent 422 contract). Empty calendar gaps between activity days SHALL NOT consume a slot in the "7 days" budget.

The existing range list (REQ-148) MAY remain for non-feed callers; the timer view page SHALL use the feed for its initial and load-more loads.

#### Scenario: Initial feed returns last 30 days of work
- **WHEN** an authenticated user with entries in the last 30 local days requests the feed without `before`
- **THEN** the system SHALL return those entries, `hasMore` true only if older activity days exist, and a usable `nextBefore` when `hasMore` is true

#### Scenario: Empty 30-day window falls back to newest activity day
- **WHEN** the user has no entries in the last 30 local days but has at least one older entry
- **THEN** the initial feed SHALL return all entries from the single local day of the newest entry and SHALL NOT return an empty list

#### Scenario: Never tracked returns empty feed
- **WHEN** the user has no time entries
- **THEN** the initial feed SHALL return empty `entries`, `hasMore` false, and `nextBefore` null

#### Scenario: Load more returns seven activity days
- **WHEN** the client requests the feed with a valid `before` cursor after a page that left older activity days
- **THEN** the system SHALL return entries for up to seven older distinct local days with entries, skipping empty calendar gaps, and set `hasMore` false when no older activity day remains

#### Scenario: Load more with no older history
- **WHEN** the client requests the next page but no older activity days exist
- **THEN** the system SHALL return empty `entries` (or an equivalent no-op page) with `hasMore` false

#### Scenario: Feed uses stored timezone then UTC
- **WHEN** the user has a stored timezone `Europe/Warsaw`
- **THEN** day windows and activity-day counts SHALL use that timezone; when timezone is null the feed SHALL use `UTC`

#### Scenario: Other users never included
- **WHEN** another user has entries that would fall in the window
- **THEN** those entries SHALL NOT appear in the feed

#### Scenario: Unauthenticated rejected
- **WHEN** an unauthenticated client requests the feed
- **THEN** the system SHALL reject the request per shared authentication conventions

## MODIFIED Requirements

### Requirement: REQ-150 Timer view page
The application SHALL render the timer view as the home page at `/`. The page SHALL display the user's time entries grouped per calendar day using the user's effective timezone (REQ-165; day boundaries via REQ-168) from each entry's `startedAt`, newest day first. Days without entries SHALL NOT render empty sections. Within a day, entries SHALL be grouped by task: each task group SHALL show the task name with its **project** context only when present (no client or tracker secondary label), the group's total duration, and the entry count; expanding a group SHALL list its entries with start–stop times and derived duration. Untitled entries of a day SHALL collect in a "(no task)" group.

The page SHALL load its list from the timer-view feed (REQ-264). The **initial feed page SHALL be fetched during SSR** (authenticated request-forwarding as with other list pages) so the day/group list can render on first paint from the payload. Client regrouping when the effective timezone upgrades after mount (unsaved timezone → browser) is allowed; hard hydration failures MAY be fixed in a follow-up if they appear.

**Initial content rules** (as delivered by REQ-264, reflected in the UI):
- No entries at all → **never-tracked** empty state; the CTA SHALL focus the shell timer widget (`AppTimer`) and the page SHALL NOT show "load more".
- Entries present (30-day window or single newest-day fallback) → day list; "load more" only when `hasMore` is true.
- The page SHALL NOT render an "empty window with load more only" state and SHALL NOT render an anchored-week banner or "back to this week" control.

**Load more:** activating the control SHALL request the next feed page with the current `nextBefore` cursor and **append** the returned entries into the client list; when the response has `hasMore` false the control SHALL disappear. Load more SHALL add up to seven further **activity days**, not seven empty calendar days.

Each day section SHALL show a localized date heading, the day's total duration, and a **Remote Sync** navigation action for that day (`/sync/{dayKey}`). Day sections SHALL NOT host a per-day "add entry" control.

**Page-level add entry:** the page header SHALL provide a primary create action (same pattern as Trackers' "Add tracker" / shared table header). It SHALL open the manual-entry dialog with an optional title (task autocomplete), a **date** field defaulting to **today** in the effective timezone, and start/end times via the shared smart time input (REQ-131). Wall-clock date+times SHALL convert to instants in the effective timezone (REQ-168) and submit via `POST /api/time-entries` (REQ-140 manual pair); end before start SHALL be blocked client-side with an inline error. On success the page SHALL **smart-include** the new entry: if its local day is not yet in the loaded set, that day SHALL be added to the visible list so the entry is shown without requiring load more; `hasMore` SHALL remain consistent with whether older unloaded activity days still exist.

Each listed entry SHALL remain inline-editable (start, stop, title) and deletable with confirmation as previously required (REQ-143, REQ-151). Retitling a single entry SHALL re-resolve only that entry's task. Cross-midnight start edits SHALL regroup under the new local day. The page SHALL observe the shell running-timer state and refresh/merge the list when the running entry stops or is replaced so finished work appears without a full navigation.

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
- **WHEN** the user types `900` into the manual form's start-time field and commits
- **THEN** the field SHALL normalize to `09:00` and the form SHALL submit that time

#### Scenario: Manual form blocks inverted times
- **WHEN** the user submits the manual-entry form with an end time earlier than the start time
- **THEN** an inline error SHALL be shown and no request SHALL be sent

#### Scenario: Inline edit of an entry's times
- **WHEN** the user edits an entry's start or stop time inline (including a compact form like `93` normalized to `09:30`) and commits (blur or Enter)
- **THEN** the entry SHALL be patched and the row, group, and day totals SHALL update from the response

#### Scenario: Invalid inline time reverts silently
- **WHEN** the user types a value that cannot be normalized to a valid time (e.g. `59`) into an entry's inline time field and commits
- **THEN** the field SHALL revert to the previous value and no request SHALL be sent

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

## REMOVED Requirements

### Requirement: REQ-236 Newest entry anchor endpoint
**Reason**: The timer view no longer anchors a week window on the client via a separate latest-instant probe; the feed (REQ-264) encodes never-tracked, 30-day window, and newest-day fallback server-side.
**Migration**: Delete `GET /api/time-entries/latest` and `LatestTimeEntryDto`; callers use `GET /api/time-entries/feed` instead. Update tests that asserted the latest endpoint or client anchor.
