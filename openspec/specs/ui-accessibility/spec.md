# ui-accessibility Specification

## Purpose
Define the project-wide accessibility standard (WCAG 2.1 AA) that every page and component MUST follow, and the automated check that enforces its statically checkable parts. This standard applies to all current and future UI under `app/`.

## Requirements

### Requirement: REQ-001 Accessible names for interactive controls
Every interactive control (inputs, buttons, links, toggles, selects) SHALL expose a programmatic accessible name. A visible `<label>` associated with its control (via `for`/`id` or wrapping) SHALL be preferred; an `aria-label`/`aria-labelledby` MAY be used only when a visible label is genuinely not feasible. A `placeholder` SHALL NOT be the sole source of a control's accessible name. Icon-only controls SHALL provide a text alternative.

#### Scenario: Text input has an associated label
- **WHEN** a form text input is rendered
- **THEN** it SHALL have an associated visible label or, where infeasible, an `aria-label`, and SHALL NOT rely on `placeholder` alone

#### Scenario: Icon-only button is named
- **WHEN** a control renders only an icon (no visible text)
- **THEN** it SHALL provide an accessible name via `aria-label` or visually-hidden text

### Requirement: REQ-002 Form errors are announced and associated
Form validation and submission errors SHALL be programmatically associated with their field via `aria-describedby` and SHALL be announced to assistive technology through a live region (`role="alert"` or `aria-live`). Error state SHALL NOT be conveyed by color alone.

#### Scenario: Submission error is announced
- **WHEN** a form submission fails and an error message is shown
- **THEN** the message SHALL be exposed via a live region so screen-reader users hear it without moving focus

#### Scenario: Field-level error is linked to its field
- **WHEN** a specific field is invalid
- **THEN** the invalid control SHALL reference the error text via `aria-describedby` and indicate invalidity beyond color (e.g. `aria-invalid` plus text/icon)

### Requirement: REQ-003 Keyboard operability and visible focus
All functionality SHALL be operable with the keyboard alone, in a logical focus order, with no keyboard traps. A visible focus indicator SHALL be present on every focusable element and SHALL NOT be removed without an equivalent replacement. The application SHALL NOT auto-focus or auto-redirect focus in a way that disorients keyboard users.

#### Scenario: Primary flow is keyboard-only
- **WHEN** a user navigates a page using only Tab/Shift+Tab/Enter/Space
- **THEN** every interactive control SHALL be reachable and operable in a logical order with no trap

#### Scenario: Focus remains visible
- **WHEN** an element receives keyboard focus
- **THEN** a visible focus indicator SHALL be shown (the default browser or component-library outline preserved, or replaced with an AA-contrast equivalent)

### Requirement: REQ-004 Color contrast and non-color status
Text and meaningful UI SHALL meet WCAG 2.1 AA contrast (≥ 4.5:1 for normal text, ≥ 3:1 for large text and essential non-text UI). Status and meaning (error, success, running/stopped) SHALL NOT be communicated by color alone; a text label, icon, or shape SHALL accompany it.

#### Scenario: Body text meets AA contrast
- **WHEN** text is rendered against its background
- **THEN** the contrast ratio SHALL be at least 4.5:1 (3:1 for large text)

#### Scenario: State is not color-only
- **WHEN** a status is communicated (e.g. an error or an active timer)
- **THEN** it SHALL also be conveyed by text, icon, or shape, not color alone

### Requirement: REQ-005 Enforced accessibility lint gate
Statically checkable accessibility rules SHALL be enforced on component templates by an automated check that blocks merging. Every exception to a rule SHALL carry an inline comment explaining why.

#### Scenario: Lint fails on a missing label
- **WHEN** a template introduces an interactive control without an accessible name that the ruleset detects
- **THEN** the automated check SHALL fail and identify the offending element

### Requirement: REQ-269 Hover and focus hints use a themed tooltip
Hover and keyboard-focus hints SHALL be shown as a themed tooltip that appears on pointer hover and on keyboard focus, never only through the native `title` attribute. A tooltip SHALL NOT replace a control's accessible name (REQ-001). A disabled control that needs an explanation SHALL still show it on hover and focus. A tooltip SHALL NOT contain interactive controls; menus, pickers and confirmations stay separate overlays. Dialog, page and confirm headings are not hints.

#### Scenario: Native title is not the hint
- **WHEN** a hover or focus hint is required
- **THEN** the hint SHALL NOT be provided only by the native browser `title` tooltip

#### Scenario: Disabled explanation remains reachable
- **WHEN** a disabled control needs an explanation for why it is unavailable
- **THEN** pointer hover or keyboard focus SHALL still show that explanation as a themed tooltip

#### Scenario: Tooltip content is not interactive
- **WHEN** a themed tooltip is shown
- **THEN** it SHALL NOT contain buttons, links, or other interactive controls

### Requirement: REQ-427 When a themed tooltip is shown
A themed tooltip SHALL be shown when a control has no visible text label (its text SHALL match the accessible name), when visible text is truncated with an ellipsis (it SHALL show the complete string), or when a compact labeled control needs explanation that is not fully visible (it MAY add that explanation). It SHALL NOT be shown when a visible label already fully states the action or name, including expanded sidebar labels, nor as an overflow tooltip when the text fits its slot.

#### Scenario: Icon-only control shows a matching tooltip
- **WHEN** an interactive control renders only an icon or status glyph (no visible text label)
- **THEN** pointer hover or keyboard focus SHALL show a themed tooltip whose text matches the control's accessible name

#### Scenario: Labeled control has no repeating tooltip
- **WHEN** a control already displays a visible text label that fully states its action or name
- **THEN** the control SHALL NOT show a tooltip that only repeats that label

#### Scenario: Truncated text exposes the complete string
- **WHEN** displayed text is truncated with an ellipsis
- **THEN** pointer hover or keyboard focus SHALL show a themed tooltip containing the complete string

#### Scenario: Fitting text has no overflow tooltip
- **WHEN** displayed text fits entirely in its slot
- **THEN** the control SHALL NOT show an overflow tooltip
