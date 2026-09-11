## Context

See proposal.md – Why. Current state that shapes the approach:

- `projects` has `trackerId` only; `ProjectDto` is `{ id, name, trackerId, trackerName, createdAt }`. The Project form is server-only CRUD and never touches a tracker secret.
- `RemoteIssuePicker` receives `config: TrackerDto` and nothing about the project. `pages/index.vue` already resolves `group.projectId → ProjectDto → trackerId → TrackerDto` (`trackerForGroup`), so the full `ProjectDto` is in hand where the picker is mounted. `SyncDayRow` resolves the same way.
- `RemoteTrackerAdapter` has eight operations; `searchIssues(query)` and `getIssueById(id)` are tracker-wide. Redmine: `/issues.json?subject=~q&status_id=*`. OpenProject: `/api/v3/work_packages?filters=[subject ~ q]`.
- Search results are `{ remoteIssueId, title, remoteProjectTitle? }`; REQ-266 forbids a remote project id in that shape and REQ-104 forbids persisting one on tasks.
- The tracker secret lives in `localStorage` (`useTrackerSecret`) and is readable on any client page, including `/projects`.
- Extension bridge validates every operation by name and input schema; the handshake advertises `supportedOperations`.
- Both adapters already own a bounded page loop (`*_TIME_LOGS_MAX_PAGES = 50`, page size 100) for time logs.

## Goals / Non-Goals

**Goals:**
- One root remote project per local Project; tree semantics identical on both providers.
- Scope handled entirely in the browser/adapter path; the server stores it as opaque cached data.
- No change to the neutral search-result shape beyond an `inScope` flag.

**Non-Goals:**
- Reusing scope for reports / reconciliation.
- Re-validating or refreshing the cached remote project title after save.

## Decisions

### 1. Scope is a single root id, not a list

| Option | Notes |
|---|---|
| **One `remoteProjectId` + descendants (chosen)** | Redmine's `project_id` on `/issues.json` is a *scoping* param (single project); OpenProject has a project-scoped endpoint. One request, no id expansion. Covers the "misc bucket" case by pointing at a sub-project, or `null` for the whole tracker. |
| List of ids (`only`) | Redmine needs the long `f[]/op[]/v[]` filter syntax for multi-value; OpenProject fine. Multi-select UI, jsonb column. Rejected: the providers make single-root cheap and the multi case has no concrete user. |
| Exclusion (`except`) / derived "unclaimed" | Hierarchy absorbs the need; would add a union column and a sibling-projects rule. Rejected. |

Storage: two nullable `text` columns on `projects` — `remoteProjectId`, `remoteProjectTitle` — mirroring the task row's `remoteIssueId` / `remoteIssueCachedTitle` pattern. Both null or both set, enforced at the API boundary (`createProjectSchema`/`updateProjectSchema`) rather than a DB `CHECK` constraint — this codebase has no existing DB-level CHECK-constraint convention, and the sibling `tasks.remoteIssueId`/`remoteIssueCachedTitle` pairing is enforced the same way. `remoteProjectId` is stored as text because Redmine ids are numeric and OpenProject ids are numeric-as-string; the adapter treats it opaquely.

### 2. Tree semantics are forced, not setting-dependent

**Confirmed by spike (2026-09-11) against the local dev instances**, `docker-compose.redmine.yml` / `docker-compose.openproject.yml`:

- **Redmine**: with `Setting.display_subprojects_issues` explicitly turned **off**, `GET /issues.json?project_id=<root>` returned only the root's own issue. Adding `subproject_id=*` returned the root's issue **and** a descendant project's issue, while still excluding an issue in an unrelated project. The adapter always sends `subproject_id=*` so the scope means the same thing on every instance regardless of that admin setting. Scoping to a nonexistent/invisible project id (`project_id=<bogus>`) 404s, which the adapter maps to the shared search error.
- **OpenProject**: the project-scoped endpoint `GET /api/v3/projects/{id}/work_packages` **already includes descendant projects by default** — no `subprojectId` filter needed. Confirmed by scoping to the root (returned root + descendant, excluded the unrelated project) and to the leaf (returned only itself). Scoping to a nonexistent project id 404s the same way. This simplifies Decision 3 below: OpenProject needs only the path-scoped endpoint plus the existing `subject`/`id` filters, not an added `subprojectId` filter.

Alternative — "exact project, no descendants" (Redmine `subproject_id=!*`) — rejected: a user pointing at a parent wants the tree, and a leaf is a tree of one. The documented fallback (expand descendants from `listProjects()` and use Redmine's long filter syntax) is **not needed** — `subproject_id=*` works as designed.

### 3. ID-mode scope check asks the tracker, not the client

With tree semantics, comparing a result's project id to the scope root is wrong (an issue in a grandchild project is in scope). Options:

| Option | Notes |
|---|---|
| **Scoped lookup first, unscoped fallback (chosen)** | Redmine `/issues.json?project_id=X&subproject_id=*&issue_id=N`; OpenProject `/projects/X/work_packages?filters=[{"id":{"operator":"=","values":["N"]}}]` (subprojects already included by the path scope, confirmed above — no extra filter). Found ⇒ `inScope: true`. Empty ⇒ existing `/issues/N` / `/work_packages/N` lookup ⇒ `inScope: false` or not found. Two requests worst case, ID mode only. Result shape stays id-free. |
| Return `remoteProjectId` on results and load the catalog in the picker | Extra catalog fetch per picker open; relaxes REQ-266; membership logic duplicated in the web app. Rejected. |

Both steps confirmed directly: a scoped issue/id query for a descendant's id returns it; the same query for an unrelated project's id returns an empty collection; the plain unscoped `/issues/{id}` / `/work_packages/{id}` lookup then finds it. `getIssueById(id, scope?)` returns `RemoteIssueLookup = { result: RemoteIssueSearchResult; inScope: boolean } | null`. Without a scope, `inScope` is `true`. The composable maps `inScope: false` to a hint state, never to an error.

### 4. Catalog is a ninth neutral operation, paginated to a bound

`listProjects(): Promise<RemoteProjectDto[]>` with `RemoteProjectDto = { remoteProjectId, title, parentId?: string }`. Confirmed page shapes:

- **Redmine** `GET /projects.json?limit=100&offset=0`: envelope `{ projects: [...], total_count, offset, limit }`; a child project's payload carries `parent: { id, name }` (absent on roots).
- **OpenProject** `GET /api/v3/projects?pageSize=100&offset=1` (1-based page number): envelope `{ total, count, pageSize, offset, _embedded: { elements: [...] } }`; a child project's `_links.parent.href` is `/api/v3/projects/{id}` (absent on roots — the id is the last path segment).

Both loop until `total`/`total_count` is reached or `*_MAX_PAGES` (reuse the time-log constant). `parentId` lets the select render an indented tree; no other hierarchy logic in the web app. Alternative — search-as-you-type against `name=~` — rejected; instances in scope have tens, not thousands, of projects.

### 5. The Project form loads the catalog through the same client adapter path

`ProjectFormDialog` watches the selected tracker; when set and a secret exists in `localStorage`, it calls `createRemoteAdapter(tracker, secret).listProjects()` and populates a `USelectMenu`. State machine:

```
tracker null       -> control hidden, scope cleared
tracker set, no secret -> control disabled; shows cached title if any; "Clear" allowed;
                          hint links to tracker settings
tracker set, secret    -> loading -> options | error (translated key, retry)
tracker changed        -> scope cleared before reload
```

Alternative — a server route proxying the catalog — rejected: the server holds no secret and REQ-203 forbids routing it through OSI.

### 6. Server stores scope as opaque, bounded, cached data

`createProjectSchema` gains `remoteProjectId: z.string().trim().min(1).max(64).nullish()` and `remoteProjectTitle: z.string().trim().min(1).max(200).nullish()`, valid only together and only when `trackerId` is set. The server cannot verify the id upstream (same trust model as `remoteIssueCachedTitle`). `PATCH` that changes or clears `trackerId` forces both to null regardless of the body, so a stale client cannot carry a Redmine id onto an OpenProject tracker. `ProjectDto` exposes both fields.

### 7. Picker plumbing

`RemoteIssuePicker` gains `scope?: { remoteProjectId: string; remoteProjectTitle: string } | null`. `index.vue` and `SyncDayRow` pass the resolved project's fields alongside `tracker`. `useRemoteIssueSearch(config)` becomes `useRemoteIssueSearch(config, () => scope)`; `search()` takes `applyScope: boolean` (the toggle, default `true` when a scope exists) and forwards `{ remoteProjectId }` to the adapter. The toggle resets to on each time the popover opens.

### 8. Extension protocol

`operationNameSchema` adds `listProjects`; `searchIssuesInputSchema` becomes `{ query: string; scope?: { remoteProjectId: string } }` and `getIssueByIdInputSchema` the same shape with `remoteIssueId`. `getIssueByIdResultSchema` becomes the nullable lookup object. This is a protocol bump: the website checks `supportedOperations` includes `listProjects` before offering the catalog in extension mode, and an older extension yields the existing incompatibility state (REQ-309). `fake-extension.ts` mirrors the new shapes.

## Risks / Trade-offs

- [No secret on `/projects` when the user configures scope] → form degrades to cached title + clear; hint points at tracker settings where the secret is entered.
- [Remote project archived/deleted after save] → scoped search returns an upstream 404/403 which maps to the existing `error.remoteIssueSearchFailed`; the widen toggle still works; the user re-picks in the Project form.
- [Cached title drifts after a remote rename] → accepted, same as cached issue titles; re-picking refreshes it.
- [Two requests in ID mode when the issue is outside scope] → only on the miss path; bounded by the existing stale-response token.
- [Catalog larger than `MAX_PAGES × 100`] → loop stops at the bound, same as time logs; documented, not expected for target instances.
- [Extension users on the old build] → catalog/scope unavailable until they update; existing search keeps working via the incompatibility path, and the web app hides the scope control when `listProjects` is not in `supportedOperations`.

## Migration Plan

1. Generate the additive migration (`ALTER TABLE projects ADD COLUMN "remoteProjectId" text, ADD COLUMN "remoteProjectTitle" text`). Existing rows stay null = unrestricted; no behaviour change until a user picks a scope.
2. Ship `remote-trackers`, `extension-protocol`, extension, and web in one deploy; old web clients omit the new fields and the server stores null.
3. Rollback: drop the two columns; adapters ignore an absent scope.

## Open Questions

_None — the spike (Decisions 2–4) resolved the only open question about OpenProject's subproject inclusion, and confirmed it needs no explicit filter at all._
