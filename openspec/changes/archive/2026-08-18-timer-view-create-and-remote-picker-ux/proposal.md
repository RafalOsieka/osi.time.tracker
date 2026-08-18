## Why

After the group-row density polish, two daily surfaces still fight the consultant workflow. The top-bar title menu buries “(new task)” under every match, so a same-named unbound task is extra work. The remote-issue picker is a stacked form: title search is default, focus lands on the mode radios, results hide the remote project, and unlink sits in the popover instead of next to Edit. In scope of WBS 2.10 / 5.5–5.6 (stories 5 and 10a); follow-up to `2026-08-18-timer-view-group-row-density`.

## What Changes

- Title autocomplete (top bar and add-entry dialog, shared helper): the create-new-task option is always first when typed text is non-empty. First-item highlight follows it; overlay Enter commits freeform create.
- Remote picker defaults to issue-ID search; ID is first in the mode control; opening the popover focuses the query input.
- Search-first picker layout: compact mode control, input as the hero, Enter submits, quiet status, two-line results (title + `#id · remote project title`).
- Search/lookup results include an optional remote project **title** (never remote project ids). Linking persists that title on the task row beside the cached issue title and exposes it on the ref DTO (picker results and `#id` tooltip).
- Linked hover/focus dropdown: Edit (opens picker) then Unlink (instant, day-scoped). The picker is search-and-attach only.

## Non-goals

- Inferring mode from digits vs letters; remembering last-used mode.
- Persisting remote project ids or a remote project catalog.
- Confirm dialog for unlink (unused `unlinkConfirmMessage` stays unused).
- Phone / PWA; WBS 5.7 start-from-remote-issue view.
- Changing adapter operation set, execution modes, or day-scoped reassignment.
- New unlink chrome on Remote Sync (picker there is unlinked-only).

## Capabilities

### New Capabilities

- _(none)_

### Modified Capabilities

- `time-tracking`: REQ-180 — create-new-task option is first; overlay Enter on that highlight is freeform create.
- `remote-issue-linking`: REQ-107 picker redesign, ID default, query autofocus, unlink in dropdown; REQ-103 result includes remote project title; REQ-104 persist cached remote project title (not ids).
- `task-management`: REQ-237 inline column for cached remote project title.
- `remote-adapter-contract`: search/lookup DTO includes optional remote project title.
- `openproject-adapter`: parse work-package project title into the neutral result.
- `redmine-adapter`: parse issue project title into the neutral result.

## Impact

- Frontend: `taskTitleMenu.ts`, `AppTimer.vue`, `TimerAddEntryDialog.vue`, `RemoteIssuePicker.vue`.
- Shared types, both adapter parsers, link/reassign body, `RemoteIssueRefDto`.
- DB: nullable cached remote-project-title column on `tasks` + migration.
- i18n `en`/`pl`: picker chrome and mode-specific placeholders.
- Tests: unit menu + parsers; nuxt picker; e2e create-option order and picker ID/unlink.
