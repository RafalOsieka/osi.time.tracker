# user-settings Specification

## Purpose
Define account-level user preferences — the effective display timezone — together with their persistence model, API, settings page, and the timezone-aware date-time foundation that renders all times and day groupings according to those preferences. Settings are scoped to the authenticated user, survive across devices and sessions, ride along in the session payload for first-render availability, and change the UI as a pure client-side re-render (the on-the-wire representation remains UTC ISO 8601 instants). The settings API (REQ-166) follows the shared `api-endpoint-conventions` for authentication, CSRF, validation, and the error contract.

## Requirements

### Requirement: REQ-165 Account-persisted timezone settings
The system SHALL persist an account-level `timezone` setting on the user record (an IANA timezone identifier, nullable — `NULL` meaning "not yet chosen"). Settings SHALL be scoped strictly to the authenticated user and SHALL survive across devices and sessions. The effective timezone SHALL be the stored value when present, otherwise the browser-detected timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`); the system SHALL NOT silently persist the detected timezone — persistence happens only when the user saves it on the settings page. The settings SHALL be included in the session payload (`AuthUser` boundary type) so they are available on first render without an extra request.

The system SHALL NOT persist a week-start preference. Any prior `weekStart` / `week_start` column or session field SHALL be removed.

For SSR and the first client hydration paint, when no timezone is saved, the effective display timezone SHALL resolve to a stable server-safe fallback (`UTC`) so server-rendered and first-client-render timezone-formatted strings match. After the client has mounted, when no timezone is saved, the effective timezone SHALL upgrade to the browser-detected timezone and timezone-formatted displays SHALL recompute from that value. When a timezone is saved, both SSR and client SHALL use the saved value with no post-mount upgrade. Server-side consumers that need day boundaries without a browser (including the timer-view feed, REQ-264) SHALL use the stored timezone when present, otherwise `UTC`.

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

### Requirement: REQ-166 User settings API
The system SHALL expose `GET /api/user/settings` returning the authenticated user's settings DTO, and `PATCH /api/user/settings` accepting a partial update of `{ timezone }`. Both endpoints SHALL require authentication via `requireAuth`; the PATCH SHALL be CSRF-protected and invoked client-side via `$csrfFetch` / `useCsrfFetch`. Request bodies SHALL be validated via a single zod schema in `shared/types/user-settings.ts`: `timezone` MUST be a member of `Intl.supportedValuesOf('timeZone')`; validation failures SHALL be mapped to the `{ messageKey, params }` error contract via `mapZodError`. The schema and DTO SHALL NOT accept or return `weekStart`. On a successful PATCH the server SHALL update the session so the sealed cookie carries the new settings, and SHALL return the updated settings DTO.

#### Scenario: Read settings
- **WHEN** an authenticated user requests their settings
- **THEN** the system SHALL return their current `timezone` value (string or null) without a `weekStart` field

#### Scenario: Save settings updates the session
- **WHEN** an authenticated user PATCHes a valid timezone
- **THEN** the value SHALL be persisted, the session payload SHALL be refreshed with the new timezone, and the updated DTO SHALL be returned

#### Scenario: Invalid timezone rejected
- **WHEN** a PATCH contains a timezone not present in `Intl.supportedValuesOf('timeZone')`
- **THEN** the system SHALL reject the request with `{ messageKey, params }` and persist nothing

#### Scenario: Week start field rejected or ignored as unsupported
- **WHEN** a PATCH body includes `weekStart`
- **THEN** the system SHALL NOT persist a week-start preference (reject unknown keys or strip them per project validation conventions) and SHALL NOT return `weekStart` on success

#### Scenario: Unauthenticated or CSRF-less request rejected
- **WHEN** the settings endpoints are called without a valid session, or the PATCH lacks a valid CSRF token
- **THEN** the system SHALL respond with HTTP 401 (or reject the request for a missing CSRF token) without touching stored settings

### Requirement: REQ-167 Settings preferences page
The `/settings` page SHALL present an authenticated preferences surface with:

1. **Language** — a control offering supported UI locales (`en`, `pl`); changing it SHALL apply immediately via the i18n locale cookie (internationalization) without a separate Save action.
2. **Theme** — a 3-way control for `light`, `dark`, and `system`; changing it SHALL apply immediately via the color-mode cookie (ui-theming) without a separate Save action.
3. **Timezone** — a filterable select populated from `Intl.supportedValuesOf('timeZone')` that, when no timezone is saved, pre-selects the browser-detected timezone and shows a localized "detected" hint; changing the value SHALL immediately persist via partial `PATCH /api/user/settings` with `{ timezone }` (REQ-166).

The page SHALL NOT present a week-start control. The page SHALL NOT require a form-level Save button. Successful applies SHALL be silent (no success toast or banner). Failed account-setting PATCHes SHALL surface a translated toast only (from the `{ messageKey, params }` contract or a repurposed settings error string) and SHALL leave the control in a consistent state after the attempt. Concurrent PATCHes for account fields SHALL use last-write-wins. Applied timezone changes SHALL re-render times without a page reload. Controls SHALL meet WCAG 2.1 AA (labelled, keyboard operable), use Nuxt UI components, derive styling from theme tokens, keep form controls full-width (shared-ui-components), and keep all strings in `en`/`pl` parity.

#### Scenario: Detected timezone pre-selected with hint
- **WHEN** a user with no saved timezone opens `/settings`
- **THEN** the timezone select SHALL be pre-set to the browser-detected timezone and a localized hint SHALL identify it as detected

#### Scenario: Saving applies immediately
- **WHEN** the user selects a different timezone on `/settings` (no Save button)
- **THEN** the system SHALL persist via partial PATCH, update session-backed settings, and re-render times without a page reload; success SHALL be silent

#### Scenario: Timezone list is filterable
- **WHEN** the user types into the timezone select's filter
- **THEN** the option list SHALL narrow to matching IANA identifiers

#### Scenario: Save failure surfaces an error
- **WHEN** a timezone PATCH fails
- **THEN** a translated toast error SHALL be shown (toast only; no success banner), and the failure SHALL NOT leave the rest of the app in an unrecoverable state

#### Scenario: Language applies immediately
- **WHEN** the user selects a different supported locale on `/settings`
- **THEN** the UI language SHALL switch immediately and the locale cookie SHALL be updated; no account PATCH SHALL be required

#### Scenario: Theme applies immediately
- **WHEN** the user selects light, dark, or system on `/settings`
- **THEN** the app theme SHALL switch immediately and the color-mode preference SHALL persist across reloads; no account PATCH SHALL be required

#### Scenario: No week-start control
- **WHEN** an authenticated user views `/settings`
- **THEN** the page SHALL NOT present a Monday/Sunday week-start control

#### Scenario: No Save button
- **WHEN** an authenticated user views `/settings`
- **THEN** the page SHALL NOT present a primary "Save settings" submit control for these preferences

#### Scenario: Rapid successive changes last-write-wins
- **WHEN** the user changes an account setting twice in quick succession before the first PATCH completes
- **THEN** the system SHALL treat the latest requested value as authoritative once outstanding requests settle

### Requirement: REQ-168 Timezone-aware date-time foundation
The application SHALL perform all timezone-sensitive date arithmetic (day keys, day/window boundaries, combining a wall-clock date and time into an instant) using the Temporal API via the `temporal-polyfill` package, and all human-readable formatting via `Intl` with an explicit `timeZone` option — replacing browser-local `Date` getter logic in the date utilities. Client display utilities SHALL be pure functions taking the effective `{ timeZone }` as an explicit parameter (no `weekStart`). Wall-clock→instant conversion SHALL use Temporal's `compatible` disambiguation so DST-ambiguous or skipped times resolve deterministically. Interop with date pickers that consume browser-local `Date` objects SHALL be confined to a dedicated adapter pair at the component boundary; no other code SHALL construct dates from browser-local getters. UTC ISO 8601 instants SHALL remain the only on-the-wire representation for create/update payloads, so changing the display timezone is a pure re-render for already-loaded entries.

The timer-view feed (REQ-264) is an intentional exception that performs server-side day-boundary logic in the feed timezone; other list endpoints that accept raw `[from, to)` instants (REQ-148) SHALL continue to perform no timezone logic.

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
