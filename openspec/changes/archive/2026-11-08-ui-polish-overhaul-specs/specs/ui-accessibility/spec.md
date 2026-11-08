## ADDED Requirements

### Requirement: REQ-514 Triggers show that their overlay is open
A control that opens a popover, menu or dialog SHALL show a pressed state while that overlay is open, so the user can tell which control it belongs to. A popover or menu trigger SHALL also expose whether it is open through `aria-expanded`. Closing the overlay SHALL return the control to its resting state.

#### Scenario: Popover trigger while open
- **WHEN** the user opens a popover or menu from a control
- **THEN** that control SHALL expose `aria-expanded="true"` and show its pressed state until the overlay closes

#### Scenario: Dialog trigger while open
- **WHEN** a page header action or a row action opens a dialog
- **THEN** that action SHALL show its pressed state while the dialog is open

#### Scenario: Overlay closes
- **WHEN** the overlay closes by its own action, the Escape key or an outside click
- **THEN** the control SHALL NOT look pressed, and a popover or menu trigger SHALL expose `aria-expanded="false"`
