## 1. Schema

- [x] 1.1 Backend: Remove `requiredFieldDefaults` from `server/db/schema/trackers.ts`, generate a committed SQL migration that `DROP COLUMN`s it, and leave historical migrations unchanged (D1). Verify the new SQL exists under `server/db/migrations` and the journal lists it.
- [x] 1.2 Backend test: Run `pnpm test:e2e:db` and confirm the migrator applies the new drop on an empty database (REQ-250 removal).

## 2. Shared boundary types

- [x] 2.1 Backend: Drop `requiredFieldDefaults` from `createTrackerSchema` / `updateTrackerSchema` / `TrackerDto` and from `RemoteSyncConfigSurfaceDto`. Do not enable `strict()` on tracker bodies (D2). Verify `pnpm type-check` reports only remaining test/fixture references.
- [x] 2.2 Backend test: Update `test/unit/tracker-schema.spec.ts` (and any sibling tracker zod specs) so a body that still includes `requiredFieldDefaults` parses successfully with the field stripped, and a valid create without it still succeeds. Verify `pnpm exec vitest run --project unit -t "createTrackerSchema"`.

## 3. Tracker API

- [x] 3.1 Backend: Stop reading or writing `requiredFieldDefaults` in `GET/POST /api/trackers` and `PATCH /api/trackers/[id]` DTO mapping. Verify handlers compile against the new schema (REQ-244, REQ-245).
- [x] 3.2 Backend test: Extend `test/e2e/api/trackers.spec.ts` so list/create/patch responses omit `requiredFieldDefaults`, and a create/update that still sends the field returns 200 without persisting it. Verify `pnpm exec vitest run --project e2e-api test/e2e/api/trackers.spec.ts`.

## 4. Sync day API

- [x] 4.1 Backend: Remove `requiredFieldDefaults` from the tracker config surface built in `server/api/sync/day.get.ts` (REQ-115). Verify the handler compiles.
- [x] 4.2 Backend test: Assert in `test/e2e/api/sync-day.spec.ts` that `row.config` has no `requiredFieldDefaults` while still carrying system type, rounding, execution mode, base URL, and id. Verify `pnpm exec vitest run --project e2e-api test/e2e/api/sync-day.spec.ts`.

## 5. Remote Sync activity pre-fill

- [x] 5.1 Frontend: In `app/pages/sync/[date].vue`, delete the tracker-default activity fallback; keep explicit page state then last-export `requiredFieldValues.activity` when it is still a fetched option; otherwise leave the select unselected. Drop the field from `toPickerConfig` (REQ-114, D3). Verify the page type-checks.
- [x] 5.2 Frontend test: Rewrite `test/nuxt/remote-sync-page.spec.ts` so activity pre-selects from last-export provenance, stays unselected without provenance, and fixtures no longer set `requiredFieldDefaults`. Verify `pnpm exec vitest run --project nuxt test/nuxt/remote-sync-page.spec.ts`.
- [x] 5.3 Frontend test: Update `test/e2e/ui/remote-sync-ui.spec.ts` to stop seeding tracker `requiredFieldDefaults`; select activity in the UI or seed prior-export provenance instead. Verify the Remote Sync export journey still passes via `pnpm exec vitest run --project e2e-ui test/e2e/ui/remote-sync-ui.spec.ts`.

## 6. Remaining fixtures

- [x] 6.1 Backend/Frontend test: Remove `requiredFieldDefaults` from remaining unit/nuxt TrackerDto mocks (`use-*-*.spec.ts`, `trackers.spec.ts`, `remote-issue-*.spec.ts`, `create-remote-adapter.spec.ts`, `timer-task-group.spec.ts`, and helpers). Verify `pnpm type-check` is clean and `rg requiredFieldDefaults --glob '!server/db/migrations/**'` has no production or test hits.

## 7. Secret storage comment

- [x] 7.1 Frontend: Add a short comment on `useTrackerSecret` documenting why the API secret stays plaintext in `localStorage` (`rsc:` keys; CSP is the XSS control; client-side encryption would not change same-origin JS access; server-side encrypted storage is WBS 5.4). Do not change get/set/clear behavior (D4). Verify the composable still type-checks.
- [x] 7.2 Frontend test: Run `pnpm exec vitest run --project nuxt test/nuxt/use-tracker-secret.spec.ts` and confirm get/set/clear against `rsc:` keys still pass.

## 8. Product docs

- [x] 8.1 Docs: Remove required-field defaults from Tracker language in `docs/vision.md`, `docs/wbs.md`, and `docs/user-stories.md` (D5). Verify those files no longer mention the field or “optional defaults” as a Tracker capability.

## 9. Gate

- [x] 9.1 Verification: Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:nuxt`, and `pnpm test:e2e` green.
