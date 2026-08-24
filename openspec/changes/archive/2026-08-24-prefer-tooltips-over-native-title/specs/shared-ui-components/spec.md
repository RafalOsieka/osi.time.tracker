## ADDED Requirements

### Requirement: REQ-270 Shared truncated-text tooltip
The application SHALL provide a reusable truncated-text hint for slots that ellipsize their displayed value. When the value overflows the slot, pointer hover and keyboard focus SHALL expose the complete string as a themed tooltip (REQ-269). When the value fits the slot, the tooltip SHALL be omitted. Call sites SHALL keep their existing accessible names and `data-testid` hooks.

#### Scenario: Overflowing slot shows the full value
- **WHEN** a slot using the shared truncated-text hint displays a value longer than the allocated space
- **THEN** the visible text SHALL end with an ellipsis, and pointer hover or keyboard focus SHALL show the complete string

#### Scenario: Fitting slot omits the tooltip
- **WHEN** a slot using the shared truncated-text hint displays a value that fits entirely
- **THEN** the slot SHALL NOT show a tooltip

## MODIFIED Requirements

### Requirement: REQ-127 Shared table template components
The application SHALL provide reusable presentational components for the recurring list-page sections: a table header (page title plus "New" button), an empty state (message plus create call-to-action), and row actions (edit and delete icon buttons). Each component SHALL receive all user-facing labels and `data-testid` values via props so pages keep their existing test and i18n contracts, and SHALL emit events (`create`, `edit`, `delete`) rather than performing any data access itself. Pages SHALL keep full ownership of their `UTable` markup and column definitions; the components SHALL NOT wrap `UTable`.

#### Scenario: Header rendered from props
- **WHEN** a page renders the table header component above its `UTable` with a title, button label, and testid
- **THEN** the header SHALL render the title and the "New" button with the supplied `data-testid`, and activating the button SHALL emit `create`

#### Scenario: Empty state rendered from props
- **WHEN** a list is empty and the empty-state component is rendered in the `UTable` empty slot
- **THEN** it SHALL render the supplied message and a CTA button with the supplied `data-testid`, and activating the CTA SHALL emit `create`

#### Scenario: Row actions are accessible
- **WHEN** the row-actions component renders for a row
- **THEN** the edit and delete buttons SHALL expose the supplied accessible names via `aria-label` and the supplied per-row `data-testid` values, and activating them SHALL emit `edit` / `delete`

#### Scenario: Row actions show matching tooltips
- **WHEN** the row-actions component renders for a row
- **THEN** pointer hover or keyboard focus on the edit or delete button SHALL show a themed tooltip whose text matches that button's accessible name
