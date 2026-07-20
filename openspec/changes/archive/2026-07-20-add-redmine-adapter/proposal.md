## Why

Redmine is already a valid `systemType` across the schema, DB, and UI, but it is explicitly gated: the adapter factories throw `systemNotImplemented`, the link endpoint rejects non-OpenProject configurations with a 409, and the Timer view disables the issue picker for Redmine clients. The layered remote architecture (`RemoteTrackerAdapter` → provider client → `Transport`) was built precisely so a second tracker slots in; this change fills the pre-shaped Redmine slot so Redmine users get the full link/sync/export flow in both `client` and `server` execution modes. Doing so also flushes out the last places where OpenProject-specific logic leaked into neutral layers (transport auth, issue-URL derivation, `normalizeBaseUrl`).

## What Changes

- Add `shared/remote/redmine/` (adapter + client + utils) implementing all six `RemoteTrackerAdapter` operations against Redmine's REST API: subject search and exact-ID lookup on `/issues.json`, global `/enumerations/time_entry_activities.json` activities (the `remoteIssueId` argument is accepted but unused), `/users/current.json` account, offset/limit-paginated `/time_entries.json` fetch, and `POST /time_entries.json` creation with decimal hours.
- Convert durations at the wire boundary only: adapters receive already-rounded `durationSeconds` (via the existing shared `applyRoundingRule`); the Redmine client serializes to decimal hours at 0.01 h precision and parses fetched hours back to whole seconds. No new rounding rules.
- **BREAKING (internal)** Move auth-header construction from the transports into each provider client (L3): `RemoteRequest.secret` is replaced by `RemoteRequest.headers`; OpenProject builds `Authorization: Basic base64(apikey:<secret>)`, Redmine builds `X-Redmine-API-Key: <secret>`. Both transports become provider-agnostic.
- Replace the OpenProject-shaped `deriveIssueUrl` usage with a per-provider dispatch table keyed by `systemType` (`work_packages/<id>` vs `issues/<id>`); move `normalizeBaseUrl` from `shared/remote/openproject/utils.ts` to a neutral shared location.
- Unlock the gates: `case 'redmine'` in both adapter factories, remove the 409 in `tasks/[id]/remote-issue-ref.post.ts`, remove the disabled-picker state in `TimerTaskGroup.vue`, retire the `editDisabledRedmine` i18n key (en/pl in parity).
- Mirror the OpenProject unit-test suites for the Redmine client/adapter/utils; flip factory and e2e assertions that currently expect Redmine rejection.

## Capabilities

### New Capabilities
- `redmine-adapter`: Redmine as a fully supported remote tracker — issue search/link, activity options, current account, same-day time-log fetch, and time-entry export — in both execution modes, with API-key auth and decimal-hour conversion.

### Modified Capabilities
- `remote-issue-linking`: REQ-TTR-109 restated to accept any active supported configuration (not only OpenProject); REQ-TTR-110's "Redmine search is unavailable" scenario replaced by an enabled-picker scenario; REQ-TTR-107 URL derivation restated as provider-aware.

## Impact

- **New**: `shared/remote/redmine/{adapter,client,utils}.ts`, `shared/remote/issue-url.ts` (dispatch table), neutral home for `normalizeBaseUrl`.
- **Modified**: `shared/types/remote-adapter.ts` (`RemoteRequest`), both transports, both adapter factories, `server/utils/remote-issue-refs.ts`, `server/api/tasks/[id]/remote-issue-ref.post.ts`, `app/components/TimerTaskGroup.vue`, `i18n/en.json` + `i18n/pl.json`.
- **Tests**: new `redmine-*` unit suites; updated factory, transport, `tasks-remote-issue-ref`, and `clients-remote-config-ui` specs.
- **No DB schema change** (`redmine` is already a valid persisted `systemType`); no API surface change for OSI clients.

## Non-goals

- No per-project Redmine activity overrides (`include=time_entry_activities`) — the global enumeration list is the MVP answer.
- No automated e2e against a live Redmine; no changes to the OpenProject adapter behavior beyond the auth-header/URL-derivation refactor.
- No broader provider-neutral rewording of `remote-sync-review`/`remote-issue-proxy` specs beyond what this change strictly requires (tracked as a possible follow-up).
