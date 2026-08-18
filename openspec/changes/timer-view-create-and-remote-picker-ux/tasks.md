## 1. Schema and boundary types

- [ ] 1.1 Backend: Add nullable `remoteIssueCachedProjectTitle` on `tasks` and generate the SQL migration (no uniqueness change, no backfill)
- [ ] 1.2 Backend: Extend `RemoteIssueSearchResult` with optional `remoteProjectTitle`; `RemoteIssueRefDto` and `reassignTimeEntriesSchema` with optional `cachedRemoteProjectTitle`; map the column in `taskRowToRemoteIssueRefDto` (omit when null)
- [ ] 1.3 Backend tests: Unit-test the reassign schema (link with title, link without title still valid, blank title omitted) and the DTO mapper (present vs null) in `test/unit/time-entry-schema.spec.ts` / the existing remote-ref mapping tests

## 2. Persist on find-or-create

- [ ] 2.1 Backend: Thread `cachedRemoteProjectTitle` through `ResolveTaskRemoteIssueOptions` and write it on insert of a newly linked task in `resolveTaskId`; do not update a matched existing row; do not require the field
- [ ] 2.2 Backend tests: Integration-test `POST /api/time-entries/reassign` — linking with a project title persists it on the new task; linking without it succeeds with a null cache; explicit-null unlink still works (`test/e2e/tasks-remote-issue-ref.spec.ts` or the reassign suite)

## 3. Adapter parsers

- [ ] 3.1 Backend: Map OpenProject `_links.project.title` (non-empty string only) into `remoteProjectTitle` in title-search and get-by-id parsers; never copy project id/href
- [ ] 3.2 Backend tests: Extend `test/unit/openproject-client.spec.ts` — payload with project title, payload without, 404 still empty
- [ ] 3.3 Backend: Map Redmine `project.name` (non-empty string only) into `remoteProjectTitle` in title-search and get-by-id parsers; never copy project id
- [ ] 3.4 Backend tests: Extend `test/unit/redmine-client.spec.ts` — payload with project name, payload without, 404 still empty

## 4. Create-new-task first

- [ ] 4.1 Frontend: Prepend the synthetic create row in `buildTaskTitleMenuItems` (shared by `AppTimer` and `TimerAddEntryDialog`)
- [ ] 4.2 Frontend tests: Update `test/unit/task-title-menu.spec.ts` — create row is index 0 when typed text is non-empty; still omitted for blank text; `includeCreateRow: false` unchanged
- [ ] 4.3 Frontend e2e: Extend `test/e2e/timer-view-ui.spec.ts` (and add-entry coverage if present) so the first overlay option is “(new task)” and activating it starts/saves a free-form title

## 5. Remote picker UX

- [ ] 5.1 Frontend: `REMOTE_ISSUE_SEARCH_MODE_ORDER = ['id', 'title']`; focus the query input on open; search-first layout (hero input, compact mode, Enter submits, no empty phrase before first search); two-line results with `remoteProjectTitle`; emit `cachedRemoteProjectTitle` on link; move Unlink into the linked hover dropdown under Edit (instant, no confirm); drop unlink from the popover; mode-specific placeholders in `en`/`pl`
- [ ] 5.2 Frontend tests: Update `test/nuxt/remote-issue-picker.spec.ts` — default mode is id, unlink is in the dropdown not the popover, result shows project title, link payload includes `cachedRemoteProjectTitle` when present, empty state absent on first open
- [ ] 5.3 Frontend e2e: Update `test/e2e/remote-issue-picker-ui.spec.ts` (and proxied UI if it asserts mode/unlink) — open focuses the query, ID is selected, Unlink is on the dropdown and unlinks the day, picker has no unlink button

## 6. Verification

- [ ] 6.1 Frontend: `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:nuxt` stay green
- [ ] 6.2 Backend tests: `pnpm test:e2e` for reassign / remote-issue-picker / timer-view-ui stays green
