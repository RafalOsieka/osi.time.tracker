## REMOVED Requirements

### Requirement: REQ-399 User profile API
**Reason**: Its guarantee that the former settings endpoint stays absent only recorded a past removal.
**Migration**: Replaced by REQ-493 with the same profile API behavior.

### Requirement: REQ-400 Profile page
**Reason**: Its guarantee that the former settings page stays absent only recorded a past removal.
**Migration**: Replaced by REQ-494 with the same profile page behavior.

## ADDED Requirements

### Requirement: REQ-493 User profile API
`GET /api/user/profile` SHALL return `{ displayName, timezone }`; `PATCH /api/user/profile` SHALL accept a partial `{ displayName?, timezone? }`. `timezone` MUST be `UTC` or a member of `Intl.supportedValuesOf('timeZone')` (which omits `UTC`); `displayName` MUST satisfy REQ-397. Neither SHALL accept or return `weekStart`. A successful PATCH SHALL refresh the session with the new values and return the updated profile.

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

#### Scenario: Unauthenticated or CSRF-less request rejected
- **WHEN** the profile endpoints are called without a valid session, or the PATCH lacks a valid CSRF token
- **THEN** the system SHALL respond with HTTP 401 (or reject the request for a missing CSRF token) without touching the stored profile

### Requirement: REQ-494 Profile page
`/profile`, opened from the account menu (REQ-405), SHALL show an **Account** section — a labelled display-name field, the email read-only, and a filterable timezone select of `UTC` then `Intl.supportedValuesOf('timeZone')` — and a **Preferences** section with the browser's language control (REQ-401). It SHALL have no theme, week-start or Save control. Controls SHALL be keyboard operable and full-width (REQ-403), with `en`/`pl` parity.

#### Scenario: Profile shows stored values
- **WHEN** an authenticated user opens `/profile`
- **THEN** the display name field SHALL hold the stored display name, the email SHALL be shown read-only, and the timezone select SHALL show the stored timezone without a "detected" hint

#### Scenario: Timezone list is filterable
- **WHEN** the user types into the timezone select's filter
- **THEN** the option list SHALL narrow to matching IANA identifiers

#### Scenario: No theme, week-start, or Save control
- **WHEN** an authenticated user views `/profile`
- **THEN** the page SHALL NOT present a theme control, a week-start control, or a "Save" submit control

