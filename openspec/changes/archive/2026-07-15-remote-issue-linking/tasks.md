## 1. Shared Contracts and Adapter Core

- [x] 1.1 Add shared remote issue reference, title/ID search query and result, and link request/response types plus the single Zod request schema.
- [x] 1.2 Define the transport-agnostic adapter interface and implement OpenProject work-package title-filter requests, exact-ID lookup, bounded result parsing, and issue URL derivation.
- [x] 1.3 Add unit tests for OpenProject URL normalization, encoded title filters and IDs, exact-ID lookup, bounded parsing, malformed payloads, not-found IDs, and all-status result handling.

## 2. Persistence and Backend Reference Lifecycle

- [x] 2.1 Add the one-to-one `remote_issue_refs` Drizzle schema with ownership, configuration provenance, indexes, relations, and exports.
- [x] 2.2 Generate and review the PostgreSQL migration for the reference table, uniqueness constraints, and lifecycle-compatible foreign keys.
- [x] 2.3 Add backend query helpers that resolve an owned Task through Project and Client, persist/replace/unlink references, and expose cached references with URLs only for active configurations.
- [x] 2.4 Add backend unit or integration tests for reference persistence, replacement, idempotent unlink, active URL derivation, deleted-configuration bare references, and cross-user isolation.

## 3. Link and Unlink APIs

- [x] 3.1 Implement authenticated, CSRF-protected Task link and unlink endpoints using shared validation, server-derived configuration provenance, and `{ messageKey, params }` errors.
- [x] 3.2 Add API integration tests covering link, replacement, idempotent unlink, invalid input, project-less Tasks, missing or Redmine configurations, foreign/unknown Tasks, authentication, and credential non-persistence.
- [x] 3.3 Enrich Task and Timer/time-entry DTO query paths with the cached remote reference and optional derived URL without per-row requests.
- [x] 3.4 Add backend integration tests for enriched linked, unlinked, and deleted-configuration responses with strict user isolation.

## 4. Task Merge and Configuration Lifecycle

- [x] 4.1 Extend the Task edit transaction to transfer a sole reference, collapse identical references, and reject different references atomically with HTTP 409.
- [x] 4.2 Add integration tests for unlinked merges, source-only and survivor-only references, identical references, conflicting references, rollback integrity, and returned survivor DTOs.
- [x] 4.3 Verify remote configuration update and soft-delete paths retain reference records while deleted configurations remain unavailable to search and URL generation.
- [x] 4.4 Add integration tests for identity-changing updates, configuration deletion, secret clearing behavior, preserved references, and non-rebinding after replacement configuration creation.

## 5. Browser Search and Frontend UI

- [x] 5.1 Implement the browser-side OpenProject transport/composable using active configuration and `useRemoteConfigSecret`, with explicit title/ID modes, title-length and ID validation, bounded title results, exact-ID lookup, stale-request suppression, and translated errors.
- [x] 5.2 Add unit tests for both search modes, submission gating, authorization construction, stale-response handling, not-found/error mapping, and proof that the credential is sent only to OpenProject.
- [x] 5.3 Build the reusable accessible issue picker with a pencil-icon Task-row `Button` opening a PrimeVue `Popover` containing a mode `Select`, `InputText`, submit `Button`, and selectable results list plus validation, loading, empty, error, select, replace, and unlink states.
- [x] 5.4 Integrate the two-part remote-issue control into eligible Timer Task rows: generated `#<issue-id>` anchor with cached-title tooltip or translated `(unlinked)` status, separate sibling pencil action, disabled Redmine explanation, and complete omission for Tasks without a resolvable active configuration.
- [x] 5.5 Add and parity-check English and Polish translations for picker labels, statuses, errors, disabled explanations, unlinking, and merge conflicts.
- [x] 5.6 Update CSP `connect-src` behavior for configured HTTP(S) tracker requests while retaining the existing security baseline.
- [x] 5.7 Add Nuxt component tests for keyboard interaction, accessible names and announcements, linked anchor URL, hover/focus title tooltip, unlinked status, sibling-control semantics, Popover search-form and result-list states, both search modes, link replacement, unlinking, Redmine, and omitted rendering without an active configuration.

## 6. End-to-End Verification

- [x] 6.1 Add e2e coverage for title and exact-ID searches from a Timer Task-row picker and for persisting, displaying as `#<issue-id>` with generated URL and cached-title tooltip, replacing, and unlinking a selected reference.
- [x] 6.2 Add e2e coverage for explicit search submission, invalid title/ID input, ID not found, remote failures, bounded title results, merge conflict feedback, and sole-reference merge preservation.
- [x] 6.3 Run lint, format checks, unit tests, Nuxt tests, relevant PostgreSQL e2e tests, and a production build; resolve all regressions.
- [x] 6.4 Manually verify the local OpenProject CORS flow, keyboard-only picker use, generated issue links, and absence of the API credential from OSI server traffic and logs.