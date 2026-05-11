## ADDED Requirements

### Requirement: Icon-only buttons must display tooltips
Every icon-only button in the Web frontend SHALL display a tooltip on hover that describes the expected action. An icon-only button is defined as a button that has an icon but no visible text label rendered alongside it. Buttons that have both an icon and a visible text label are excluded.

#### Scenario: Tooltip appears on hover for Projects table buttons
- **WHEN** the user hovers over an icon-only action button in the Projects table (Save, Cancel, Edit, Archive/Restore, Delete)
- **THEN** a tooltip with the corresponding action label SHALL appear above the button

#### Scenario: Tooltip appears on hover for Items table buttons
- **WHEN** the user hovers over an icon-only action button in the Items table (Rename, Match remote, Archive/Restore, Delete)
- **THEN** a tooltip with the corresponding action label SHALL appear above the button

#### Scenario: Dynamic archive/restore tooltip matches button state
- **WHEN** the user hovers over the Archive/Restore toggle button
- **THEN** the tooltip SHALL read "Archive project" (or "Archive item") when the entity is active, and "Restore project" (or "Restore item") when the entity is archived

### Requirement: Sidebar buttons must use v-tooltip instead of native title
The sidebar collapse toggle and mobile menu open button SHALL use PrimeVue's `v-tooltip` directive instead of native HTML `title` attributes, for consistency with the rest of the application.

#### Scenario: Sidebar collapse tooltip uses v-tooltip
- **WHEN** the user hovers over the sidebar collapse/expand toggle button
- **THEN** a `v-tooltip` tooltip SHALL appear to the right of the button reading "Collapse sidebar" or "Expand sidebar" depending on current state

#### Scenario: Mobile menu button tooltip uses v-tooltip
- **WHEN** the user hovers over the mobile menu open button
- **THEN** a `v-tooltip` tooltip SHALL appear below the button reading "Open menu"

### Requirement: Tooltip implementation standard
All tooltips on icon-only buttons SHALL be implemented using PrimeVue's `v-tooltip` directive with placement and text conventions as follows: table row action buttons use `.top` placement; sidebar collapse toggle uses `.right` placement; mobile top-bar buttons use `.bottom` placement. Tooltip text MUST be concise, action-oriented, and sentence-case.

#### Scenario: Tooltip placement follows context convention
- **WHEN** a tooltip is rendered for a table row action button
- **THEN** it SHALL appear above the button (`.top` placement)

#### Scenario: Existing aria-label attributes are retained
- **WHEN** an Items table button already has an `aria-label` attribute
- **THEN** the `aria-label` SHALL be retained alongside the new `v-tooltip` for screen reader support
