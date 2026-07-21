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

### Requirement: REQ-129 Single app-level confirm dialog
The application SHALL provide a single shared confirmation pattern built on Nuxt UI's `useOverlay()` and a small in-house `ConfirmModal` component; pages SHALL NOT mount their own per-page confirm instances and SHALL trigger confirmation via the shared overlay with page-specific copy, receiving the user's accept/reject decision as a resolved promise.

#### Scenario: Page delete uses the shared confirm
- **WHEN** a user activates a delete action on any list page
- **THEN** the shared `ConfirmModal` SHALL open via `useOverlay()` with that page's header, message, and accept/reject labels, and deletion SHALL proceed only when the returned promise resolves as confirmed

### Requirement: REQ-131 Shared smart time input component
The application SHALL provide a reusable time-input component with an `HH:mm` string model (nullable) backed by a Nuxt UI `UInput` (numeric input mode) and a pure, unit-testable normalization function that forgivingly parses keyboard input into a valid `HH:mm` value. The parser SHALL apply these deterministic rules:

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

## REMOVED Requirements

### Requirement: REQ-128 Shared form field wrapper with accessible errors
**Reason**: The migration removes the `FormFieldWrap` wrapper component (per the decision to avoid wrapper components). Nuxt UI's `UFormField` natively renders an associated `<label>`, the input slot, and an announced validation error with `aria-invalid`/`aria-describedby` wiring, making a bespoke wrapper redundant.
**Migration**: Replace every `FormFieldWrap` usage with `UFormField` inside a `UForm`. Supply the field `label`, `name`, and error `data-testid` via `UFormField` props/slots; error text continues to come from the schema `messageKey` translated via `t()`. The accessible-error behavior is preserved by `UForm`/`UFormField` rather than the wrapper.

### Requirement: REQ-035 Vue forms use the PrimeVue Form pattern
**Reason**: `@primevue/forms` and its zod resolver are removed by the migration; Nuxt UI's `UForm` validates a zod schema natively, so the PrimeVue `Form` + `FormFieldWrap` pattern no longer exists.
**Migration**: Convert every submittable form (`settings.vue`, `RemoteIssuePicker.vue`, `TimerAddEntryDialog.vue`, `TimerBulkAssignDialog.vue`, the CRUD dialogs, and `login.vue`) to `UForm` with a `:schema` bound to the existing shared zod schema and labelled `UFormField`s. All previously present `data-testid` attributes remain on the same logical elements and no new validation behavior is introduced.
