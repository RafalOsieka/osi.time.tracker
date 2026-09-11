## 0. Spikes (against local dev trackers, no product code)

- [ ] 0.1 Redmine: with `display_subprojects_issues` disabled in `docker-compose.redmine.yml`, confirm `/issues.json?project_id=<root>&subproject_id=*&subject=~x` returns descendant issues; record the exact query in design.md (Decision 2) or switch to the documented fallback
- [ ] 0.2 Redmine: confirm `/issues.json?project_id=<root>&subproject_id=*&issue_id=<descendant id>&status_id=*` returns the issue and returns an empty list for an issue in an unrelated project; record in design.md
- [ ] 0.3 OpenProject: confirm `/api/v3/projects/<root>/work_packages?filters=[{"subprojectId":{"operator":"*","values":[]}},{"id":{"operator":"=","values":["<id>"]}}]` behaves the same way and that the `subject ~` filter composes; record in design.md
- [ ] 0.4 Both: confirm `/projects.json` and `/api/v3/projects` page shapes (`total`, `offset`/`limit` vs `pageSize`/`offset`) and the parent field; record in design.md (Decision 4)

## 1. Remote-trackers package (contract + adapters)

- [ ] 1.1 Add `RemoteProjectDto` and `RemoteIssueLookup` contracts, `RemoteIssueScope` type, and extend `RemoteTrackerAdapter` with `listProjects()`, `searchIssues(query, scope?)`, `getIssueById(id, scope?)`; verify `pnpm package:check` type-checks with both adapters still compiling
- [ ] 1.2 Redmine client: add `listProjectsPage` (offset/limit, parent mapping), scoped `searchByTitle`, and scoped `findIssueInProject` (`project_id` + `subproject_id=*` + `issue_id`); adapter: bounded catalog loop, scoped search, scoped-then-direct lookup returning `inScope`; verify unit tests in `packages/remote-trackers/test/redmine/` cover pagination bound, forced subprojects query string, in-scope, out-of-scope, 404, and project-gone (403/404 → error)
- [ ] 1.3 OpenProject client: add `listProjectsPage` (pageSize/offset, parent href → id), scoped search and lookup via `/projects/{id}/work_packages` with `subprojectId *`; adapter mirrors 1.2; verify unit tests in `packages/remote-trackers/test/openproject/` cover the same six cases
- [ ] 1.4 Update `test/contracts/adapter-contract.spec.ts` so both adapters satisfy nine operations and `inScope: true` is returned for unscoped lookups; verify `pnpm test:unit` passes

## 2. Extension protocol + extension (backend of the browser bridge)

- [ ] 2.1 `packages/extension-protocol`: add `listProjects` operation name/schemas, widen `searchIssuesInputSchema` and `getIssueByIdInputSchema` to objects with optional `scope`, change `getIssueByIdResultSchema` to the nullable lookup object; verify `packages/extension-protocol/test/protocol.spec.ts` rejects the old string inputs and accepts the new shapes
- [ ] 2.2 `apps/extension/src/worker/dispatch.ts`: route `listProjects` and pass scope through to the adapter; advertise `listProjects` in the handshake; verify `apps/extension/test/unit/dispatch.spec.ts` covers the new op and a scoped search, and `ports.spec.ts`/`bridge.spec.ts` still pass
- [ ] 2.3 `apps/web/app/utils/remote/extension-execution-adapter.ts`: forward the new signatures and expose whether `listProjects` is supported by the handshake; verify `apps/web/test/unit/extension-execution-adapter.spec.ts` covers scoped search, lookup result mapping, and the unsupported-catalog path
- [ ] 2.4 Update `apps/web/test/e2e/helpers/fake-extension.ts` to implement `listProjects` and the widened inputs; verify existing extension e2e specs pass unchanged

## 3. Backend (web server)

- [ ] 3.1 Migration: add nullable `remoteProjectId` / `remoteProjectTitle` text columns to `projects` with a both-or-neither CHECK; update `server/db/schema/projects.ts`; verify `pnpm db:generate` produces the SQL, `pnpm db:migrate` applies cleanly, and `pnpm test:e2e:db` schema tests pass
- [ ] 3.2 `shared/types/project.ts`: add the two fields to `createProjectSchema`/`updateProjectSchema` with cross-field refinement (both-or-neither, requires `trackerId`) and to `ProjectDto`; verify a unit spec in `apps/web/test/unit/` covers valid pair, half pair, scope on local, and length bounds with the expected messageKeys
- [ ] 3.3 `POST /api/projects`: persist and return the scope; verify e2e-api spec covers create-with-scope (happy) and half-pair 422 (error)
- [ ] 3.4 `PATCH /api/projects/[id]`: apply scope when tracker unchanged; force both null when `trackerId` changes or clears; verify e2e-api spec covers same-tracker replace, same-tracker clear, tracker change drops scope, detach drops scope, and scope-on-local 422
- [ ] 3.5 `GET /api/projects`: include both fields (null when absent); verify e2e-api list spec asserts the fields for scoped and unscoped rows
- [ ] 3.6 Add i18n keys for the new validation messageKeys (`en`/`pl`); verify the i18n parity lint passes

## 4. Frontend (web app)

- [ ] 4.1 `use-remote-issue-search.ts`: accept a scope getter and `applyScope` flag, forward scope to the adapter, map `inScope: false` to a per-result hint state (not an error); verify unit spec covers scoped title search, scoped lookup in/out of scope, unscoped path, and stale-response suppression with the two-step lookup
- [ ] 4.2 `RemoteIssuePicker.vue`: add `scope` prop, "Only in <title>" toggle (on at every open, hidden without scope), outside-scope hint on ID results with accessible name/status text; add i18n keys `en`/`pl`; verify nuxt component spec covers toggle default, toggle reset on reopen, hidden toggle, hint rendering and accessible name
- [ ] 4.3 `pages/index.vue` and `SyncDayRow.vue`: pass the resolved project's scope alongside the tracker; verify nuxt spec that a scoped project's group renders the toggle and an unscoped one does not
- [ ] 4.4 `ProjectFormDialog.vue`: remote project `USelectMenu` with indented hierarchy, "whole tracker" choice, loading state, catalog load via `createRemoteAdapter(tracker, secret).listProjects()` on tracker change, no-secret disabled state with cached title + clear + settings hint, error + retry, extension-unsupported hint, scope reset on tracker switch; add i18n keys `en`/`pl`; verify nuxt component spec covers each state with a mocked adapter
- [ ] 4.5 `pages/projects.vue` table: show the cached remote project title next to the tracker name when present; verify nuxt spec renders it and omits it for unscoped rows

## 5. E2E journeys

- [ ] 5.1 e2e-ui: seed a Redmine-type tracker with secret in `localStorage` and a mocked catalog (`page.route`); create a project with a scope via the dialog, reopen edit and see it pre-selected, switch tracker and see it cleared; verify the spec passes under `pnpm test:e2e:ui`
- [ ] 5.2 e2e-ui: on the timer page, open the picker for a scoped project, assert the scoped query string hits the mocked tracker, widen with the toggle and assert the unscoped query, look up an out-of-scope id and assert the hint, link it; verify the spec passes
- [ ] 5.3 e2e-ui (extension mode): with `fake-extension.ts` advertising `listProjects`, repeat the dialog catalog load; with it omitted, assert the disabled select and hint; verify both pass

## 6. Wrap-up

- [ ] 6.1 Update `docs/wbs.md` (3.2 / 5.5 notes) and `docs/user-stories.md` story 10a acceptance criteria to mention the remote project scope; verify the docs diff reads correctly
- [ ] 6.2 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:nuxt`, `pnpm test:e2e`; verify all green before opening the PR
