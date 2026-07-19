## 1. Persistence and Shared Contracts

- [ ] 1.1 Add user-scoped remote export and export-entry Drizzle tables, relations, indexes, and a
  committed PostgreSQL migration without task/day or entry uniqueness constraints.
- [ ] 1.2 Add shared Zod schemas and DTOs for entry-level day review data, export provenance,
  finalization requests/results, remote logs, and per-task export outcomes.
- [ ] 1.3 Add database schema tests covering constraints, cascade behavior, and multiple provenance
  associations for the same task/day and entry.

## 2. Backend Day Review and Finalization

- [ ] 2.1 Expand the authenticated day-review query to return completed entries and prior export
  provenance per task while preserving timezone boundaries, user isolation, and credential secrecy.
- [ ] 2.2 Add unit/integration coverage for day-review entry details, prior-export markers, new entries
  after an export, cross-user isolation, and cross-midnight attribution.
- [ ] 2.3 Implement an authenticated export-finalization endpoint that validates the task, linked
  issue, local date, completed selected entries, exact payload, and remote ID before atomically
  appending provenance.
- [ ] 2.4 Add integration tests for successful finalization, known-result replay, repeat export,
  stale/mismatched/foreign entry rejection, invalid payloads, and atomic rollback on failure.

## 3. OpenProject Client and Transports

- [ ] 3.1 Add transport-agnostic builders/parsers for resolving the current OpenProject account,
  fetching its paginated time logs by date and linked work package, and creating a time entry.
- [ ] 3.2 Add unit tests for request filters, date and duration serialization, HAL parsing,
  pagination, malformed responses, and remote API errors.
- [ ] 3.3 Implement direct browser transport and authenticated Nitro proxy transport behind the same
  client operation contract, selected from remote-system configuration, while retaining browser
  orchestration and request deduplication.
- [ ] 3.4 Implement proxy authorization, configured-origin destination restrictions, sensitive-header
  redaction, and ephemeral credential forwarding without persistence.
- [ ] 3.5 Add integration tests for proxy authentication, origin restriction, credential secrecy,
  account/activity/log/create forwarding, pagination, malformed responses, and remote failures.
- [ ] 3.6 Add client contract and Nuxt tests proving direct/proxy behavior parity, transport selection,
  request deduplication, current-account filtering, and isolated activity/log/create failures.

## 4. Frontend Selection and Row State

- [ ] 4.1 Extend shared row-state derivation with activity loading, retryable failure, and successful
  `no_activity` states while keeping static prerequisite reasons deterministic.
- [ ] 4.2 Add unit tests for all row-state precedence paths, especially empty activity success versus
  transport failure.
- [ ] 4.3 Implement entry checkboxes selected by default, selected totals, rounded-default
  recomputation, retained user overrides, reset behavior, and zero/empty exclusion.
- [ ] 4.4 Add unit/Nuxt tests for default selection, subset totals, selection changes before and after
  an override, reset, and exclusion behavior.
- [ ] 4.5 Render translated and accessible no-activity reasons and retry controls, replacing the
  silent empty activity selector without blocking unrelated rows.
- [ ] 4.6 Add Nuxt tests for loading, available, empty, failed, and retried activity states including
  live-region announcements and keyboard operation.

## 5. Remote Context and Export Flow

- [ ] 5.1 Display current-account same-day OpenProject logs beside each linked task as informational
  context, with loading, paginated success, empty, and retryable error presentations.
- [ ] 5.2 Add Nuxt tests confirming remote logs do not alter local selection, infer provenance, or
  block an otherwise valid export, and that other accounts are excluded.
- [ ] 5.3 Implement the batch export orchestrator: validate included rows, warn and require explicit
  confirmation for selected entries with provenance, create one remote log per included task, and
  finalize each remote success locally.
- [ ] 5.4 Render accessible per-task success, remote failure, and uncertain-finalization outcomes;
  refresh remote context after uncertainty and warn that retry may duplicate a remote log.
- [ ] 5.5 Add Nuxt tests for repeat-export confirmation, mixed outcomes, excluded rows, successful
  provenance finalization, known-result replay, transport selection, and the
  remote-success/local-failure window.
- [ ] 5.6 Add E2E coverage for selecting a subset and exporting it, intentionally exporting a known
  entry again after confirmation, viewing existing current-account logs, and handling a no-activity
  task alongside a successful task in both direct and proxied modes.

## 6. Internationalization and Accessibility

- [ ] 6.1 Add matching English and Polish messages for entry selection, selected totals, contextual
  remote logs, no activities, retries, repeat warnings, exclusions, and all export outcomes.
- [ ] 6.2 Verify stable `data-testid` hooks, keyboard access, labels, focus behavior, text-based states,
  and live-region announcements across the expanded Remote Sync page.
- [ ] 6.3 Add or update Nuxt accessibility tests for the export controls, confirmation dialog, row
  results, retry actions, and no-activity stated reason.

## 7. Product Documentation Alignment

- [ ] 7.1 Review and update `docs/vision.md`, `docs/user-stories.md`, and `docs/wbs.md` wherever this
  change supersedes the lock cascade, permanent task/day pushed state, one-log-only model, or strict
  client-side idempotency claim; document user-selected exports, remote-log context, non-locking
  provenance, repeat warnings, both client transport paths, and the uncertain-finalization
  limitation.
- [ ] 7.2 Confirm Story 11b and WBS priorities/references remain internally consistent and that no
  obsolete locking requirement remains in glossary, lifecycle, remote-sync, or NFR sections.

## 8. Final Verification

- [ ] 8.1 Run migration/schema checks, lint, format check, type-check, and the affected unit and Nuxt
  projects; resolve all failures without weakening tests.
- [ ] 8.2 Run the remote-sync E2E suite against PostgreSQL and the OpenProject test environment,
  including mixed-result and uncertain-finalization scenarios, and document any external setup
  required for deterministic execution.