## ADDED Requirements

### Requirement: REQ-269 Hover and focus hints use a themed tooltip
Hover and keyboard-focus hints in the application UI SHALL be presented as a themed tooltip that appears on pointer hover and on keyboard focus. The native browser `title` tooltip SHALL NOT be the mechanism for those hints. A tooltip SHALL NOT replace the control's accessible name (REQ-001): icon-only and status-only controls SHALL still expose `aria-label` or visually hidden text.

A themed tooltip SHALL be shown when at least one of the following is true:

- the control has no visible text label (icon-only or status-only chrome), in which case the tooltip text SHALL match the accessible name;
- visible text is truncated with an ellipsis, in which case the tooltip SHALL present the complete string;
- a compact labeled control needs extra explanation that is not fully visible (for example a summary chip whose visible text is a short label plus a value), in which case the tooltip MAY contain that extra explanation.

A themed tooltip SHALL NOT be shown when the control already has a visible text label that fully states its action or name, including expanded sidebar navigation labels. Dialog, page, and confirm headings are headings, not hover hints, and are outside this requirement.

When displayed text fits its slot without truncation, the overflow tooltip SHALL be omitted so it is not anchored to empty space. Disabled controls that need an explanation SHALL still expose that explanation on pointer hover and on keyboard focus. A tooltip SHALL NOT contain interactive controls; menus, pickers, and confirmations remain separate overlays.

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

#### Scenario: Native title is not the hint
- **WHEN** a hover or focus hint is required
- **THEN** the hint SHALL NOT be provided only by the native browser `title` tooltip

#### Scenario: Disabled explanation remains reachable
- **WHEN** a disabled control needs an explanation for why it is unavailable
- **THEN** pointer hover or keyboard focus SHALL still show that explanation as a themed tooltip

#### Scenario: Tooltip content is not interactive
- **WHEN** a themed tooltip is shown
- **THEN** it SHALL NOT contain buttons, links, or other interactive controls
