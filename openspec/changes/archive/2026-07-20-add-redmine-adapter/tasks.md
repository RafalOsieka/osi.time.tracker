## 1. Neutral-layer refactor (pre-work, OpenProject-preserving)

- [x] 1.1 Move `normalizeBaseUrl` from `shared/remote/openproject/utils.ts` to a neutral shared location and update all imports
- [x] 1.2 Replace `RemoteRequest.secret` with `RemoteRequest.headers` in `shared/types/remote-adapter.ts`; strip auth logic from `clientFetchTransport` and `createServerFetchTransport` so they only merge provided headers
- [x] 1.3 Move Basic-auth construction (`apikey:<secret>`, `btoa`/`Buffer` fallback) into the OpenProject client; verify the emitted header is byte-identical
- [x] 1.4 Add `shared/remote/issue-url.ts` with a `Record<RemoteSystemType, (baseUrl, id) => string>` dispatch table and switch `server/utils/remote-issue-refs.ts` to it
- [x] 1.5 Run the existing OpenProject unit and e2e suites to confirm zero behavioral change

## 2. Redmine client (L3)

- [x] 2.1 Create `shared/remote/redmine/utils.ts`: decimal-hours converters (`secondsToRedmineHours` at 0.01 h precision, `redmineHoursToSeconds`) and the `X-Redmine-API-Key` header builder
- [x] 2.2 Create `shared/remote/redmine/client.ts` with one method per endpoint: subject search (`/issues.json`, `status_id=*`, 25-result cap), issue-by-id, global time-entry activities enumeration, current user, offset/limit-paginated time entries, and time-entry creation
- [x] 2.3 Implement tolerant payload parsers (skip malformed elements, never throw on shape) mirroring the OpenProject client conventions

## 3. Redmine adapter (L2)

- [x] 3.1 Create `shared/remote/redmine/adapter.ts` implementing `RemoteTrackerAdapter`: 404-on-id → `null`, bounded pagination loop, upstream-status → `messageKey` error mapping consistent with `OpenProjectAdapter`
- [x] 3.2 `getActivityOptions(remoteIssueId)` accepts and ignores the issue id, returning the global enumeration list

## 4. Unlock the gates

- [x] 4.1 Add `case 'redmine'` to `app/utils/remote/create-remote-adapter.ts` and `server/utils/remote/create-server-remote-adapter.ts`
- [x] 4.2 Remove the 409 `error.remoteIssueConfigNotOpenProject` gate from `server/api/tasks/[id]/remote-issue-ref.post.ts`
- [x] 4.3 Remove the `isRedmineConfig` disabled-picker state from `app/components/TimerTaskGroup.vue`
- [x] 4.4 Retire the `editDisabledRedmine` key and remove any now-unused Redmine gate keys from `i18n/en.json` and `i18n/pl.json` in parity

## 5. Tests

- [x] 5.1 Add `test/unit/redmine-utils.spec.ts` (hours converters incl. round-trip stability and `up_*` losslessness; header builder)
- [x] 5.2 Add `test/unit/redmine-client.spec.ts` (request shapes, parsers, pagination bounds) and `test/unit/redmine-adapter.spec.ts` (quirks, error mapping)
- [x] 5.3 Flip `create-remote-adapter` / `create-server-remote-adapter` factory specs from Redmine rejection to Redmine construction
- [x] 5.4 Update transport unit specs for the headers-based `RemoteRequest`
- [x] 5.5 Update `test/e2e/tasks-remote-issue-ref.spec.ts` and `test/e2e/clients-remote-config-ui.spec.ts` (and any nuxt specs asserting the disabled picker) to the enabled-Redmine behavior

## 6. Verification

- [x] 6.1 `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:nuxt`, `pnpm test:e2e` all green
- [x] 6.2 Manual smoke test against the local Redmine dev environment (link an issue, fetch activities, export a rounded entry, re-fetch the day's logs) in both `client` and `server` execution modes
