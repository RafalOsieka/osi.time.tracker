# Design

## Context

See proposal.md for why. The code on `feat/ui-polish-overhaul-v2` implements both polish passes. The second pass left a drafted spec diff outside the repo, written against the first pass's branch. The first pass left no draft, so its deltas were derived from `git diff origin/main...origin/feat/ui-polish-overhaul` and compared with `openspec/specs`. Both lists were checked against the code before the delta specs were written.

## Goals / Non-Goals

**Goals:**

- Every delta describes what ships on the branch, or, for the defects below, what the code is fixed to do.
- MODIFIED requirements stay within their current description length; new behaviour gets its own code.

**Non-Goals:**

- Re-specifying behaviour the first pass introduced and the second pass replaced. For example, v1 moved an expanded entry's clock range to the Activity column and v2 moved it back to the title edge, so REQ-498 needs no change.
- Restyling or re-wording UI copy to match the specs; copy follows the catalogs.

## Decisions

### D1. The code wins over the drafted wording

The drafted v2 wording was a starting point. Where it and the code disagree, the delta follows the code. Examples: REQ-415 (the offer sits below the alerts), REQ-420 (the first website is preselected), REQ-506 (extension failures keep a labelled recheck button), REQ-508/REQ-527 (the caption names stopped entries).

*Alternative:* adopt the draft and change the code. This was rejected because the draft was never reviewed as spec text, and the code is what passed the design rounds.

### D2. Defects are fixed, not specified

Where the code is plainly wrong, the spec states the intended behaviour and the code is fixed test-first:

- the empty state label on unlinked Remote Sync rows (REQ-520);
- the popup's restore focus when one approval lost access (REQ-408);
- the HTTP approve button's accessible name (REQ-416);
- the day total dropping while the day reloads after a stop (REQ-527);
- the Project chip's remove control on touch screens (REQ-374).

*Alternative:* specify the current behaviour and file issues. This was rejected because each fix is small and the wrong behaviour would otherwise become contract.

### D3. Two cross-cutting rules instead of per-page scenarios

REQ-514 (ui-accessibility) covers pressed and expanded triggers. REQ-516 (core-i18n) covers the locale's casing of spelled-out dates. The draft repeated each of these in five to seven specs.

*Alternative:* keep the per-page scenarios. This was rejected as duplication that drifts.

### D4. ADDED for new behaviour, MODIFIED only for false text

New behaviour gets REQ-514 to REQ-527. MODIFIED is used where a description or scenario became false, or where a scenario refines the same surface without growing the description. REQ-175 is renamed and keeps its code. No requirement is removed, so `docs/retired-requirements.md` is unchanged.

### D5. Looks stay out

Drafted scenarios that only describe looks are dropped: tiles, pills, tones, weights, 3:1 outlines, pixel insets, glyph names, colour roles beyond the existing warning/neutral split, and the pressed styles (REQ-514 states only that a pressed state exists). Typeface names stay out of REQ-175 and REQ-408.

## Risks / Trade-offs

- [Some scenarios still name copy ("download PDF", "Ready", "Setup needed")] → only where a spec already quoted the label or the label is the observable state. Catalog changes will need spec edits.
- [The Remote Sync row order is server-defined (REQ-223)] → it is covered by the existing API e2e test of the day endpoint, so a refactor cannot silently change it.
- [REQ-416 now warns for loopback HTTP trackers] → confirmed as intended; local development trackers show the warning too.

## Migration Plan

Spec-only on archive. The defect fixes ship in the same stacked PR; rollback is reverting the PR.
