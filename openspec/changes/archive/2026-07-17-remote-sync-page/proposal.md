# Proposal: remote-sync-page

## Why

Users can already track time, link Tasks to OpenProject issues, and store a per-Client remote configuration (including a rounding rule and required-field defaults that nothing consumes yet). Story 11a (`docs/user-stories.md`) delivers the missing review step: a per-day Remote Sync page where a whole day's time can be inspected, rounded, and prepared before it is ever pushed to the client's tracker (push itself is story 11b).

## What Changes

- New **Remote Sync page**, opened from the Timer view for a specific day, listing **all** of that day's tasks (including a read-only "(no task)" bucket).
- Each row carries an explicit state: **read-only with a stated reason** (no Project/Client, no `RemoteSystemConfig`, system type not implemented, e.g. redmine), **read-only but linkable** (no `RemoteIssueRef`; inline link action reusing the story-10a picker flips it to manageable), or **manageable**.
- Manageable rows show the **original duration** (day's entries summed) and a separately displayed, **editable rounded duration** pre-filled by applying the configured rounding rule **once** to the sum — implemented in a **shared rounding utility** that story 11b will reuse; a value of `0` marks the task as excluded from any future push.
- Manageable rows expose the remote system's **required fields** (OpenProject **activity**), with options fetched from the remote via the adapter (new adapter read surface) and pre-filled from `requiredFieldDefaults`; selections are page state only.
- The page is strictly **review-only** — no push action.

## Capabilities

### New Capabilities

- `remote-sync-review`: the per-day Remote Sync page — day selection from the Timer view, per-task row states, original + editable rounded durations, shared rounding utility, required-field selection with fetched options and config-default pre-fill.

### Modified Capabilities

- `remote-issue-linking`: the remote-issue picker SHALL also be available inline on the Remote Sync page for tasks without a `RemoteIssueRef` (currently specified for the Timer view only).

## Impact

- **App:** new page under `app/pages/`, day link from the Timer view; new composables/utils for row-state derivation and rounding.
- **Shared:** rounding utility; OpenProject adapter gains an activities (time-entry form/schema) request builder + parser; new boundary types for the day-review payload.
- **Server:** new read endpoint(s) aggregating a day's tasks with durations, config, and link state.
- **i18n:** new `en`/`pl` keys for states, reasons, and labels.

## Non-goals

- No push action, push records, locks, or previously-used-value pre-fill (story 11b).
- No Redmine adapter, no backend-side execution mode, no persistence of selected field values or edited durations.
