## ADDED Requirements

### Requirement: REQ-174 Nuxt UI components for overlay dialog forms and interactive items
Overlay dialogs (Nuxt UI `UModal` / `UPopover` bodies) that collect user input SHALL express their form using Nuxt UI's `UForm` bound to a Standard Schema (zod) `:schema`, consistent with the list/detail and settings pages, rather than a native `<form @submit.prevent>` element. Interactive result/list items rendered inside these dialogs (search-result rows, autocomplete suggestion labels) SHALL be Nuxt UI button components (e.g. `UButton variant="ghost"`) rather than native `<button>` elements. All existing `data-testid`, `id`, `<label for>`, `aria-*`, and `role="alert"` error wiring SHALL be preserved so current tests and accessibility contracts remain intact.

#### Scenario: Dialog form uses UForm with a schema
- **WHEN** a user opens the add-entry, bulk-assign, or remote-issue-picker dialog and submits it
- **THEN** submission SHALL be handled by a `UForm` bound to a zod schema, validation errors SHALL surface through the form's field/error mechanism, and no native `<form>` element SHALL own the submit handler

#### Scenario: Result and suggestion items are Nuxt UI buttons
- **WHEN** the remote-issue-picker renders search results, or a timer dialog renders autocomplete suggestions
- **THEN** each selectable item SHALL be a Nuxt UI button component exposing its existing per-item `data-testid`, and activating it SHALL emit the same selection behavior as before

#### Scenario: Invalid dialog input is reported through the form
- **WHEN** a required field (e.g. bulk-assign name) is empty or a value is invalid (e.g. add-entry end time before start time) on submit
- **THEN** the dialog SHALL block submission and surface the localized error via the form's error affordance, preserving the existing `role="alert"` announcement and `aria-describedby` association

#### Scenario: Test and a11y hooks unchanged
- **WHEN** the dialogs are normalized to `UForm` and `UButton`
- **THEN** every existing `data-testid`, field `id`, associated `<label>`, and error-announcement wiring SHALL remain unchanged
