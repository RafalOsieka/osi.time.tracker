## ADDED Requirements

### Requirement: REQ-402 Accessible theme control in the account menu
The application SHALL provide an authenticated theme control as a **Theme** submenu of the sidebar footer account menu (ui-shell REQ-405). The control SHALL NOT be on the `/profile` page and SHALL NOT be required on the `auth` layout. The submenu SHALL be a **3-way control** exposing `light`, `dark`, and `system` directly as items; `system` SHALL be reachable without a separate reset affordance. Selecting an item SHALL apply the theme immediately and persist it via the existing color-mode cookie mechanism (REQ-161). The current state SHALL be shown by a means other than color alone (a checked indicator with checked state exposed to assistive technology). The submenu SHALL be reachable on the expanded rail, the collapsed rail, and the mobile drawer. It SHALL be fully keyboard operable, and every item SHALL expose an accessible name, consistent with REQ-001 and REQ-003. All labels SHALL come from the i18n catalogs with `en`/`pl` parity.

#### Scenario: Theme control is in the account menu
- **WHEN** an authenticated user opens the sidebar footer account menu
- **THEN** a Theme submenu SHALL be present, offering Light, Dark, and System

#### Scenario: Theme is not on the profile page
- **WHEN** an authenticated user opens `/profile`
- **THEN** no theme control SHALL be rendered on the page

#### Scenario: Current theme is indicated
- **WHEN** the active preference is `dark` and the Theme submenu is opened
- **THEN** the Dark item SHALL be shown and exposed as checked, and Light and System as unchecked

#### Scenario: Submenu is keyboard operable
- **WHEN** a user opens the account menu and the Theme submenu using only the keyboard
- **THEN** each item SHALL be focusable with a visible focus indicator, expose an accessible name, and apply its theme on Enter/Space

#### Scenario: All three states are directly reachable
- **WHEN** a user opens the Theme submenu
- **THEN** each of `light`, `dark`, and `system` SHALL be selectable directly from it

#### Scenario: Available on the collapsed rail
- **WHEN** the desktop sidebar is collapsed and the user opens the avatar account menu
- **THEN** the same Theme submenu SHALL be available

#### Scenario: Manual override persists after change
- **WHEN** a user selects Light or Dark in the Theme submenu and reloads the page
- **THEN** the app SHALL render in the selected mode regardless of the OS preference

#### Scenario: Toggle label is internationalized
- **WHEN** the submenu renders its label and item labels
- **THEN** the strings SHALL come from the i18n catalogs with `en` and `pl` in parity

## REMOVED Requirements

### Requirement: REQ-163 Accessible theme control on Settings
**Reason**: The theme control moves from the settings page to an account menu submenu.
**Migration**: See REQ-402 Accessible theme control in the account menu.
