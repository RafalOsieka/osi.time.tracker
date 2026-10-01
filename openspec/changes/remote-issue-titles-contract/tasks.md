# Tasks

## 1. Contract type (backend: `packages/remote-trackers`)

- [ ] 1.1 Change `RemoteTimeLogDto.remoteIssueTitle` to a required `string | null` in `src/contracts/remote-time-log.ts`, update its doc comment to the REQ-341/REQ-378 semantics, and update the fixture in `test/contracts/adapter-contract.spec.ts`; verify `pnpm package:check` type-checks (expect the adapters to fail until groups 2–3 land).

## 2. Redmine title resolution (backend: `packages/remote-trackers/src/redmine`)

- [ ] 2.1 Add a client method that fetches `/issues.json?issue_id=<csv>&status_id=*&limit=100` and returns id → subject, zod-parsed like the existing issue payloads; cover it in `test/redmine/client.spec.ts` (query string includes `status_id=*`, ids absent from the payload are absent from the map, auth header present).
- [ ] 2.2 Add adapter `getIssuesByIds` (chunks of 100) and call it after the page loop in both `fetchTimeLogs` and `fetchTimeLogsInRange`, inside the existing `try`, filling `null` for unreturned ids; cover in `test/redmine/adapter.spec.ts`: titles filled, closed issue resolved, unreturned id → `null`, 230 distinct ids → 3 lookup requests, lookup timeout → `RemoteAdapterError('error.remoteTimeLogsFetchFailed')`, issue-less entries trigger no lookup.

## 3. OpenProject title resolution (backend: `packages/remote-trackers/src/openproject`)

- [ ] 3.1 Add a client method that fetches `/api/v3/work_packages` filtered by `id = [...]` with `pageSize=100` and returns id → subject; cover it in `test/openproject/client.spec.ts` (filter JSON shape, missing ids absent).
- [ ] 3.2 Add adapter `getIssuesByIds` and run it after paging only for logs whose HAL links lack a title, mapping unreturned ids to `null`; cover in `test/openproject/adapter.spec.ts`: complete payload makes zero work-package requests, missing title is resolved, invisible work package → `null`, lookup failure fails the fetch.

## 4. Extension bridge (backend: `packages/extension-protocol`, `apps/extension`)

- [ ] 4.1 Change `remoteTimeLogSchema.remoteIssueTitle` to `z.string().nullable()`, update the REQ-341 comment, and bump `EXTENSION_PROTOCOL_VERSION` to `2`; extend `packages/extension-protocol/test/protocol.spec.ts` to assert a log with `remoteIssueTitle: null` passes, a log missing the key fails, and a v1 handshake is rejected; verify `contract-agreement.ts` still type-checks via `pnpm type-check`.
- [ ] 4.2 Rebuild the extension against protocol v2 and verify `apps/extension/test/unit/bridge.spec.ts` passes, including a case that an unknown `getIssuesByIds` operation is rejected before any tracker request.

## 5. Web consumers (frontend: `apps/web`)

- [ ] 5.1 In `use-remote-log-import`, send `remoteIssueTitle` only when it is a string (omit `null`) so the unchanged import body schema accepts it; add cases to `test/unit/use-remote-log-import.spec.ts` for a `null` title (key omitted) and a Redmine-style log with a resolved title (forwarded).
- [ ] 5.2 Update remaining web fixtures/types that build `RemoteTimeLogDto` (Remote Sync day logs, monthly report, import dialog tests) to the required nullable field; verify `pnpm type-check`, `pnpm test:unit` and `pnpm test:nuxt` pass.
- [ ] 5.3 Extend the import UI e2e (`test/e2e/ui`, mocked Redmine via `page.route`) so an imported Redmine log's linked task shows the issue subject instead of the bare issue id; verify `pnpm test:e2e:ui` passes.

## 6. Integration

- [ ] 6.1 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:nuxt`, `pnpm test:e2e`, and manually check against the local `trackers` profile that a Redmine month fetch on the Trackers import dialog lists issue titles and the extension shows the update state until reloaded.
