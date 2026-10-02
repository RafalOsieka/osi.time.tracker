## ADDED Requirements

### Requirement: REQ-403 Full-width form controls in dialogs and the profile page
Overlay dialog forms (Nuxt UI `UModal` bodies that collect structured input, including project and tracker create/edit dialogs) and the `/profile` page SHALL render interactive form controls (`UInput`, `USelect`, `USelectMenu`, and equivalent Nuxt UI field controls) at the full width of their form column. Form stacks SHALL use a consistent vertical grid gap. Project and tracker create/edit dialogs SHALL use a consistent modal content max-width appropriate for form dialogs (e.g. `sm:max-w-lg`). This requirement does not force full-width styling on dense inline editors (timer row inline edits, compact table cells) outside dialog and profile form contexts.

#### Scenario: Project dialog controls span the form width
- **WHEN** the project create/edit dialog is open
- **THEN** its name input and tracker select SHALL stretch to the full width of the form column

#### Scenario: Tracker dialog controls span the form width
- **WHEN** the tracker create/edit dialog is open
- **THEN** its text inputs and selects SHALL stretch to the full width of the form column

#### Scenario: Profile controls span the form width
- **WHEN** an authenticated user views `/profile`
- **THEN** the display name input, the timezone and language selects, and equivalent field controls SHALL stretch to the full width of the profile form column

#### Scenario: Inline dense editors are out of scope
- **WHEN** a timer entry title or similar inline editor is shown outside a dialog or profile form
- **THEN** this requirement SHALL NOT force that control to full page width

## REMOVED Requirements

### Requirement: REQ-263 Full-width form controls in dialogs and settings
**Reason**: The settings surface is replaced by the profile page.
**Migration**: See REQ-403 Full-width form controls in dialogs and the profile page.
