## MODIFIED Requirements

### Requirement: REQ-165 Account-persisted timezone settings
The system SHALL persist an account-level `timezone` setting on the user record (an IANA timezone identifier, nullable — `NULL` meaning "not yet chosen"). Settings SHALL be scoped strictly to the authenticated user and SHALL survive across devices and sessions. The effective timezone SHALL be the stored value when present, otherwise the browser-detected timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`); the system SHALL NOT silently persist the detected timezone — persistence happens only when the user saves it on the settings page. The settings SHALL be included in the session payload (`AuthUser` boundary type) so they are available on first render without an extra request.

The system SHALL NOT persist a week-start preference. Any prior `weekStart` / `week_start` column or session field SHALL be removed.

For SSR and the first client hydration paint, when no timezone is saved, the effective display timezone SHALL resolve to a stable server-safe fallback (`UTC`) so server-rendered and first-client-render timezone-formatted strings match. After the client has mounted, when no timezone is saved, the effective timezone SHALL upgrade to the browser-detected timezone and timezone-formatted displays SHALL recompute from that value. When a timezone is saved, both SSR and client SHALL use the saved value with no post-mount upgrade. Server-side consumers that need day boundaries without a browser (including the timer-view feed, REQ-395) SHALL use the stored timezone when present, otherwise `UTC`.

#### Scenario: Defaults before any save
- **WHEN** a user who has never saved settings uses the app after client mount
- **THEN** times SHALL be displayed in the browser-detected timezone and no settings write SHALL occur

#### Scenario: Stored settings win over detection
- **WHEN** a user with a saved timezone opens the app in a browser whose local timezone differs
- **THEN** all times SHALL be displayed in the saved timezone, not the browser's

#### Scenario: Settings available at first render
- **WHEN** an authenticated page is server-rendered
- **THEN** the session payload SHALL already carry the user's timezone setting (null or IANA id) so no flash of browser-local rendering occurs for a user with a saved timezone

#### Scenario: Unsaved timezone is hydration-safe then upgrades
- **WHEN** an authenticated page is server-rendered for a user with no saved timezone and the client hydrates
- **THEN** the first paint on server and client SHALL use the same fallback timezone (`UTC`) for formatted displays, and after mount the effective timezone SHALL become the browser-detected timezone without a hydration mismatch on the initial paint

#### Scenario: No week-start setting
- **WHEN** settings are read from the database, session, or settings API
- **THEN** the payload SHALL NOT include a `weekStart` field

### Requirement: REQ-168 Timezone-aware date-time foundation
The application SHALL perform all timezone-sensitive date arithmetic (day keys, day/window boundaries, combining a wall-clock date and time into an instant) using the Temporal API via the `temporal-polyfill` package, and all human-readable formatting via `Intl` with an explicit `timeZone` option — replacing browser-local `Date` getter logic in the date utilities. Client display utilities SHALL be pure functions taking the effective `{ timeZone }` as an explicit parameter (no `weekStart`). Wall-clock→instant conversion SHALL use Temporal's `compatible` disambiguation so DST-ambiguous or skipped times resolve deterministically. Interop with date pickers that consume browser-local `Date` objects SHALL be confined to a dedicated adapter pair at the component boundary; no other code SHALL construct dates from browser-local getters. UTC ISO 8601 instants SHALL remain the only on-the-wire representation for create/update payloads, so changing the display timezone is a pure re-render for already-loaded entries.

The timer-view feed (REQ-395) is an intentional exception that performs server-side day-boundary logic in the feed timezone; other list endpoints that accept raw `[from, to)` instants (REQ-148) SHALL continue to perform no timezone logic.

#### Scenario: Day bucketing follows the configured timezone
- **WHEN** an entry's `startedAt` falls on different calendar days in the configured timezone versus the browser's
- **THEN** the entry SHALL be bucketed under the day derived from the configured timezone

#### Scenario: DST transition handled deterministically
- **WHEN** a user commits a wall-clock time that is skipped or repeated by a DST transition in their timezone
- **THEN** the conversion SHALL resolve via `compatible` disambiguation and produce a valid UTC instant without error

#### Scenario: Wire format unchanged
- **WHEN** any entry is created or edited under a non-browser timezone
- **THEN** the client SHALL still send UTC ISO 8601 instants for mutation payloads

#### Scenario: Week window honors week start
- **WHEN** date utilities are used for display grouping after week-start removal
- **THEN** they SHALL NOT require or apply a `weekStart` parameter (week-aligned windows are no longer part of settings)

#### Scenario: No week-start parameter in date utilities
- **WHEN** client date/window helpers are invoked for display grouping
- **THEN** they SHALL NOT require a `weekStart` argument
