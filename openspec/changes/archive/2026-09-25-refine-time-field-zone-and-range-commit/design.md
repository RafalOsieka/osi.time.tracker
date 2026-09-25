## Context

See `proposal.md` for motivation and `specs/ui-shared-components/spec.md` for the REQ-361 contract. `TimeField.vue` wraps Nuxt UI's `UInputTime` and stores zoned or unzoned drafts. `TimerEntryRow.vue` supplies `ZonedDateTime` values converted from stored instants and PATCHes on `commit`. The current `focusout` handler commits immediately when `relatedTarget` is absent or outside its component root; the current test only stubs an internal focus move. The compact timer row has a fixed-width slot.

## Goals / Non-Goals

**Goals:** Keep the timezone in every zoned model while reducing visual noise; make inline commits reliable across actual range-segment focus transitions without delaying explicit Enter commits.

**Non-Goals:** Change instant conversion, create a new timezone preference, or alter server validation.

## Decisions

### Presentation follows each bound's calendar day

Compute whether an offset changes between the local start of a bound's calendar date and the next local midnight in its own timezone; for a range, consider both populated bounds. Feed the result to Nuxt UI's `hideTimeZone` display prop while retaining `ZonedDateTime` values. Recompute when the model/draft dates or timezone change. Test spring-forward and fall-back dates (including the repeated hour), ordinary dates, and a range spanning a transition day.

Alternative: always hide the label, or replace zoned models with `Time`. Both lose useful ambiguity cues on transition days; replacing the model also risks shifting stored instants. Comparing offsets at the edited hour alone misses transitions elsewhere on the same date.

### Commit after settled focus leaves the complete control

Defer blur decisions until the browser has completed the focus transition, then inspect the active element against the full rendered field root. Commit only when focus is outside; keep Enter as an immediate explicit commit and Escape as cancel. Use the actual range DOM in a browser test to verify the root covers both segment groups; do not rely solely on `relatedTarget` or on a stubbed component. Ensure a pending deferred blur does not double-commit after Enter or override Escape; track/cancel stale transitions as necessary.

Alternative: keep the synchronous `relatedTarget` containment check; it cannot distinguish missing or misleading targets during internal focus moves. A fixed debounce would add latency and remain timing-sensitive.

## Risks / Trade-offs

- [A timezone's date boundary can be unusual or skip midnight] → Compare the offset at the beginning and end of the *local calendar day* using timezone-aware date operations; test DST edges rather than assuming a 24-hour day. If the library cannot represent an entire local date, resolve the closest valid boundary consistently.
- [Some locales render longer abbreviations in the fixed row slot on transition dates] → Validate the visible field and keyboard affordances at compact width in browser tests; keep the exception narrow.
- [Blur and Enter/Escape can race] → Validate a single commit, cancellation, and no PATCH during internal range moves in focused tests.
- [Underlying range segments may not re-sync after a rejected PATCH in reka-ui 2.10.4] → Preserve the known limitation documented in `TimerEntryRow.vue`; do not expand this change into a dependency upgrade.

## Migration Plan

No database migration or API rollout. Deploy as a UI-only change; rollback restores the previous field behavior without data transformation.