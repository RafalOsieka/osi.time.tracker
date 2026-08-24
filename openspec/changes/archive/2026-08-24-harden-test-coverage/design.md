## Context

See `proposal.md` for why. Combined Codecov today merges flags `unit-nuxt` (Vitest `include: app|server|shared`) and `e2e-api` (`c8 report` with no include/exclude). Drizzle snapshots under `server/db/migrations/meta/` therefore show as 0% misses. Playwright journeys are out of this change (REQ-277). Existing product requirements already describe PATCH duplicate names (REQ-086) and proxy error mapping (REQ-255); the gaps are tests, not new API behavior.

## Goals / Non-Goals

**Goals:**

- Same exclude set on both coverage flags so Codecov stops scoring JSON/SQL and the never-run warmup plugin.
- In-process tests for composables currently mocked away (`useRemoteSyncClient`, cheap `useActiveTrackers`).
- Nuxt coverage of the settings timezone save-failure path so `/settings` is no longer 0% on Codecov.
- API e2e for PATCH-duplicate and remote time-log/time-entry proxy failures.

**Non-Goals:**

- A merged local lcov command (Codecov remains the combiner).
- Changing `codecov.yml` informational policy.
- Collecting or uploading UI coverage.

## Decisions

### 1. Vitest exclude list is not applied to `c8`

Add `server/db/migrations/**`, `**/*.{sql,json}`, and `app/plugins/shared-chunk-warmup.ts` to `vitest.config.ts` `test.coverage.exclude` (keep existing excludes). `c8 report` must **not** receive those globs or `--include app/**,server/**,shared/**`: c8 matches compiled `.output` chunks *before* sourcemap remap, so those patterns drop the Nitro dump (seen on PR #75: e2e-api collapsed to 1 file). Keep c8 defaults and the first-party-path fail-closed check.

**Alternative considered:** pass the same include/exclude to both tools. Rejected after CI: `--include app/**` filtered `.output/server/chunks/*.mjs` before remap. `--exclude-after-remap` plus extra extensions (`.vue`) is more machinery than needed.

**Alternative considered:** post-process `lcov.info` with a regex strip. Rejected: two reports would drift, and Codecov would still ingest junk if one converter is forgotten.

### 2. Cover the remote client by testing it, not by un-mocking page specs

Add `test/unit/use-remote-sync-client.spec.ts` that imports the real composable and mocks `createRemoteAdapter` / `useTrackerSecret`. Leave `remote-sync-page.spec.ts` and `use-remote-day-logs.spec.ts` mocks in place so those files stay focused.

**Alternative considered:** remove the mocks from the page spec so coverage "falls out" of nuxt. Rejected: the page spec would become an integration test of adapters, cache, and UI at once.

`useActiveTrackers` gets a small unit spec with `$fetch` mocked (load, error, cache, unknown id). `useAppToast` is covered by the settings nuxt mount calling `toast.error`; no dedicated spec unless that mount cannot reach it.

### 3. Settings coverage is a nuxt mount, not Playwright instrumentation

New `test/nuxt` spec mounts `app/pages/settings.vue`, stubs Nuxt UI selects, mocks `useUserSettings().save` to reject, drives timezone change, asserts the error toast and restored previous timezone (REQ-167). Optional: successful persist updates session-backed timezone without a Save button.

**Alternative considered:** enable Playwright coverage and a third Codecov flag. Rejected for this change (proposal non-goal). The existing `user-settings-ui.spec.ts` journey stays as-is and still does not affect the badge.

### 4. API error arms are extra `it`s in existing files

- `test/e2e/api/projects.spec.ts`: PATCH a project to another project's name in the same tracker scope → 422 `error.projectNameDuplicate` (REQ-086).
- `test/e2e/api/trackers.spec.ts`: PATCH rename collision → 422 `error.trackerNameDuplicate`.
- `test/e2e/api/remote-export-proxy.spec.ts`: reuse the fake tracker `rejected-secret` 401 (and an unreachable base URL) on `/api/remote/time-logs` and `/api/remote/time-entries`, asserting `error.remoteServerModeAuthRejected` / `error.remoteServerModeConnectionFailed` without echoing the secret (REQ-255). Search/activities already cover this shape; create/logs do not.

**Alternative considered:** generic "catch-all 500" tests for every handler. Rejected: those arms are uninteresting; unique-constraint and adapter-error mapping are the ones users see.

### 5. Docs, not thresholds

Note the shared exclude list in `docs/e2e-guideline.md` (and a one-line `AGENTS.md` if the coverage bullet is now misleading). Do not add a Codecov numeric target.

## Risks / Trade-offs

- **[Risk]** `c8 --include` is too tight and the fail-closed "no first-party paths" check fires in CI. → Mitigation: include `app/**`, `server/**`, `shared/**` explicitly; run the converter locally against an existing dump if present, otherwise verify on the first CI api job.
- **[Risk]** Settings nuxt mount flakes on `colorMode.unknown` / 1.5s timeout. → Mitigation: stub `useColorMode` so `unknown` is false immediately; do not wait on the real cookie.
- **[Risk]** Exclude list hides a future JSON module that is actually executed. → Mitigation: only glob `*.json` / `*.sql` and the known warmup plugin; TypeScript sources stay included.
- **[Trade-off]** `/settings` Playwright hits still do not count. Codecov will rise because of the nuxt mount, not because UI e2e started reporting.

## Migration Plan

No runtime migration. Land excludes and tests together so the badge does not jump twice. Rollback is revert; coverage stays informational.

## Open Questions

None. Target percentage (~93–95%) is a hope, not a gate; we stop when the listed files are excluded and the listed tests are green.
