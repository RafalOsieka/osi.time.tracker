## 1. Backend: shared coverage exclude list

- [x] 1.1 Add `server/db/migrations/**`, `**/*.{sql,json}`, and `app/plugins/shared-chunk-warmup.ts` to `vitest.config.ts` `test.coverage.exclude` (keep existing excludes). Verify `pnpm test:coverage` writes `coverage/lcov.info` with no `migrations/meta`, no `.sql` SF paths, and no `shared-chunk-warmup` (REQ-024, REQ-279)
- [x] 1.2 Keep `c8 report` without Vitest `--include`/`--exclude` globs (filter is pre-remap on `.output` chunks). Keep the first-party-path fail-closed check. Verify the converter still accepts a dump that maps to `server/` and would reject a dump that only names `.output` chunks (REQ-277, REQ-279)

## 2. Frontend: composable unit tests (no self-mock)

- [x] 2.1 Add `test/unit/use-remote-sync-client.spec.ts` importing the real composable, mocking `createRemoteAdapter` and `useTrackerSecret`. Cover account cache reuse, in-flight coalescing, log cache hit, `invalidateCaches`, successful `createTimeEntry`, and adapter-error → translation key. Verify `pnpm exec vitest run --project unit -t "useRemoteSyncClient"` (REQ-177)
- [x] 2.2 Add `test/unit/use-active-trackers.spec.ts` with `$fetch` mocked: successful load keyed by id, fetch error leaves empty map, cache skip on second `ensureAllLoaded`, unknown id stored as null. Verify `pnpm exec vitest run --project unit -t "useActiveTrackers"`

## 3. Frontend: settings page in-process coverage

- [x] 3.1 Add `test/nuxt` spec mounting `app/pages/settings.vue` with `useColorMode.unknown` stubbed false. Cover timezone persist failure (mocked `save` rejects → error toast, previous timezone restored) and a successful persist without a Save button. Verify `pnpm exec vitest run --project nuxt` for that file (REQ-167). Existing Playwright `user-settings-ui.spec.ts` remains the journey test; do not add UI coverage collection

## 4. Backend: API error-arm tests

- [x] 4.1 In `test/e2e/api/projects.spec.ts`, PATCH a project to another project's name in the same tracker scope and expect 422 `error.projectNameDuplicate`. Verify `pnpm exec vitest run --project e2e-api -t` that case (REQ-086)
- [x] 4.2 In `test/e2e/api/trackers.spec.ts`, PATCH-rename into a colliding tracker name and expect 422 `error.trackerNameDuplicate`. Verify the focused e2e-api test (REQ-246)
- [x] 4.3 In `test/e2e/api/remote-export-proxy.spec.ts`, drive `/api/remote/time-logs` and `/api/remote/time-entries` with `rejected-secret` and with an unreachable `baseUrl`; expect `error.remoteServerModeAuthRejected` / `error.remoteServerModeConnectionFailed` and no secret in the body. Verify the focused e2e-api tests (REQ-255)

## 5. Docs

- [x] 5.1 Document the shared exclude list and “UI e2e still does not upload coverage” in `docs/e2e-guideline.md`; fix the `AGENTS.md` `test:coverage` bullet if it still implies only unit+nuxt files matter. Verify the docs mention both Vitest and `c8` (REQ-279)
