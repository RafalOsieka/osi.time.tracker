## MODIFIED Requirements

### Requirement: REQ-167 Settings preferences page
The `/settings` page SHALL present an authenticated preferences surface with:

1. **Language** — a control offering supported UI locales (`en`, `pl`); changing it SHALL apply immediately via the i18n locale cookie (internationalization) without a separate Save action.
2. **Theme** — a 3-way control for `light`, `dark`, and `system`; changing it SHALL apply immediately via the color-mode cookie (ui-theming) without a separate Save action.
3. **Timezone** — a filterable select populated from `Intl.supportedValuesOf('timeZone')` that, when no timezone is saved, pre-selects the browser-detected timezone and shows a localized "detected" hint; changing the value SHALL immediately persist via partial `PATCH /api/user/settings` with `{ timezone }` (REQ-166).
4. **Week start** — a control offering Monday and Sunday; changing the value SHALL immediately persist via partial `PATCH /api/user/settings` with `{ weekStart }` (REQ-166).

The page SHALL NOT require a form-level Save button. Successful applies SHALL be silent (no success toast or banner). Failed account-setting PATCHes SHALL surface a translated toast only (from the `{ messageKey, params }` contract or a repurposed settings error string) and SHALL leave the control in a consistent state after the attempt. Concurrent PATCHes for account fields SHALL use last-write-wins. Applied timezone and week-start changes SHALL re-render times and week groupings without a page reload. Controls SHALL meet WCAG 2.1 AA (labelled, keyboard operable), use Nuxt UI components, derive styling from theme tokens, keep form controls full-width (shared-ui-components), and keep all strings in `en`/`pl` parity.

#### Scenario: Detected timezone pre-selected with hint
- **WHEN** a user with no saved timezone opens `/settings`
- **THEN** the timezone select SHALL be pre-set to the browser-detected timezone and a localized hint SHALL identify it as detected

#### Scenario: Saving applies immediately
- **WHEN** the user selects a different timezone or week start on `/settings` (no Save button)
- **THEN** the system SHALL persist via partial PATCH, update session-backed settings, and re-render times and week groupings without a page reload; success SHALL be silent

#### Scenario: Timezone list is filterable
- **WHEN** the user types into the timezone select's filter
- **THEN** the option list SHALL narrow to matching IANA identifiers

#### Scenario: Save failure surfaces an error
- **WHEN** a timezone or week-start PATCH fails
- **THEN** a translated toast error SHALL be shown (toast only; no success banner), and the failure SHALL NOT leave the rest of the app in an unrecoverable state

#### Scenario: Language applies immediately
- **WHEN** the user selects a different supported locale on `/settings`
- **THEN** the UI language SHALL switch immediately and the locale cookie SHALL be updated; no account PATCH SHALL be required

#### Scenario: Theme applies immediately
- **WHEN** the user selects light, dark, or system on `/settings`
- **THEN** the app theme SHALL switch immediately and the color-mode preference SHALL persist across reloads; no account PATCH SHALL be required

#### Scenario: No Save button
- **WHEN** an authenticated user views `/settings`
- **THEN** the page SHALL NOT present a primary "Save settings" submit control for these preferences

#### Scenario: Rapid successive changes last-write-wins
- **WHEN** the user changes an account setting twice in quick succession before the first PATCH completes
- **THEN** the system SHALL treat the latest requested value as authoritative once outstanding requests settle
