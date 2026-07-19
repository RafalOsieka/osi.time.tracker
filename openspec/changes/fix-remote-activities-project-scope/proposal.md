# Proposal: fix-remote-activities-project-scope

## Why

The Remote Sync page's activity picker is empty for every manageable OpenProject row, so users cannot choose a time-entry activity. The root cause is the endpoint: activities are fetched from the **global** time-entries schema (`GET /api/v3/time_entries/schema`), which carries no allowed activity values — its `activity` field is a bare descriptor with an empty `_links` and no `_embedded.allowedValues`. OpenProject scopes time-entry activities **per project** (they are enabled/disabled under "manage project activities"), so a global, project-less schema can never return them. `parseTimeEntryActivitiesResults` is therefore not buggy in isolation — it dutifully returns `[]` because the endpoint it is fed genuinely carries no options. The existing unit tests pass only because they feed a hand-made payload that already contains `activity._embedded.allowedValues`, a shape the live global endpoint never produces.

## What Changes

- Fetch activities **project-scoped** via `POST /api/v3/time_entries/form`, keyed by each manageable row's linked **work package** (`{ _links: { workPackage: { href: ".../work_packages/{id}" } } }`); OpenProject derives the project itself, so no separate work-package→project lookup is needed.
- Parse the deeper form nesting `_embedded.schema.activity._embedded.allowedValues` (one level deeper than today; the leaf `{ id, name }` shape is unchanged).
- Minimally enable the adapter for this: `AdapterRequest` gains `method: 'GET' | 'POST'` and an optional `body`, and the activities request builder takes a work-package reference instead of just `baseUrl`. The broader adapter-interface redesign is **deferred**.
- Change fetch granularity from **once per remote configuration per page load** to **once per resolved project/work package**, deduplicated so rows sharing a project fetch once.
- Thread the work-package reference through the proxied transport (`proxyOpenProjectActivities` + `POST /api/remote/activities`) so both direct and proxied transports resolve project-scoped activities.

## Capabilities

### Modified Capabilities

- `remote-sync-review`: `REQ-TTR-117` — required-field option fetching switches from the global time-entries schema fetched once per configuration to a project-scoped `POST /time_entries/form` fetch keyed by each manageable row's linked work package, deduplicated across rows that resolve to the same project.

## Impact

- **Shared:** `shared/utils/openproject-adapter.ts` — `AdapterRequest` gains `POST` + `body`; the activities request builder emits the form POST from a work-package reference; the parser reads `_embedded.schema.activity._embedded.allowedValues`. `shared/types` — the proxied activities body carries the work-package reference.
- **Server:** `server/utils/remote-issue-proxy.ts` and `server/api/remote/activities.post.ts` forward the work-package reference and issue the POST body.
- **App:** `app/composables/useRemoteActivities.ts` fetches per resolved project/work package with dedup instead of once per config.
- **Tests:** adapter unit tests updated to the form POST request and deeper parser nesting; proxy/composable tests updated for the per-project fetch.

## Non-goals

- No empty-state permissions hint — a genuinely empty activity list stays a silent empty state for now (deferred).
- No broader adapter-interface redesign — this change adds only the minimal `POST` + `body` enablement needed; the unified multi-adapter interface is revisited post-MVP.
- No push behavior changes — the page remains review-only.
