# accessibility Specification

## Purpose
Define the project-wide accessibility standard (WCAG 2.1 AA) that every page and component MUST follow, and the automated lint gate that enforces the statically checkable parts. This standard applies to all current and future UI under `app/`.

## Requirements

### Requirement: REQ-NFR-016 Accessible names for interactive controls
Every interactive control (inputs, buttons, links, toggles, selects) SHALL expose a programmatic accessible name. A visible `<label>` associated with its control (via `for`/`id` or wrapping) SHALL be preferred; an `aria-label`/`aria-labelledby` MAY be used only when a visible label is genuinely not feasible. A `placeholder` SHALL NOT be the sole source of a control's accessible name. Icon-only controls SHALL provide a text alternative.

#### Scenario: Text input has an associated label
- **WHEN** a form text input is rendered
- **THEN** it SHALL have an associated visible label or, where infeasible, an `aria-label`, and SHALL NOT rely on `placeholder` alone

#### Scenario: Icon-only button is named
- **WHEN** a control renders only an icon (no visible text)
- **THEN** it SHALL provide an accessible name via `aria-label` or visually-hidden text

### Requirement: REQ-NFR-017 Form errors are announced and associated
Form validation and submission errors SHALL be programmatically associated with their field via `aria-describedby` and SHALL be announced to assistive technology through a live region (`role="alert"` or `aria-live`). Error state SHALL NOT be conveyed by color alone.

#### Scenario: Submission error is announced
- **WHEN** a form submission fails and an error message is shown
- **THEN** the message SHALL be exposed via a live region so screen-reader users hear it without moving focus

#### Scenario: Field-level error is linked to its field
- **WHEN** a specific field is invalid
- **THEN** the invalid control SHALL reference the error text via `aria-describedby` and indicate invalidity beyond color (e.g. `aria-invalid` plus text/icon)

### Requirement: REQ-NFR-018 Keyboard operability and visible focus
All functionality SHALL be operable with the keyboard alone, in a logical focus order, with no keyboard traps. A visible focus indicator SHALL be present on every focusable element and SHALL NOT be removed without an equivalent replacement. The application SHALL NOT auto-focus or auto-redirect focus in a way that disorients keyboard users.

#### Scenario: Primary flow is keyboard-only
- **WHEN** a user navigates a page using only Tab/Shift+Tab/Enter/Space
- **THEN** every interactive control SHALL be reachable and operable in a logical order with no trap

#### Scenario: Focus remains visible
- **WHEN** an element receives keyboard focus
- **THEN** a visible focus indicator SHALL be shown (default browser/PrimeVue outline preserved or replaced with an AA-contrast equivalent)

### Requirement: REQ-NFR-019 Color contrast and non-color status
Text and meaningful UI SHALL meet WCAG 2.1 AA contrast (≥ 4.5:1 for normal text, ≥ 3:1 for large text and essential non-text UI). Status and meaning (error, success, running/stopped) SHALL NOT be communicated by color alone; a text label, icon, or shape SHALL accompany it.

#### Scenario: Body text meets AA contrast
- **WHEN** text is rendered against its background
- **THEN** the contrast ratio SHALL be at least 4.5:1 (3:1 for large text)

#### Scenario: State is not color-only
- **WHEN** a status is communicated (e.g. an error or an active timer)
- **THEN** it SHALL also be conveyed by text, icon, or shape, not color alone

### Requirement: REQ-NFR-020 Enforced accessibility lint gate
The project SHALL enforce statically checkable accessibility rules in CI via `eslint-plugin-vuejs-accessibility` configured with its flat-config recommended ruleset. The plugin SHALL be appended to the `withNuxt()` chain in `eslint.config.mjs` **before** `eslint-config-prettier`. `pnpm lint` SHALL fail when a template violates an enabled accessibility rule. Any rule deviation SHALL be justified with an inline ESLint disable comment that explains why.

#### Scenario: Lint fails on a missing label
- **WHEN** a template introduces an interactive control without an accessible name that the ruleset detects
- **THEN** `pnpm lint` SHALL exit non-zero and identify the offending element

#### Scenario: Prettier ownership preserved
- **WHEN** the ESLint config is assembled
- **THEN** `eslint-config-prettier` SHALL remain the last entry so the a11y plugin does not introduce stylistic conflicts
