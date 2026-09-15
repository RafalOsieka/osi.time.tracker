## Context

`TrackerImportDialog.vue` drives its body off `ImportPhase` (`range | scanning | mapping | preview | importing | done | error`) exposed by `useRemoteLogImport()` (`apps/web/app/composables/use-remote-log-import.ts`). Today each phase is a sibling `v-if`/`v-else-if` block inside one `<div data-testid="tracker-import-dialog">`; the footer switches its buttons the same way. See proposal.md for why this needs a Stepper.

Key asymmetries in the existing flow that any restructure must preserve exactly (unchanged in this refactor — see `openspec/specs/remote-log-import/spec.md` REQ block starting "The Trackers page SHALL offer an \"Import history\" action..."):
- `mapping` → back → `range`, and this **discards** the scan (`backToRange()` calls `importState.reset()` + `defaultRange()`).
- `preview` → back → `mapping`, and this **keeps** the scan (`importState.backToMapping()` just flips `phase`).
- `scanning` has a cancel action; `importing` does not (months commit atomically).
- `error` is not a phase of its own conceptually — it's `errorState.stage` (`'scan' | 'mapping' | 'import'`) tagging which stage failed, with `retry()` re-running that stage.

## Goals / Non-Goals

**Goals:**
- Give the dialog a persistent visual sense of progress through Range → Mapping → Preview → Done.
- Keep every existing transition, guard, and `data-testid` behavior byte-identical — this is presentation only.

**Non-Goals:**
- Changing `use-remote-log-import.ts`'s state machine, its exported API, or any REQ-334/REQ-338/REQ-358 behavior.
- Making the Stepper header clickable/navigable — see Decisions.
- Redesigning the phase bodies themselves (range form, mapping table, preview table, done summary) beyond relocating their `data-testid` root.

## Decisions

### 1. Four header steps (Range, Mapping, Preview, Done); scanning/importing fold into a neighbor's content

`scanning` renders inside the Range step's `#content` (replacing the date-range form with the scan progress bar); `importing` renders inside the Preview step's `#content` (replacing the preview table with the import progress bar). Neither gets its own header item.

*Alternatives considered:*
- **Six steps, one per `ImportPhase`.** Rejected: `scanning`/`importing` are non-interactive, auto-advancing progress states, not decision points — giving them equal header weight to Range/Mapping/Preview/Done overstates them and makes the header feel like it's "counting" rather than orienting.
- **Leave existing `v-if` markup untouched, add `UStepper` purely as a decorative header bar (no `#content` slot use).** Rejected: cheapest diff, but then the header's highlighted step and the actual visible content are two independently-maintained sources of truth (a computed index vs. the `v-if` chain), which is exactly the kind of duplication the anti-slop/simplicity guidance flags — using `#content` per step makes the Stepper the single source of "what's showing."

### 2. `stepIndex` computed maps `phase` (+ `errorState.stage` while in `error`) to a step index 0-3

```ts
const stepIndex = computed(() => {
  if (phase.value === 'error') {
    return errorState.value?.stage === 'import' ? 2
      : errorState.value?.stage === 'mapping' ? 1 : 0;
  }
  return ({ range: 0, scanning: 0, mapping: 1, preview: 2, importing: 2, done: 3 } as const)[
    phase.value
  ];
});
```
`error`'s step is derived from `errorState.stage`, not a fifth phase, matching the composable's own modeling of `error` as a stage-tagged interrupt rather than a linear phase.

### 3. Stepper header is non-interactive (`disabled`)

`<UStepper disabled orientation="horizontal" size="sm" :items="stepItems" :model-value="stepIndex">` — items carry `title` + `icon` only (no `description`). All navigation continues to go through the existing footer buttons (`submitRange`, `importState.cancelScan()`, `backToRange`, `continueToPreview`, `importState.backToMapping()`, `confirmImport`, `importState.retry()`), unchanged.

*Alternative considered:* letting completed steps be clickable, wired to `backToRange`/`backToMapping` per item. Rejected: the flow's back semantics are asymmetric (see Context) and not expressible as "jump to step N" — e.g. there is no direct "jump from Preview to Range" operation today, only the two specific back methods. Reimplementing that as generic per-item click handlers would duplicate logic the footer buttons already encode correctly, for no behavior gain.

### 4. `data-testid` relocation, not removal

Every existing `data-testid` (`tracker-import-range`, `tracker-import-scanning`, `tracker-import-mapping`, …) moves onto the root element inside the corresponding step's `#content` slot, keeping its value unchanged. `UStepper` itself gets no `data-testid` (same fallthrough caveat already noted in the file for `UModal`: multiple root nodes disable `$attrs` fallthrough).

### 5. Four new i18n keys

`trackerImport.stepRangeTitle`, `stepMappingTitle`, `stepPreviewTitle`, `stepDoneTitle` in `en` and `pl`, added in parity per `CODING_STANDARDS.md`/AGENTS.md i18n rule.

## Risks / Trade-offs

- ~~**[Risk]** `UStepper`'s `#content` slot renders all four steps' markup in the DOM simultaneously...~~ **Corrected during implementation:** `Stepper.vue`'s template exposes exactly one `#content` slot for the whole component, bound to `currentStep` — it is not per-item. The original `phase`-driven `v-if` chain moved into that single slot unchanged and remains the sole thing deciding what's in the DOM, so there is no simultaneous-rendering risk and no testid-uniqueness concern from the Stepper itself.
- **[Risk]** Icon choices per step are cosmetic guesses (calendar / route / eye / check) with no existing precedent in this dialog. **Mitigation:** low stakes, easy to swap in review; not worth blocking on.
- **[Trade-off]** Folding `scanning`/`importing` into a neighbor step's content means the header alone doesn't visually distinguish "filling out the range form" from "scanning is running" — both show step 1 highlighted. Accepted: the step content itself (progress bar vs. form) already makes that distinction; the header's job is coarse orientation, not phase-exact state.

## Migration Plan

Pure client-side template/i18n change, no data migration. Land as a single PR; no feature flag or rollback path needed beyond a normal revert.
