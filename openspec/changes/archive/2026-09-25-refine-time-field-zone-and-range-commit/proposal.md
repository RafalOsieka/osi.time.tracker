## Why

The inline time editor shows a timezone abbreviation such as `CEST` even on ordinary days, wasting limited row space. Moving from a range's start group to its end group can also prematurely send a PATCH with a half-edited interval, despite the existing whole-field commit contract. Both issues affect MVP entry editing (WBS 2.3 and user story 6).

## What Changes

- Hide the timezone abbreviation on ordinary calendar days, while displaying it when either bound's date has an offset transition in the entry's timezone; retain zoned values and instant conversion.
- Make range editing commit only after focus leaves the complete time field (or Enter), not while moving between its start and end segments, including focus transitions with missing or misleading `relatedTarget`.
- Cover ordinary and transition dates and real range focus behavior in focused component and browser tests.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ui-shared-components`: Refine REQ-361's timezone presentation and whole-field range commit behavior.

## Impact

`apps/web/app/components/TimeField.vue`, timer-row presentation, and associated Nuxt component / Playwright UI tests. No API, database, or dependency changes are intended.

## Non-goals

- Changing user timezone settings, UTC storage, or DST disambiguation rules for edited instants.
- Redesigning the timer view or replacing Nuxt UI's time input.