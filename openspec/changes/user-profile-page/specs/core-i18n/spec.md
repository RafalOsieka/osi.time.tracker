## ADDED Requirements

### Requirement: REQ-401 Authenticated locale picker on Profile
The application SHALL provide an authenticated language control on the `/profile` page (workspace-settings REQ-400). It SHALL list the supported UI locales (`en` and `pl`) and SHALL indicate that the choice applies to this browser. Changing the selection SHALL call the i18n locale switch so the active locale updates immediately, document `lang` and the Nuxt UI locale stay in sync (REQ-075), and the locale cookie is written per REQ-074. The control SHALL NOT appear in the account menu or the shell chrome. The control SHALL be labelled, keyboard operable, and use catalog strings with `en`/`pl` parity for its label, hint, and option labels (`locale.en`, `locale.pl` or equivalent). The locale SHALL remain cookie-backed only. The system SHALL NOT persist the locale on the user record.

#### Scenario: Locale control is on Profile
- **WHEN** an authenticated user opens `/profile`
- **THEN** a language control listing English and Polish SHALL be present, with a hint that it applies to this browser

#### Scenario: Locale is not in the account menu
- **WHEN** the sidebar footer account menu is opened
- **THEN** language options SHALL NOT appear there

#### Scenario: Changing language applies without Save
- **WHEN** the user selects Polish on `/profile` while the active locale is English
- **THEN** the UI SHALL render Polish strings without a page reload and without a profile PATCH

#### Scenario: Locale cookie is updated
- **WHEN** the user changes the language on `/profile`
- **THEN** the locale cookie SHALL be written so the choice survives subsequent requests

#### Scenario: Locale is not stored on the account
- **WHEN** the user changes the language on `/profile` and then logs in from another browser with no locale cookie
- **THEN** the other browser SHALL resolve the locale from its own cookie, `Accept-Language`, or the default, not from the first browser's choice

#### Scenario: Control is accessible and internationalized
- **WHEN** the language control is rendered
- **THEN** it SHALL expose an accessible name from the i18n catalogs and remain fully keyboard operable

## REMOVED Requirements

### Requirement: REQ-262 Authenticated locale picker on Settings
**Reason**: The language control moves from `/settings` to `/profile`.
**Migration**: See REQ-401 Authenticated locale picker on Profile.
