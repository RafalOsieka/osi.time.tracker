## Why

A tracker usually hosts several remote projects while each local Project maps to one of them, yet the remote-issue picker searches the whole tracker and the user filters by eye. Both Redmine and OpenProject can scope a search to one remote project and its descendants with a single root id. The "remote project catalog / `remoteProjectId`" was deferred as a later session in the `2026-08-10` and `2026-08-18` changes; this is that session (WBS 3.2 / 5.5).

## What Changes

- A tracker-bound Project MAY reference **one** remote project (`remoteProjectId` + cached `remoteProjectTitle`); none means the whole tracker.
- Scope means the remote project **and all descendants**, identically on both providers.
- Scope is **soft**: applied by default in the picker, with a toggle to search the whole tracker.
- Issue-ID search consults scope: an outside issue is still shown with an "outside this project's scope" hint. Membership is decided by the tracker (scoped lookup, then unscoped fallback), so results never carry a remote project id.
- New neutral operation `listProjects()` (paginated, bounded) feeds a remote-project select in the Project form, loaded with the browser-held secret; without a secret the form shows the cached title and allows clearing only.
- `searchIssues` / `getIssueById` accept an optional scope; the extension protocol gains the operation and widened inputs.
- Changing or clearing a Project's tracker clears its scope.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `project-management`: optional remote project scope on create/edit/list; reset on tracker change; form loads the catalog on demand.
- `remote-adapter-contract`: ninth operation `listProjects`; optional scope on search and lookup; `inScope` on lookup results; tree semantics invariant.
- `redmine-adapter`: catalog via `/projects.json`; scoped search via `project_id` + forced `subproject_id`; scoped lookup via `issue_id` filter.
- `openproject-adapter`: catalog via `/api/v3/projects`; scoped search/lookup via the project-scoped work-packages endpoint with `subprojectId` `*`.
- `remote-issue-linking`: picker receives the scope, applies it by default with a widen toggle, shows the outside-scope hint in ID mode.
- `browser-extension-execution`: bridge exposes nine operations and the widened inputs.

## Non-goals

- Multiple remote projects per Project, exclusion scopes, or scope derived from sibling projects.
- Remote project id on tasks or search results (REQ-104 / REQ-266 unchanged).
- Tracker-level default scope; auto-creating Projects from the catalog.
- Server-side validation of remote project ids (no server-held secret).
- Search-as-you-type catalog; refreshing cached titles.

## Impact

- DB: additive nullable columns on `projects`; one migration.
- `shared/types/project.ts`, `/api/projects` routes, `ProjectFormDialog.vue`, `RemoteIssuePicker.vue`, `use-remote-issue-search.ts`, `pages/index.vue`, `SyncDayRow.vue`.
- `packages/remote-trackers` contract + adapters; `packages/extension-protocol`, `apps/extension`.
- i18n `en`/`pl`; unit, nuxt, e2e tests; `fake-extension.ts`.
