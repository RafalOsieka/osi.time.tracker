## Why

The tracker import dialog (`TrackerImportDialog.vue`) renders its seven `ImportPhase` states as a flat, unlabeled sequence of `v-if` blocks. The user has no visual sense of where they are in the range → mapping → preview → done flow or how much is left, especially since scanning and importing each run for several seconds with only a bare progress bar for orientation.

## What Changes

- Add a `UStepper` header above the existing phase content, with four steps: Range, Mapping, Preview, Done.
- `scanning` renders inside the Range step's content (replacing the date form with the scan progress bar); `importing` renders inside the Preview step's content (replacing the preview table with the import progress bar). Neither phase gets its own header step.
- The `error` phase renders inside whichever step was active when the failure occurred, keyed off `errorState.stage` (`scan` → Range, `mapping` → Mapping, `import` → Preview), same as today's inline error block just relocated into that step's content.
- The Stepper header is a non-interactive progress indicator (`disabled`, `orientation="horizontal"`, `size="sm"`, icon + title, no description). All navigation keeps using the existing footer buttons (`backToRange`, `backToMapping`, `cancelScan`, `retry`), which already encode the flow's asymmetric back rules (mapping-back discards the scan; preview-back keeps it; importing offers no cancel).
- Existing `data-testid` attributes move onto the elements inside each step's `#content` slot (unchanged values, new location) so e2e/UI tests keep working unmodified.
- Add four i18n step-title keys in `en`/`pl` parity.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None — the phase machine (`use-remote-log-import.ts`), its transitions, and every REQ-334/REQ-338/REQ-358 behavior are unchanged. This is a visual reorganization of the same phases, not a behavior change.

## Impact

- `apps/web/app/components/TrackerImportDialog.vue` (template restructure; script largely unchanged — adds a `stepIndex` computed and a `stepItems` list).
- `apps/web/i18n/locales/en.json` and `pl.json` (new `trackerImport.step*Title` keys).
- `apps/web/test/e2e/ui/*import*` and `apps/web/test/nuxt/*import*` specs (if any target markup structure rather than `data-testid`, otherwise no change expected).
