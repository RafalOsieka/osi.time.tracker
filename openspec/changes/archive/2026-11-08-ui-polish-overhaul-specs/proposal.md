# Proposal

## Why

Two UI polish passes (PR #161 and the stacked PR #162) changed observable behaviour across the web app and the extension, but neither touched `openspec/specs`. The specs still describe the app before the polish, so several requirements are false and new behaviour has no contract.

## What Changes

- Bring the specs in line with the shipped code of both passes. Only the final behaviour is specified; where the second pass changed something the first introduced, the first version is not recorded.
- Two cross-cutting rules replace per-page scenarios: a trigger that opens a popover, menu or dialog exposes its open state; a spelled-out date or period follows the locale's casing.
- Requirements made false are corrected: bundled typefaces, the login mark, the inline editor at rest, the start/stop control, the top-bar Project chip, quoted labels that changed.
- New behaviour gets requirements: password and API secret reveal toggles, visible form help, named delete confirmations, the Projects and Trackers list columns, the issue picker's context and keyboard picking, the Remote sync row order, needs-attention state, running-entry total, export review details, extension status badges, onboarding and notifications.
- Defects found while checking the code are fixed so the code meets the specified behaviour: the Remote sync unlinked row's empty state label, the popup's restore focus with one affected approval, the HTTP approve button's accessible name, the transient day-total drop when the timer stops, and the touch reachability of the Project chip's remove control.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ui-theming`, `ui-routing`, `ui-shell`, `ui-shared-components`, `ui-accessibility`
- `core-authentication`, `core-i18n`
- `tracking-project-mentions`, `tracking-timer-widget`, `tracking-timer-view`, `tracking-reports`, `tracking-client-report`
- `remote-sync-review`, `remote-sync-export`, `remote-log-import`, `remote-browser-extension`, `remote-extension-setup`
- `workspace-projects`, `workspace-trackers`, `workspace-settings`

## Non-goals

- No spec for looks: colours, sizes, typeface names, glyphs, tile and pill shapes, tones and weights stay out unless a requirement depends on them.
- No new features beyond what the two passes shipped, apart from the defect fixes above.
- No compaction or restructuring of existing requirements that this change does not touch.

## Impact

- **Specs:** delta specs for the 20 capabilities above; new requirement codes from REQ-514.
- **Web app and extension:** small fixes for the defects listed above, each with a regression test.
- **Docs:** none.
