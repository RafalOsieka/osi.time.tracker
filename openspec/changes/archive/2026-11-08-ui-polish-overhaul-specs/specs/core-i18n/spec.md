## ADDED Requirements

### Requirement: REQ-516 Spelled-out dates follow the locale's casing
Wherever a web app page spells out a weekday, a month or a period by name (day headings, the Remote Sync date, month steppers, summaries and dialog text), it SHALL use the active locale's own casing, without capitalizing the first letter. Polish weekdays and months SHALL therefore read in lower case, also at the start of a heading.

#### Scenario: Polish day heading
- **WHEN** the active locale is `pl` and a day heading shows Saturday, November 7, 2026
- **THEN** it SHALL read "sobota, 7 listopada 2026"

#### Scenario: Polish month period
- **WHEN** the active locale is `pl` and a month stepper shows November 2026
- **THEN** it SHALL read "listopad 2026"

#### Scenario: English keeps its own casing
- **WHEN** the active locale is `en`
- **THEN** weekday and month names SHALL be capitalized as English writes them ("Saturday, November 7, 2026")

## MODIFIED Requirements

### Requirement: REQ-401 Authenticated locale picker on Profile
The `/profile` page (workspace-settings REQ-494) SHALL offer a language control listing `en` and `pl` and stating that the choice applies to this browser. Changing it SHALL switch the active locale immediately (REQ-075) and write the locale cookie (REQ-074); the locale SHALL NOT be stored on the user record. The control SHALL NOT appear in the account menu or the shell chrome. It SHALL be labelled, keyboard operable, and translated with `en`/`pl` parity.

#### Scenario: Locale control is on Profile
- **WHEN** an authenticated user opens `/profile`
- **THEN** a language control listing English and Polish SHALL be present, with a hint that it applies to this browser

#### Scenario: Each language is named in itself
- **WHEN** the language control lists its options in either UI language
- **THEN** each option SHALL carry its own language's name for itself ("English", "Polski"), so a user who cannot read the active language still finds theirs

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
