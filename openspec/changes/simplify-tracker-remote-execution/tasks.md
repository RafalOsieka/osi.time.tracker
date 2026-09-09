## 1. Database and Backend Contract

- [x] 1.1 Add a tracker migration that maps `client` to `directBrowserAccess: true` and `extension` to `false`, removes the obsolete execution-mode column/type, and verify both mappings plus preserved tracker relationships in database migration tests.
- [x] 1.2 Replace `executionMode` with default-true `directBrowserAccess` in the Drizzle schema and shared tracker schemas/DTOs, then verify type-check and shared schema unit tests cover defaults and non-boolean rejection.
- [x] 1.3 Update tracker create, list, and update handlers and database mappings to use `directBrowserAccess`, then verify API integration tests cover successful round trips, omitted-field defaulting, invalid input, ownership, and unchanged related records after edits.

## 2. Transport Selection

- [x] 2.1 Update remote adapter construction and all first-party callers to derive direct or extension transport solely from `directBrowserAccess`, with no fallback, and verify focused unit tests cover both values and transport failures.
- [x] 2.2 Update remote search, sync, and export fixtures/contracts from execution mode to direct-browser capability while retaining contextual extension failures, then verify the affected unit and API test projects pass.

## 3. Tracker Configuration Frontend

- [x] 3.1 Replace the execution-mode selector in tracker create/edit with the default-enabled **Direct browser connection allowed** checkbox and focusable localized help, remove its proactive extension status panel, and verify component tests cover create/edit values, help access, and saving while extension setup is unavailable.
- [x] 3.2 Update English and Polish tracker labels/help with parity and verify lint plus i18n catalog checks pass.
- [x] 3.3 Update the tracker-management UI journey to verify the checkbox default, persisted edit behavior, accessible help, and removal of the duplicate readiness panel in the relevant Nuxt or UI E2E test.

## 4. Centralized Extension Readiness

- [x] 4.1 Extend the extension bridge/availability model to expose compatibility, current website approval, and exact per-tracker destination approvals without credentials, and verify utility/composable unit tests cover unavailable, incompatible, website-unapproved, destination-unapproved, and approved responses.
- [x] 4.2 Implement pure aggregate-state and required-first ordering logic for neutral, red, orange, and green outcomes, ensuring optional direct-capable approvals never downgrade status, and verify exhaustive unit tests cover precedence and empty tracker sets.
- [x] 4.3 Add the extension-status row immediately below the sidebar user menu with collapsed presentation and localized non-color status semantics, then verify Nuxt component tests cover placement and every aggregate state.
- [x] 4.4 Add the bounded informational approval-details popover with hover, focus, and click/tap triggers while leaving approval initiation to contextual extension flows, then verify Nuxt component tests cover keyboard/touch opening, required-first details, optional labels, and focus behavior.
- [x] 4.5 Remove the proactive extension panel from remote-issue selection while preserving operation-specific errors and recovery actions, then verify its component tests cover both successful extension use and incomplete setup failure.
- [x] 4.6 Add or update a responsive authenticated-shell journey that verifies the footer status and popover in expanded, collapsed, keyboard, and touch/mobile contexts, including neutral status when no tracker requires the extension.

## 5. Documentation and Verification

- [x] 5.1 Update product documentation that still describes user-selected execution modes to describe direct-browser capability and deterministic transport, then verify repository search leaves no stale current-contract guidance.
- [x] 5.2 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:nuxt`, and the relevant database/API/UI E2E projects; resolve failures without weakening tests.