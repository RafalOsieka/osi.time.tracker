# workspace-settings Specification

## Purpose
The user's account profile — display name and timezone — stored on the account, carried in the session for the first render, edited on `/profile`, and the timezone-aware date handling built on it. Times travel as UTC instants, so changing the timezone only re-renders. The profile API follows `core-api-conventions`.

## Requirements

### Requirement: REQ-168 Timezone-aware date-time foundation
Day keys, day boundaries and turning a wall-clock date and time into an instant SHALL use the user's timezone, never the browser's, and every displayed time SHALL be formatted in it. Skipped or repeated DST times SHALL resolve deterministically ("compatible" disambiguation). Payloads SHALL carry UTC ISO 8601 instants only, so a timezone change re-renders loaded entries. Only the feed (REQ-395) computes day boundaries on the server; other lists (REQ-148) SHALL do no timezone logic.

#### Scenario: Day bucketing follows the configured timezone
- **WHEN** an entry's `startedAt` falls on different calendar days in the configured timezone versus the browser's
- **THEN** the entry SHALL be bucketed under the day derived from the configured timezone

#### Scenario: DST transition handled deterministically
- **WHEN** a user commits a wall-clock time that is skipped or repeated by a DST transition in their timezone
- **THEN** the conversion SHALL resolve via `compatible` disambiguation and produce a valid UTC instant without error

#### Scenario: Wire format unchanged
- **WHEN** any entry is created or edited under a non-browser timezone
- **THEN** the client SHALL still send UTC ISO 8601 instants for mutation payloads

### Requirement: REQ-398 Required account timezone
Every user SHALL have a required IANA `timezone`, set at creation by any path, kept across devices. It SHALL be the only display timezone — no browser or server default, no change after mount — and SHALL ride in the session so server and first client paint format alike. Server code needing day boundaries (e.g. the feed, REQ-395) SHALL use it. A database upgraded from a version without it SHALL hold `UTC` for users who had none. No week-start preference SHALL be stored anywhere.

#### Scenario: Stored timezone drives display
- **WHEN** a user whose stored timezone is `Europe/Warsaw` opens the app in a browser whose local timezone differs
- **THEN** all times SHALL be displayed in `Europe/Warsaw`, not the browser's timezone

#### Scenario: Settings available at first render
- **WHEN** an authenticated page is server-rendered
- **THEN** the session payload SHALL already carry the user's timezone (an IANA id, never null), and the server and the first client paint SHALL format times in that timezone with no post-mount change

#### Scenario: Existing user without a timezone is migrated
- **WHEN** the migration runs against a database containing a user whose `timezone` is null
- **THEN** that user's `timezone` SHALL become `UTC` and the column SHALL reject null afterwards

#### Scenario: User cannot be stored without a timezone
- **WHEN** any code path attempts to insert a user without a timezone
- **THEN** the database SHALL reject the insert

#### Scenario: No week-start setting
- **WHEN** settings are read from the database, session, or profile API
- **THEN** the payload SHALL NOT include a `weekStart` field

### Requirement: REQ-399 User profile API
`GET /api/user/profile` SHALL return `{ displayName, timezone }`; `PATCH /api/user/profile` SHALL accept a partial `{ displayName?, timezone? }`. `timezone` MUST be `UTC` or a member of `Intl.supportedValuesOf('timeZone')` (which omits `UTC`); `displayName` MUST satisfy REQ-397. Neither SHALL accept or return `weekStart`. A successful PATCH SHALL refresh the session with the new values and return the updated profile. No `/api/user/settings` endpoint SHALL exist.

#### Scenario: Read profile
- **WHEN** an authenticated user requests their profile
- **THEN** the system SHALL return their current non-empty `displayName` and `timezone` without a `weekStart` field

#### Scenario: Save display name updates the session
- **WHEN** an authenticated user PATCHes `{ displayName: "  Jan Kowalski  " }`
- **THEN** the trimmed value `Jan Kowalski` SHALL be persisted, the session payload SHALL carry it, the timezone SHALL be unchanged, and the updated DTO SHALL be returned

#### Scenario: Save timezone updates the session
- **WHEN** an authenticated user PATCHes a valid timezone
- **THEN** the value SHALL be persisted, the session payload SHALL be refreshed with the new timezone, and the updated DTO SHALL be returned

#### Scenario: UTC is accepted
- **WHEN** an authenticated user PATCHes `{ timezone: "UTC" }`
- **THEN** the value SHALL be persisted even though `Intl.supportedValuesOf('timeZone')` does not list it

#### Scenario: Invalid timezone rejected
- **WHEN** a PATCH contains a timezone that is neither `UTC` nor present in `Intl.supportedValuesOf('timeZone')`
- **THEN** the system SHALL reject the request with HTTP 422 and `{ messageKey, params }`, and persist nothing

#### Scenario: Invalid display name rejected
- **WHEN** a PATCH contains a display name that is empty after trimming or longer than the REQ-397 limit
- **THEN** the system SHALL reject the request with HTTP 422 and `{ messageKey, params }` (including `max` for the length case), and persist nothing

#### Scenario: Null fields rejected
- **WHEN** a PATCH sets `displayName` or `timezone` to `null`
- **THEN** the system SHALL reject the request with HTTP 422 and persist nothing

#### Scenario: Week start field rejected or ignored as unsupported
- **WHEN** a PATCH body includes `weekStart`
- **THEN** the system SHALL NOT persist a week-start preference (reject unknown keys or strip them per project validation conventions) and SHALL NOT return `weekStart` on success

#### Scenario: Former settings endpoint is gone
- **WHEN** a client calls `GET /api/user/settings`
- **THEN** the server SHALL respond with HTTP 404

#### Scenario: Unauthenticated or CSRF-less request rejected
- **WHEN** the profile endpoints are called without a valid session, or the PATCH lacks a valid CSRF token
- **THEN** the system SHALL respond with HTTP 401 (or reject the request for a missing CSRF token) without touching the stored profile

### Requirement: REQ-400 Profile page
`/profile`, opened from the account menu (REQ-405), SHALL show an **Account** section — a labelled display-name field, the email read-only, and a filterable timezone select of `UTC` then `Intl.supportedValuesOf('timeZone')` — and a **Preferences** section with the browser's language control (REQ-401). It SHALL have no theme, week-start or Save control. Controls SHALL be keyboard operable and full-width (REQ-403), with `en`/`pl` parity. No `/settings` page or redirect SHALL exist.

#### Scenario: Profile shows stored values
- **WHEN** an authenticated user opens `/profile`
- **THEN** the display name field SHALL hold the stored display name, the email SHALL be shown read-only, and the timezone select SHALL show the stored timezone without a "detected" hint

#### Scenario: Timezone list is filterable
- **WHEN** the user types into the timezone select's filter
- **THEN** the option list SHALL narrow to matching IANA identifiers

#### Scenario: Former settings route is gone
- **WHEN** an authenticated user opens `/settings`
- **THEN** the application SHALL render its not-found page

#### Scenario: No theme, week-start, or Save control
- **WHEN** an authenticated user views `/profile`
- **THEN** the page SHALL NOT present a theme control, a week-start control, or a "Save" submit control

### Requirement: REQ-445 Profile fields save on their own
The display name SHALL save on blur or Enter as a partial PATCH of the trimmed value, only when it differs from the stored one; Escape, or an empty value, SHALL restore the stored value without a request. A timezone change SHALL save immediately. Saves SHALL be silent; a failure SHALL show only a translated toast and restore the stored value. Concurrent saves SHALL be last-write-wins. Saved values SHALL apply without a reload.

#### Scenario: Display name saves on blur
- **WHEN** the user changes the display name to `Jan Kowalski` and moves focus out of the field
- **THEN** the system SHALL PATCH `{ displayName: "Jan Kowalski" }`, the sidebar account control SHALL show `Jan Kowalski` without a reload, and no success message SHALL appear

#### Scenario: Display name saves on Enter
- **WHEN** the user edits the display name and presses Enter
- **THEN** the system SHALL save it exactly as on blur

#### Scenario: Unchanged display name sends nothing
- **WHEN** the user focuses the display name field and leaves it without changing the trimmed value
- **THEN** no PATCH SHALL be sent

#### Scenario: Empty display name is reverted
- **WHEN** the user clears the display name field and leaves it
- **THEN** the field SHALL show the stored display name again and no PATCH SHALL be sent

#### Scenario: Escape cancels the edit
- **WHEN** the user edits the display name and presses Escape
- **THEN** the field SHALL show the stored display name again and no PATCH SHALL be sent

#### Scenario: Display name save failure reverts
- **WHEN** a display name PATCH fails (validation or server error)
- **THEN** a translated toast error SHALL be shown and the field SHALL show the stored display name

#### Scenario: Timezone saves immediately
- **WHEN** the user selects a different timezone on `/profile`
- **THEN** the system SHALL persist it via partial PATCH, update the session-backed profile, and re-render times without a page reload; success SHALL be silent

#### Scenario: Timezone save failure reverts
- **WHEN** a timezone PATCH fails
- **THEN** a translated toast error SHALL be shown and the select SHALL show the stored timezone

#### Scenario: Rapid successive changes last-write-wins
- **WHEN** the user changes a profile field twice in quick succession before the first PATCH completes
- **THEN** the system SHALL treat the latest requested value as authoritative once outstanding requests settle

### Requirement: REQ-397 Required display name
Every user SHALL have a required `displayName` of 1 to 100 characters after trimming, stored trimmed, set at creation by any path and carried in the session. A database upgraded from a version without it SHALL hold the email's local part (the text before `@`) for users who had none or a blank one.

#### Scenario: Existing user without a display name is migrated
- **WHEN** the migration runs against a database containing a user `jan.kowalski@example.com` whose `displayName` is null
- **THEN** that user's `displayName` SHALL become `jan.kowalski` and the column SHALL reject null afterwards

#### Scenario: Blank display name is migrated like a missing one
- **WHEN** the migration runs and a user's `displayName` is an empty or whitespace-only string
- **THEN** it SHALL be replaced by the email local part

#### Scenario: Display name length limit
- **WHEN** a display name longer than 100 characters after trimming is submitted
- **THEN** the system SHALL reject it with a `{ messageKey, params }` error that includes `max: 100`
