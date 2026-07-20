# user-settings Specification

## Purpose
Define account-level user preferences — the effective display timezone and the week-start day — together with their persistence model, API, settings page, and the timezone-aware date-time foundation that renders all times and week groupings according to those preferences. Settings are scoped to the authenticated user, survive across devices and sessions, ride along in the session payload for first-render availability, and change the UI as a pure client-side re-render (the on-the-wire representation remains UTC ISO 8601 instants).

## Requirements
### Requirement: REQ-165 Account-persisted timezone and week-start settings
The system SHALL persist two account-level settings on the user record: `timezone` (an IANA timezone identifier, nullable — `NULL` meaning "not yet chosen") and `weekStart` (`monday` or `sunday`, defaulting to `monday`). Settings SHALL be scoped strictly to the authenticated user and SHALL survive across devices and sessions. The effective timezone SHALL be the stored value when present, otherwise the browser-detected timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`); the system SHALL NOT silently persist the detected timezone — persistence happens only when the user saves it on the settings page. The settings SHALL be included in the session payload (`AuthUser` boundary type) so they are available on first render without an extra request.

#### Scenario: Defaults before any save
- **WHEN** a user who has never saved settings uses the app
- **THEN** times SHALL be displayed in the browser-detected timezone and weeks SHALL start on Monday, and no settings write SHALL occur

#### Scenario: Stored settings win over detection
- **WHEN** a user with a saved timezone opens the app in a browser whose local timezone differs
- **THEN** all times SHALL be displayed in the saved timezone, not the browser's

#### Scenario: Settings available at first render
- **WHEN** an authenticated page is server-rendered
- **THEN** the session payload SHALL already carry the user's settings so no flash of browser-local rendering occurs for a user with saved settings

### Requirement: REQ-166 User settings API
The system SHALL expose `GET /api/user/settings` returning the authenticated user's settings DTO, and `PATCH /api/user/settings` accepting a partial update of `{ timezone, weekStart }`. Both endpoints SHALL require authentication via `requireAuth`; the PATCH SHALL be CSRF-protected and invoked client-side via `$csrfFetch` / `useCsrfFetch`. Request bodies SHALL be validated via a single zod schema in `shared/types/user-settings.ts`: `timezone` MUST be a member of `Intl.supportedValuesOf('timeZone')` and `weekStart` MUST be `monday` or `sunday`; validation failures SHALL be mapped to the `{ messageKey, params }` error contract via `mapZodError`. On a successful PATCH the server SHALL update the session so the sealed cookie carries the new settings, and SHALL return the updated settings DTO.

#### Scenario: Read settings
- **WHEN** an authenticated user requests their settings
- **THEN** the system SHALL return their current `timezone` and `weekStart` values

#### Scenario: Save settings updates the session
- **WHEN** an authenticated user PATCHes a valid timezone and week start
- **THEN** the values SHALL be persisted, the session payload SHALL be refreshed with them, and the updated DTO SHALL be returned

#### Scenario: Invalid timezone rejected
- **WHEN** a PATCH contains a timezone not present in `Intl.supportedValuesOf('timeZone')`
- **THEN** the system SHALL reject the request with `{ messageKey, params }` and persist nothing

#### Scenario: Unauthenticated or CSRF-less request rejected
- **WHEN** the settings endpoints are called without a valid session, or the PATCH lacks a valid CSRF token
- **THEN** the system SHALL respond with HTTP 401 (or reject the request for a missing CSRF token) without touching stored settings

### Requirement: REQ-167 Settings preferences page
The `/settings` page SHALL replace its "coming soon" placeholder with a preferences form containing: a filterable timezone `Select` populated from `Intl.supportedValuesOf('timeZone')` that, when no timezone is saved, pre-selects the browser-detected timezone and shows a localized "detected" hint; and a week-start `SelectButton` offering Monday and Sunday. Saving SHALL submit via the PATCH endpoint (REQ-166), show a success confirmation, and apply the new preferences to the app immediately (pure re-render, no reload). API failures SHALL surface via the `{ messageKey, params }` contract as translated messages. The form SHALL use PrimeVue components, meet WCAG 2.1 AA (labelled controls, keyboard operable), derive styling from theme tokens, and keep all strings in `en`/`pl` parity.

#### Scenario: Detected timezone pre-selected with hint
- **WHEN** a user with no saved timezone opens `/settings`
- **THEN** the timezone select SHALL be pre-set to the browser-detected timezone and a localized hint SHALL identify it as detected

#### Scenario: Saving applies immediately
- **WHEN** the user saves a different timezone or week start
- **THEN** the settings SHALL be persisted and all visible times and week groupings SHALL re-render using the new preferences without a page reload

#### Scenario: Timezone list is filterable
- **WHEN** the user types into the timezone select's filter
- **THEN** the option list SHALL narrow to matching IANA identifiers

#### Scenario: Save failure surfaces an error
- **WHEN** the PATCH request fails
- **THEN** a translated error message SHALL be shown and the form SHALL retain the user's input

### Requirement: REQ-168 Timezone-aware date-time foundation
The application SHALL perform all timezone-sensitive date arithmetic (day keys, day/window boundaries, week starts, combining a wall-clock date and time into an instant) using the Temporal API via the `temporal-polyfill` package, and all human-readable formatting via `Intl` with an explicit `timeZone` option — replacing browser-local `Date` getter logic in the date utilities. These utilities SHALL be pure functions taking the effective `{ timeZone, weekStart }` as explicit parameters. Wall-clock→instant conversion SHALL use Temporal's `compatible` disambiguation so DST-ambiguous or skipped times resolve deterministically. Interop with PrimeVue `DatePicker` (which consumes browser-local `Date` objects) SHALL be confined to a dedicated adapter pair at the component boundary; no other code SHALL construct dates from browser-local getters. UTC ISO 8601 instants SHALL remain the only on-the-wire representation, so changing settings is a pure client-side re-render.

#### Scenario: Day bucketing follows the configured timezone
- **WHEN** an entry's `startedAt` falls on different calendar days in the configured timezone versus the browser's
- **THEN** the entry SHALL be bucketed under the day derived from the configured timezone

#### Scenario: DST transition handled deterministically
- **WHEN** a user commits a wall-clock time that is skipped or repeated by a DST transition in their timezone
- **THEN** the conversion SHALL resolve via `compatible` disambiguation and produce a valid UTC instant without error

#### Scenario: Week window honors week start
- **WHEN** week boundaries are computed with `weekStart` set to `sunday`
- **THEN** the week window SHALL begin on Sunday 00:00 in the configured timezone

#### Scenario: Wire format unchanged
- **WHEN** any entry is created or edited under a non-browser timezone
- **THEN** the client SHALL still send UTC ISO 8601 instants and the server SHALL perform no timezone logic
