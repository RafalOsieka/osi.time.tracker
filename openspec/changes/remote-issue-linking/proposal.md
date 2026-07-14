## Why

Remote-system configuration exists, but users cannot yet map local Tasks to the issues they work on. Story 10a delivers the first usable OpenProject adapter slice while preserving the MVP rule that credentials and remote API calls remain in the browser.

## What Changes

- Add browser-side OpenProject issue search by title phrase or exact issue ID using the Client's configuration and locally stored credential.
- Add a two-part remote-issue control to eligible Timer Task rows: a generated `#<issue-id>` link with a cached-title tooltip (or non-linked status text) and a separate pencil-icon button that opens the reusable PrimeVue issue picker. Its Popover provides an explicit search mode, query field, submit action, and bounded selectable result list; title searches require three characters while ID searches do not.
- Persist one remote issue reference per Task with configuration provenance, remote issue ID, and cached title; derive issue URLs from the available configuration instead of storing them.
- Allow users to link, replace, and unlink references through authenticated, CSRF-protected APIs.
- Preserve a sole reference during Task merges, permit identical references, and reject merges with different references.
- Preserve bare references when a configuration is deleted and assume IDs remain valid when its tracker identity is updated.
- Hide the complete control when the Task cannot resolve a configured remote system; for configured Redmine systems, show the reference/status portion and a disabled pencil action with an explanation because Redmine search is deferred.

## Capabilities

### New Capabilities

- `remote-issue-linking`: Browser-side OpenProject title/ID search, Task link lifecycle, Timer picker behavior, reference display, and unsupported-adapter handling.

### Modified Capabilities

- `task-management`: Define reference-preserving and conflict-blocking behavior when Task edits cause a merge.
- `remote-system-config`: Define how existing Task references behave when configuration identity changes or the configuration is deleted.

## Impact

- Adds shared adapter and boundary contracts, browser transport/composables, Task-reference persistence and migration, authenticated APIs, and Timer-view UI.
- Enriches Task/time-entry responses with cached references and updates Task merge transactions.
- Adds OpenProject CORS/CSP considerations plus unit, Nuxt, and e2e coverage.

## Non-goals

- Starting timers from remote issues, Remote Sync, time-log pushing, rounding execution, required-field workflows, or background import/synchronization.
- Redmine search, backend-side adapter execution, server-side credential storage, issue validation during configuration updates, pagination, or a dedicated Task page.