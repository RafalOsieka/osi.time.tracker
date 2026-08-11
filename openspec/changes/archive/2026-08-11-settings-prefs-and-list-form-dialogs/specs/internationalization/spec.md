## ADDED Requirements

### Requirement: REQ-262 Authenticated locale picker on Settings
The application SHALL provide an authenticated language control on the `/settings` page that lists the supported UI locales (`en` and `pl`). Changing the selection SHALL call the i18n locale switch so the active locale updates immediately, document `lang` and Nuxt UI locale stay in sync (REQ-075), and the locale cookie is written per REQ-074. The control SHALL NOT appear in the top-bar utility menu. The control SHALL be labelled, keyboard operable, and use catalog strings with `en`/`pl` parity for its label and option labels (`locale.en`, `locale.pl` or equivalent). Locale SHALL remain cookie-backed only; the system SHALL NOT persist locale on the user record in this change.

#### Scenario: Locale control is on Settings
- **WHEN** an authenticated user opens `/settings`
- **THEN** a language control listing English and Polish SHALL be present

#### Scenario: Locale is not in the utility menu
- **WHEN** the authenticated utility menu is opened
- **THEN** language options SHALL NOT appear there

#### Scenario: Changing language applies without Save
- **WHEN** the user selects Polish on `/settings` while the active locale is English
- **THEN** the UI SHALL render Polish strings without a page reload and without an account settings PATCH

#### Scenario: Locale cookie is updated
- **WHEN** the user changes the language on `/settings`
- **THEN** the locale cookie SHALL be written so the choice survives subsequent requests

#### Scenario: Control is accessible and internationalized
- **WHEN** the language control is rendered
- **THEN** it SHALL expose an accessible name from the i18n catalogs and remain fully keyboard operable
