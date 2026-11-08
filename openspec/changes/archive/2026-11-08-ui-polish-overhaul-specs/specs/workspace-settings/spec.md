## MODIFIED Requirements

### Requirement: REQ-494 Profile page
`/profile`, opened from the account menu (REQ-405), SHALL show an **Account** section (a labelled display-name field and the email read-only) and a **Preferences** section (a filterable timezone select of `UTC` then `Intl.supportedValuesOf('timeZone')`, and the browser's language control, REQ-401). It SHALL have no theme, week-start or Save control. Controls SHALL be keyboard operable and full-width (REQ-403), with `en`/`pl` parity.

#### Scenario: Profile shows stored values
- **WHEN** an authenticated user opens `/profile`
- **THEN** the display name field SHALL hold the stored display name, the email SHALL be shown read-only, and the timezone select SHALL show the stored timezone without a "detected" hint

#### Scenario: Timezone list is filterable
- **WHEN** the user types into the timezone select's filter
- **THEN** the option list SHALL narrow to matching IANA identifiers, each shown with its current UTC offset (for example `Europe/Warsaw (UTC+01:00)`)

#### Scenario: No theme, week-start, or Save control
- **WHEN** an authenticated user views `/profile`
- **THEN** the page SHALL NOT present a theme control, a week-start control, or a "Save" submit control

#### Scenario: Timezone sits with the preferences
- **WHEN** an authenticated user views `/profile`
- **THEN** the timezone select SHALL be in the Preferences section, beside the language control, and not in the Account section
