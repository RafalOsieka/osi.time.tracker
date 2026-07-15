## 1. Shared utilities & boundary types

- [ ] 1.1 Add `applyRoundingRule(totalSeconds, rule)` to `shared/utils` implementing `none`/`up_15m`/`up_30m`/`up_1h` (round up, exact multiples unchanged, 0 stays 0)
- [ ] 1.2 Unit tests for the rounding utility covering every rule, exact multiples, 0, and sub-minute sums
- [ ] 1.3 Add the pure row-state derivation function (`no_client | no_config | system_not_implemented | unlinked | manageable`) to `shared/utils`
- [ ] 1.4 Unit tests for row-state derivation covering each state and precedence order
- [ ] 1.5 Define day-review boundary types in `shared/types` (row DTO with task, project/client names, summed seconds, config surface, issue ref; untitled total) + zod date-param schema

## 2. OpenProject adapter: time-entry activities

- [ ] 2.1 Add `buildTimeEntryActivitiesRequest(baseUrl)` and `parseTimeEntryActivitiesResults(payload)` to `shared/utils/openproject-adapter.ts` (global time-entries schema, malformed payloads skipped, adapter-neutral `{ id, name }` options)
- [ ] 2.2 Unit tests for the activities request builder and parser (happy path, malformed payloads, empty allowed values)
- [ ] 2.3 Wire the activities request through the existing direct and proxied transports (browser credential rules unchanged)
- [ ] 2.4 Integration test for the proxied activities fetch (happy path + upstream failure mapped to `{ messageKey, params }`)

## 3. Backend: day-review endpoint

- [ ] 3.1 Implement `GET /api/sync/day` returning the user-scoped day-review aggregate (tasks with entries that day, summed unrounded durations, config surface, issue refs, untitled total; user-timezone day boundary shared with the Timer view; no credential material)
- [ ] 3.2 Integration tests for the endpoint: happy path aggregate, foreign-user isolation, invalid/missing date → 422, cross-midnight timezone attribution, no-config/no-project/unlinked rows present

## 4. Frontend: Remote Sync page

- [ ] 4.1 Create `app/pages/sync/[date].vue` skeleton: fetch day review, render all rows with state text/reason, "(no task)" bucket, empty state, day heading
- [ ] 4.2 Add the Remote Sync action to each Timer-view day header linking to the page
- [ ] 4.3 Render original duration plus editable rounded duration on manageable rows (pre-filled via the shared utility; blur/Enter commit, invalid input reverts, 0 shows the excluded-from-push hint; page state only)
- [ ] 4.4 Fetch activities once per remote config and render the per-row activity `Select`, pre-selected from `requiredFieldDefaults` when matching; inline translated error state on fetch failure
- [ ] 4.5 Embed the reusable remote-issue picker on unlinked rows; successful link flips the row to manageable in place
- [ ] 4.6 Add all `en`/`pl` i18n keys (states, reasons, labels, hints, errors) in parity and stable `data-testid` hooks
- [ ] 4.7 Accessibility pass: text-based state reasons, labeled controls, live-region announcements for async loads/errors, keyboard operability

## 5. Frontend tests

- [ ] 5.1 Nuxt component tests for the page: row states with reasons, rounded-duration editing (override, revert, 0-hint), activity pre-selection and fetch-failure state
- [ ] 5.2 E2E test: open Remote Sync from a Timer-view day, verify all-row listing with states, edit a rounded duration, link an issue inline and see the row become manageable
- [ ] 5.3 E2E/guard test: unauthenticated request to the page redirects to `/login` with redirect target

## 6. Verification & docs

- [ ] 6.1 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`, and all test projects; fix fallout
- [ ] 6.2 Update `docs/wbs.md` progress notes for WBS 5.8, 5.9, 5.12 and the fetch side of 5.13
