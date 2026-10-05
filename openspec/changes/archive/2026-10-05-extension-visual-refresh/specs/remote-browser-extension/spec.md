## ADDED Requirements

### Requirement: REQ-408 Extension pages share the application's visual language

The extension popup and options page SHALL use the same component library, brand `primary` (cyan) and `neutral` (slate) palette, and default font stack as the web application. Each page header SHALL show the brand mark tinted with the `primary` color, next to the product name. Every icon on these pages SHALL ship inside the extension build. The pages SHALL NOT fetch icons, fonts, or styles over the network, and the extension's content security policy SHALL NOT be relaxed to allow it.

#### Scenario: Header shows the brand mark
- **WHEN** the popup or the options page opens in light or dark theme
- **THEN** its header SHALL show the open-dial brand mark in the theme's `primary` shade, next to "OSI Time Tracker"

#### Scenario: Pages render offline
- **WHEN** an extension page opens while the browser has no network access
- **THEN** every icon and style SHALL render, and the page SHALL make no network request to load them

#### Scenario: Popup status is a labelled badge
- **WHEN** the popup has loaded the approvals and some approved origin lacks browser site access
- **THEN** the header SHALL show a "Needs attention" badge, an alert SHALL explain the missing access, and the affected tracker row SHALL carry a "No access" badge
- **WHEN** every approval has site access
- **THEN** the badge SHALL read "Ready"

#### Scenario: Approval lists show access state per row
- **WHEN** the options page lists an approved website or tracker whose origin lacks browser site access
- **THEN** that row SHALL show a "No access" badge and a restore action, next to the revoke action
- **WHEN** a row's origin has site access
- **THEN** the row SHALL show only the revoke action

#### Scenario: Icon-only actions keep an accessible name
- **WHEN** a revoke action is rendered as an icon-only button
- **THEN** it SHALL expose an accessible name that includes the affected origin, and SHALL show a tooltip with the action name on hover and focus

#### Scenario: Loading failure keeps the retry path
- **WHEN** reading approvals or permissions fails on either page
- **THEN** the page SHALL show the translated error in an alert, together with the existing retry action

### Requirement: REQ-409 Extension theme control

The options page SHALL offer a Theme control with exactly two values, Light and Dark. Light SHALL be the default. The extension SHALL NOT follow the operating-system color scheme. The choice SHALL be a non-secret preference stored by the extension, apply to the popup and the options page, and be applied before the page's first paint. The control SHALL be labelled, keyboard operable, and translated in `en` and `pl`.

#### Scenario: Default is light regardless of OS preference
- **WHEN** a user with no stored theme opens an extension page while the OS prefers dark
- **THEN** the page SHALL render in the light theme

#### Scenario: Choice persists and applies everywhere
- **WHEN** the user selects Dark in the options page and then opens the popup or reloads the options page
- **THEN** both pages SHALL render in the dark theme without first painting the light theme

#### Scenario: Open pages follow a change
- **WHEN** the theme changes in one options tab while another extension page is open
- **THEN** the other page SHALL switch to the new theme without a reload

#### Scenario: Storage failure falls back to light
- **WHEN** the stored theme cannot be read, or holds an unknown value
- **THEN** the page SHALL render in the light theme and stay fully usable

#### Scenario: Theme is not a system option
- **WHEN** the user opens the Theme control
- **THEN** it SHALL list Light and Dark only

### Requirement: REQ-410 Extension shows the app icon

The extension manifest SHALL declare the app icon for the toolbar action and the browser's extensions page in 16, 32, 48 and 128 pixel raster sizes. The icon SHALL be the brand tile, a white glyph on the brand fill (ui-theming REQ-368), and SHALL be the same in light and dark browser themes.

#### Scenario: Toolbar shows the brand tile
- **WHEN** the built extension is loaded unpacked
- **THEN** the toolbar action and the extensions page SHALL show the brand tile icon instead of a generated letter placeholder

#### Scenario: Every declared size exists
- **WHEN** the extension build finishes
- **THEN** the build output SHALL contain a PNG for each size declared in the manifest, at its declared pixel dimensions

#### Scenario: A missing icon fails the build check
- **WHEN** a manifest icon path does not exist in the build output, or its PNG has other pixel dimensions than declared
- **THEN** the extension's build-output check SHALL fail
