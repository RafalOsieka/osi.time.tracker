## ADDED Requirements

### Requirement: REQ-035 Vue forms use the PrimeVue Form pattern
Vue components that render a submittable form SHALL use the PrimeVue `Form`
component together with `FormFieldWrap` for labeled fields, matching the pattern
already established by `app/pages/settings.vue` and
`app/components/RemoteIssuePicker.vue`. Native `<form>` and `<label>` elements
SHALL NOT be used for this purpose.

#### Scenario: Dialog form uses PrimeVue Form
- **WHEN** `TimerAddEntryDialog.vue` or `TimerBulkAssignDialog.vue` renders its submittable form
- **THEN** it wraps its fields in a PrimeVue `Form` component and labels them via `FormFieldWrap`, with no native `<form>` or `<label>` element present

#### Scenario: Existing behavior and hooks are preserved
- **WHEN** the form is converted to the PrimeVue pattern
- **THEN** the submit handler still fires on submission, all previously present `data-testid` attributes remain on the same logical elements, and no new validation behavior is introduced
