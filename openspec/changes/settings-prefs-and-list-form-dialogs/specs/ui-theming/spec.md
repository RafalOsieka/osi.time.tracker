## MODIFIED Requirements

### Requirement: REQ-163 Accessible theme control on Settings
The application SHALL provide an authenticated theme control on the `/settings` page (not in the top-bar utility menu and not required on the `auth` layout). The control SHALL be a **3-way control** exposing the `light`, `dark`, and `system` states directly (the `system` state SHALL be reachable without an additional separate reset affordance). Changing the selection SHALL apply immediately and persist via the existing color-mode cookie mechanism (REQ-161). The control SHALL expose a programmatic accessible name (visible text or `aria-label`), be fully keyboard operable with a visible focus indicator, and communicate the current state by means other than color alone (text, icon, or `aria-pressed`/equivalent), consistent with REQ-001 and REQ-003. All labels SHALL come from the i18n catalogs with `en`/`pl` parity.

#### Scenario: Theme control is on Settings
- **WHEN** an authenticated user opens `/settings`
- **THEN** a 3-way theme control SHALL be present on that page

#### Scenario: Theme is not in the utility menu
- **WHEN** the authenticated utility menu is opened
- **THEN** theme options SHALL NOT appear there

#### Scenario: Toggle is named and keyboard operable
- **WHEN** a user reaches the theme control using only the keyboard
- **THEN** it SHALL be focusable with a visible focus indicator, expose an accessible name, and switch the theme on Enter/Space (or equivalent selection)

#### Scenario: All three states are directly reachable
- **WHEN** a user operates the theme control
- **THEN** each of `light`, `dark`, and `system` SHALL be selectable directly from the control

#### Scenario: Manual override persists after change on Settings
- **WHEN** a user selects light or dark on `/settings` and reloads the page
- **THEN** the app SHALL render in the selected mode regardless of the OS preference

#### Scenario: Toggle label is internationalized
- **WHEN** the control renders its accessible name or option labels
- **THEN** the strings SHALL come from the i18n catalogs with `en` and `pl` in parity
