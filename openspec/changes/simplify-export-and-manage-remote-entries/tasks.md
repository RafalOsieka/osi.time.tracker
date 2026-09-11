## 1. Tracker-Scoped Provenance

- [ ] 1.1 Add required tracker identity and workspace-scoped remote-log uniqueness to export provenance,
  including a safe legacy backfill migration, and verify schema/migrator e2e tests cover successful
  backfill, cross-tracker duplicate IDs, and same-tracker rejection
- [ ] 1.2 Update sync-day and monthly-report DTOs/queries to expose and match tracker-scoped provenance,
  and verify backend unit/e2e tests cover user isolation and App/Direct classification

## 2. Provider-Neutral Deletion

- [ ] 2.1 Extend remote-tracker contracts and provider implementations with typed deletion outcomes for
  OpenProject and Redmine, and verify package unit tests cover deleted, not-found, rejected, and unknown
  outcomes
- [ ] 2.2 Extend client and browser-extension execution adapters/protocol validation for deletion without
  exposing credentials, and verify unit tests cover equivalent results and guarded extension failures

## 3. Reconciliation Backend

- [ ] 3.1 Add shared schemas and an authenticated endpoint that links an eligible remote entry to all
  completed local entries for a matching task/day, and verify API e2e tests cover success, differing
  duration, duplicate identity, ownership, issue/date mismatch, and existing task/day provenance
- [ ] 3.2 Add an authenticated endpoint that removes owned provenance after browser-confirmed deletion or
  not-found, and verify API e2e tests cover atomic cascade cleanup, idempotency, and foreign/stale requests
- [ ] 3.3 Update monthly aggregation for provenance added by links and removed after deletion, and verify
  report tests cover Direct-to-App reclassification and removal without cross-tracker ID collisions

## 4. Compact Export Frontend

- [ ] 4.1 Replace the three-phase export dialog with a compact task-title/duration confirmation and total,
  retain guarded sequential execution, then close, refresh, and toast the aggregate result; verify Nuxt
  tests cover cancel, all-success, partial failure, pending submission guard, and refreshed row states
- [ ] 4.2 Remove per-task report/retry and duration-based possible-duplicate UI/state, and verify existing
  export composable/component unit tests assert failed tasks remain normally actionable

## 5. Reconciliation Frontend

- [ ] 5.1 Render same-day remote logs as explicitly Linked or Unlinked and add translated accessible link
  confirmation/action flows; verify Nuxt tests cover eligibility, confirmation details, mismatched duration,
  success refresh, and API errors
- [ ] 5.2 Add translated accessible delete confirmation for Linked entries, execute remote deletion before
  local cleanup, retain provenance on ambiguous failures, and verify Nuxt tests cover deleted, not-found,
  rejected, and unknown outcomes
- [ ] 5.3 Add Playwright journeys for compact export, linking an unlinked entry, and deleting a linked entry
  through mocked client and extension transports, verifying tracker calls, refreshed states, and toasts

## 6. Integration Quality

- [ ] 6.1 Keep English and Polish catalogs in parity and verify lint catches no raw user-facing text or
  accessibility regressions in confirmation and row actions
- [ ] 6.2 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:nuxt`, and the
  relevant database/API/UI e2e projects, fixing any change-related failures