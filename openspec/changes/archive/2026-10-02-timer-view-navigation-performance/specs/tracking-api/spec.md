## ADDED Requirements

### Requirement: REQ-395 Timer view feed API
The system SHALL expose an authenticated timer-view feed at `GET /api/time-entries/feed` that returns a page of the caller's time entries together with pagination metadata. The response SHALL be a DTO of the form `{ entries: TimeEntryDto[], hasMore: boolean, nextBefore: string | null }` where each `TimeEntryDto` matches the list shape of REQ-148 (task/project context, optional remote issue ref, ISO timestamps, no client/tracker display name), `hasMore` is true when at least one of the user's entries belongs to a local calendar day strictly older than the oldest day represented in `entries`, and `nextBefore` is an opaque-or-ISO cursor the client MUST pass to load the next page (or `null` when `hasMore` is false).

Day boundaries for the feed SHALL be computed in the **feed timezone**: the authenticated user's stored `timezone` when present, otherwise `UTC` (matching the SSR-safe effective timezone of REQ-165). The feed endpoint SHALL follow `core-api-conventions` for authentication and errors.

**Initial page** (neither `before` nor `from`): the server SHALL return all entries belonging to the user's newest **7** distinct local activity days (days with ≥1 entry), newest day first. Empty calendar gaps SHALL NOT consume a slot, so a user whose last activity is old still gets their newest activity days. A user with no entries at all SHALL receive `{ entries: [], hasMore: false, nextBefore: null }`. Entries started in the future relative to "now" SHALL be included like any other entry (the walk starts from the newest entry, not from today).

**Subsequent page** (`before` required): the server SHALL return all entries belonging to the next **7** distinct local activity days strictly older than the cursor, ordered newest day first within the page. It SHALL set `hasMore` / `nextBefore` from whether any older activity day remains. Empty calendar gaps between activity days SHALL NOT consume a slot in the "7 days" budget.

**Range refresh** (`from` required): the server SHALL return every entry of the user whose `startedAt` is at or after `from` (no upper bound), newest first. `hasMore` / `nextBefore` SHALL be computed from the oldest local day in the returned set exactly as for paged responses. When no entry starts at or after `from`, `hasMore` SHALL reflect whether any entry starts before `from`, and `nextBefore` SHALL be `from`'s local day start when it does. This mode lets a client re-fetch an already-loaded window in one request.

`before` and `from` SHALL be mutually exclusive; a request carrying both, or carrying a missing-offset, malformed, or otherwise invalid value for either, SHALL be rejected with a `422` `{ messageKey, params }` contract.

The existing range list (REQ-148) MAY remain for non-feed callers; the timer view page SHALL use the feed for its initial, load-more, and refresh loads.

#### Scenario: Initial feed returns newest seven activity days
- **WHEN** an authenticated user with entries on ten distinct local days requests the feed without `before` or `from`
- **THEN** the system SHALL return only the entries of the newest seven of those days, `hasMore` true, and a `nextBefore` equal to the local start of the oldest returned day

#### Scenario: Initial feed skips calendar gaps
- **WHEN** the user's newest entries lie 60 days in the past and nothing was tracked since
- **THEN** the initial feed SHALL return the newest seven activity days from that older period and SHALL NOT return an empty list

#### Scenario: Initial feed with fewer than seven activity days
- **WHEN** the user has entries on only three distinct local days
- **THEN** the initial feed SHALL return all of them with `hasMore` false and `nextBefore` null

#### Scenario: Never tracked returns empty feed
- **WHEN** the user has no time entries
- **THEN** the initial feed SHALL return empty `entries`, `hasMore` false, and `nextBefore` null

#### Scenario: Load more returns seven activity days
- **WHEN** the client requests the feed with a valid `before` cursor after a page that left older activity days
- **THEN** the system SHALL return entries for up to seven older distinct local days with entries, skipping empty calendar gaps, and set `hasMore` false when no older activity day remains

#### Scenario: Load more with no older history
- **WHEN** the client requests the next page but no older activity days exist
- **THEN** the system SHALL return empty `entries` (or an equivalent no-op page) with `hasMore` false

#### Scenario: Range refresh returns the whole loaded window
- **WHEN** the client requests the feed with `from` set to the local start of a day 20 activity days back
- **THEN** the system SHALL return every entry started at or after `from` in one response, with `hasMore` / `nextBefore` describing history older than the oldest returned day

#### Scenario: Range refresh with nothing in range
- **WHEN** the client requests the feed with `from` after the user's newest entry, and older entries exist
- **THEN** the system SHALL return empty `entries`, `hasMore` true, and `nextBefore` equal to `from`'s local day start

#### Scenario: Both cursors rejected
- **WHEN** the client sends both `before` and `from`
- **THEN** the system SHALL reject the request with `422` and a `{ messageKey, params }` body

#### Scenario: Malformed range start rejected
- **WHEN** the client sends `from` that is not an ISO datetime with offset
- **THEN** the system SHALL reject the request with `422` and a `{ messageKey, params }` body

#### Scenario: Feed uses stored timezone then UTC
- **WHEN** the user has a stored timezone `Europe/Warsaw`
- **THEN** activity-day counts and day boundaries SHALL use that timezone; when timezone is null the feed SHALL use `UTC`

#### Scenario: Other users never included
- **WHEN** another user has entries that would fall in the window
- **THEN** those entries SHALL NOT appear in the feed

#### Scenario: Unauthenticated rejected
- **WHEN** an unauthenticated client requests the feed
- **THEN** the system SHALL reject the request per shared authentication conventions

## REMOVED Requirements

### Requirement: REQ-264 Timer view feed API
**Reason**: The initial page changes from a 30-calendar-day window with a newest-day fallback to the newest seven activity days, and a `from` range-refresh mode is added. Its scenarios about the 30-day window and the fallback no longer describe the system.
**Migration**: Superseded by REQ-395 Timer view feed API (same endpoint and DTO). References to REQ-264 point to REQ-395.
