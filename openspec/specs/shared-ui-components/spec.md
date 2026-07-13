# shared-ui-components Specification

## Purpose
Define the reusable, presentational UI building blocks shared across list/detail pages (table header, empty state, row actions, form-field wrapper, app-level confirm dialog, and locale-aware date formatting) so pages stay consistent, accessible, and free of duplicated markup/CSS.

## Requirements

### Requirement: REQ-NFR-030 Shared table template components
The application SHALL provide reusable presentational components for the recurring DataTable page sections: a table header (page title plus "New" button), an empty state (message plus create call-to-action), and row actions (edit and delete icon buttons). Each component SHALL receive all user-facing labels and `data-testid` values via props so pages keep their existing test and i18n contracts, and SHALL emit events (`create`, `edit`, `delete`) rather than performing any data access itself. Pages SHALL keep full ownership of their `DataTable`/`Column` markup; the components SHALL NOT wrap `DataTable`.

#### Scenario: Header rendered from props
- **WHEN** a page slots the table header component into its DataTable `#header` template with a title, button label, and testid
- **THEN** the header SHALL render the title and the "New" button with the supplied `data-testid`, and activating the button SHALL emit `create`

#### Scenario: Empty state rendered from props
- **WHEN** a list is empty and the empty-state component is slotted into the DataTable `#empty` template
- **THEN** it SHALL render the supplied message and a CTA button with the supplied `data-testid`, and activating the CTA SHALL emit `create`

#### Scenario: Row actions are accessible
- **WHEN** the row-actions component renders for a row
- **THEN** the edit and delete buttons SHALL expose the supplied accessible names via `aria-label` and the supplied per-row `data-testid` values, and activating them SHALL emit `edit` / `delete`

### Requirement: REQ-NFR-031 Shared form field wrapper with accessible errors
The application SHALL provide a form-field wrapper component used inside PrimeVue Forms (`@primevue/forms`) that renders a visible `<label>` associated with the field, the input via a default slot, and the field's validation error via a PrimeVue `Message` (severity `error`). The error SHALL carry a caller-supplied `data-testid`, SHALL be announced to assistive technology (`role="alert"` or live region), and the invalid input SHALL expose `aria-invalid` and reference the error via `aria-describedby`. Error text SHALL be produced by translating the schema's messageKey via `t()` at render time.

#### Scenario: Field error is associated and announced
- **WHEN** a field fails validation
- **THEN** the error message SHALL render with the supplied `data-testid`, be announced via a live region, and the input SHALL expose `aria-invalid` with `aria-describedby` referencing the error

#### Scenario: Valid field shows no error
- **WHEN** a field passes validation
- **THEN** no error message SHALL be rendered and the input SHALL NOT be marked invalid

### Requirement: REQ-NFR-032 Single app-level confirm dialog
The application SHALL mount exactly one `<ConfirmDialog />` in the default layout; pages SHALL NOT mount their own instances and SHALL trigger confirmation via the `useConfirm` service with page-specific copy.

#### Scenario: Page delete uses the shared dialog
- **WHEN** a user activates a delete action on any list page
- **THEN** the layout-level confirm dialog SHALL open with that page's header, message, and accept/reject labels, and no duplicate dialog instance SHALL exist

### Requirement: REQ-NFR-033 Locale-aware shared date formatting
The application SHALL provide a single shared date-formatting utility for rendering ISO timestamp strings in tables, formatted according to the active i18n locale rather than only the browser default.

#### Scenario: Date cell follows active locale
- **WHEN** a `createdAt` value is rendered in a table with the active locale set to `pl`
- **THEN** the date SHALL be formatted using the `pl` locale conventions

#### Scenario: Invalid date input handled
- **WHEN** the utility receives an empty or unparsable string
- **THEN** it SHALL return an empty string rather than rendering "Invalid Date"

### Requirement: REQ-NFR-034 Shared smart time input component
The application SHALL provide a reusable time-input component with an `HH:mm` string model (nullable) backed by a PrimeVue `InputText` (numeric input mode) and a pure, unit-testable normalization function that forgivingly parses keyboard input into a valid `HH:mm` value. The parser SHALL apply these deterministic rules:

- one digit `H` → `0H:00` (e.g. `9` → `09:00`);
- two digits forming a valid hour (`00`–`23`) → that hour with `:00` (e.g. `23` → `23:00`);
- two digits `DD` not forming a valid hour, where the second digit is `0`–`5` → `0D:D0` (hour + tens of minutes, e.g. `93` → `09:30`); otherwise invalid (e.g. `59`);
- three digits `HMM` → `0H:MM` (e.g. `900` → `09:00`);
- four digits `HHMM` → `HH:MM` (e.g. `1234` → `12:34`);
- a trailing colon SHALL be ignored, with the preceding digits parsed by the rules above (e.g. `123:` → `01:23`);
- colon-separated parts SHALL be zero-padded (e.g. `9:5` → `09:05`);
- values out of range (hour > 23 or minute > 59, e.g. `25:00`, `12:66`) SHALL be invalid;
- surrounding whitespace SHALL be ignored.

The component SHALL commit the normalized value on blur or Enter and cancel on Escape; input that cannot be normalized SHALL silently revert the field to the previous value without emitting a model update and without sending any request. The component SHALL accept an accessible label and `data-testid` via props, and SHALL be the single time-entry input used wherever the UI accepts an `HH:mm` time typed by the user.

#### Scenario: Compact digits normalized on commit
- **WHEN** the user types `900` and blurs the field or presses Enter
- **THEN** the model SHALL update to `09:00`

#### Scenario: Two digits prefer a valid hour
- **WHEN** the user types `23` and commits
- **THEN** the model SHALL update to `23:00`

#### Scenario: Two digits fall back to hour plus tens of minutes
- **WHEN** the user types `93` and commits
- **THEN** the model SHALL update to `09:30`

#### Scenario: Invalid input silently reverts
- **WHEN** the user types `59` or `12:66` and commits
- **THEN** the field SHALL revert to the previous value, the model SHALL NOT update, and no request SHALL be sent

#### Scenario: Escape cancels the edit
- **WHEN** the user presses Escape while editing
- **THEN** the field SHALL revert to the previous value and the model SHALL NOT update
