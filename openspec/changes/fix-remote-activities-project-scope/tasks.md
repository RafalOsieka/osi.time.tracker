## 1. OpenProject adapter: project-scoped activities

- [ ] 1.1 Generalize `AdapterRequest` in `shared/utils/openproject-adapter.ts` to allow `method: 'GET' | 'POST'` and an optional `body?: unknown` (existing GET builders keep `method: 'GET'`)
- [ ] 1.2 Rework `buildTimeEntryActivitiesRequest` to take a work-package reference and emit `POST /api/v3/time_entries/form` with `{ _links: { workPackage: { href: ".../work_packages/{id}" } } }`
- [ ] 1.3 Update `parseTimeEntryActivitiesResults` to read `_embedded.schema.activity._embedded.allowedValues`, mapping to adapter-neutral `{ id, name }` and yielding `[]` for malformed/absent payloads
- [ ] 1.4 Update adapter unit tests for the form POST request (method/body/url) and the deeper parser nesting (happy path, empty allowed values, malformed payloads)

## 2. Proxy & endpoint: thread the work-package reference

- [ ] 2.1 Extend the proxied activities request body type/schema in `shared/types` to carry the work-package reference
- [ ] 2.2 Update `proxyOpenProjectActivities` in `server/utils/remote-issue-proxy.ts` to forward the POST method/body and the work-package reference
- [ ] 2.3 Update `POST /api/remote/activities` (`server/api/remote/activities.post.ts`) to validate and pass through the work-package reference
- [ ] 2.4 Update proxy/endpoint tests: happy-path project-scoped fetch and upstream failure mapped to `{ messageKey, params }`

## 3. Composable: per-project fetch with dedup

- [ ] 3.1 Change `useRemoteActivities` to fetch activities per resolved project/work package (keyed by the row's `remoteIssueId`) instead of once per remote configuration
- [ ] 3.2 Deduplicate so rows resolving to the same project/work-package scope reuse a single fetch; keep the silent empty-state and inline fetch-failure behavior
- [ ] 3.3 Update composable/component tests for per-project fetch, dedup, empty-result silence, and fetch-failure error state

## 4. Verification

- [ ] 4.1 Run `openspec validate fix-remote-activities-project-scope --strict` and fix any structural issues
- [ ] 4.2 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`, and the relevant test projects (`pnpm test:unit`, `pnpm test:nuxt`, `pnpm test:e2e`); fix fallout
