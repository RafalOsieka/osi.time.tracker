## ADDED Requirements

### Requirement: REQ-398 Required account timezone
The system SHALL persist an account-level `timezone` on the user record as a required (non-null) IANA timezone identifier. The setting SHALL be scoped strictly to the authenticated user and SHALL survive across devices and sessions. The effective display timezone SHALL always be the stored value. The system SHALL NOT fall back to a browser-detected or server-default timezone for display, and SHALL NOT upgrade the timezone after client mount. The timezone SHALL be included in the session payload (`AuthUser` boundary type) so it is available on first render without an extra request. Server-rendered and client-rendered timezone-formatted strings SHALL therefore use the same zone from the first paint. Server-side consumers that need day boundaries without a browser (including the timer-view feed, REQ-395) SHALL use the stored timezone.

Existing users SHALL be migrated to `UTC` when no timezone was stored. Users created by any path (bootstrap seed, test helpers, future registration) SHALL receive a timezone at creation.

The system SHALL NOT persist a week-start preference. Any prior `weekStart` / `week_start` column or session field SHALL be removed.

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
The system SHALL expose `GET /api/user/profile` returning the authenticated user's profile DTO `{ displayName, timezone }`, and `PATCH /api/user/profile` accepting a partial update of `{ displayName?, timezone? }`. The former `/api/user/settings` endpoints SHALL be removed. Both endpoints SHALL require authentication via `requireAuth`. The PATCH SHALL be CSRF-protected and invoked client-side via `$csrfFetch` / `useCsrfFetch`. Request bodies SHALL be validated via a single zod schema in `shared/types`: `timezone` MUST be `UTC` or a member of `Intl.supportedValuesOf('timeZone')` (which omits `UTC`), and `displayName` MUST satisfy REQ-397. Validation failures SHALL be mapped to the `{ messageKey, params }` error contract via `mapZodError`. The schema and DTO SHALL NOT accept or return `weekStart`. On a successful PATCH the server SHALL update the session so the sealed cookie carries the new display name and timezone, and SHALL return the updated profile DTO.

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
The `/profile` page SHALL present the authenticated user's profile and preferences, reached from the account menu (ui-shell REQ-405). It SHALL replace the former `/settings` page, which SHALL no longer exist (no redirect). The page SHALL show, in an **Account** section:

1. **Display name**: a labelled text field holding the stored display name. Leaving the field (blur) or pressing Enter SHALL save the trimmed value via partial `PATCH /api/user/profile` with `{ displayName }` when it differs from the stored value. Escape SHALL restore the stored value. An empty or whitespace-only value SHALL restore the stored value without a request.
2. **Email**: the account email, read-only.
3. **Timezone**: a filterable select populated with `UTC` followed by `Intl.supportedValuesOf('timeZone')`, pre-selected with the stored timezone. Changing the value SHALL immediately persist via partial `PATCH /api/user/profile` with `{ timezone }`.

The page SHALL show, in a **Preferences** section, the language control (core-i18n REQ-401), labelled as applying to this browser. The page SHALL NOT contain a theme control (ui-theming REQ-402) or a week-start control. The page SHALL NOT have a form-level Save button.

Successful saves SHALL be silent (no success toast or banner). A failed profile PATCH SHALL show a translated toast only, and the failed control SHALL return to the stored value. Concurrent profile PATCHes SHALL be last-write-wins. Saved changes SHALL take effect without a page reload: a new display name SHALL appear in the account control, and a new timezone SHALL re-render times. Controls SHALL meet WCAG 2.1 AA (labelled, keyboard operable), use Nuxt UI components, use theme tokens for styling, stay full-width (ui-shared-components REQ-403), and keep all strings in `en`/`pl` parity.

#### Scenario: Profile shows stored values
- **WHEN** an authenticated user opens `/profile`
- **THEN** the display name field SHALL hold the stored display name, the email SHALL be shown read-only, and the timezone select SHALL show the stored timezone without a "detected" hint

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

#### Scenario: Timezone list is filterable
- **WHEN** the user types into the timezone select's filter
- **THEN** the option list SHALL narrow to matching IANA identifiers

#### Scenario: Timezone save failure reverts
- **WHEN** a timezone PATCH fails
- **THEN** a translated toast error SHALL be shown and the select SHALL show the stored timezone

#### Scenario: Former settings route is gone
- **WHEN** an authenticated user opens `/settings`
- **THEN** the application SHALL render its not-found page

#### Scenario: No theme, week-start, or Save control
- **WHEN** an authenticated user views `/profile`
- **THEN** the page SHALL NOT present a theme control, a week-start control, or a "Save" submit control

#### Scenario: Rapid successive changes last-write-wins
- **WHEN** the user changes a profile field twice in quick succession before the first PATCH completes
- **THEN** the system SHALL treat the latest requested value as authoritative once outstanding requests settle

### Requirement: REQ-397 Required display name
The system SHALL persist a required (non-null) `displayName` on the user record: a string of 1 to 100 characters after trimming surrounding whitespace, stored trimmed. The display name SHALL be included in the session payload. Existing users without a display name SHALL be migrated to the local part of their email (the text before `@`). Users created by any path SHALL receive a display name at creation.

#### Scenario: Existing user without a display name is migrated
- **WHEN** the migration runs against a database containing a user `jan.kowalski@example.com` whose `displayName` is null
- **THEN** that user's `displayName` SHALL become `jan.kowalski` and the column SHALL reject null afterwards

#### Scenario: Blank display name is migrated like a missing one
- **WHEN** the migration runs and a user's `displayName` is an empty or whitespace-only string
- **THEN** it SHALL be replaced by the email local part

#### Scenario: Display name length limit
- **WHEN** a display name longer than 100 characters after trimming is submitted
- **THEN** the system SHALL reject it with a `{ messageKey, params }` error that includes `max: 100`

## REMOVED Requirements

### Requirement: REQ-165 Account-persisted timezone settings
**Reason**: The timezone is now required, so the unsaved-timezone fallback and its scenarios no longer apply.
**Migration**: See REQ-398 Required account timezone.

### Requirement: REQ-166 User settings API
**Reason**: The settings API is replaced by the profile API, which also carries the display name.
**Migration**: Use `GET/PATCH /api/user/profile` (REQ-399); `/api/user/settings` is removed.

### Requirement: REQ-167 Settings preferences page
**Reason**: The settings page is replaced by the profile page; theme moves to the account menu and the detected-timezone hint is gone.
**Migration**: See REQ-400 Profile page at `/profile`.
