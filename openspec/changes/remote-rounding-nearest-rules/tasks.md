## 1. Shared contract and rounding logic

- [ ] 1.1 Widen `remoteRoundingRuleSchema` in `shared/types/remote-system-config.ts` with `nearest_15m`, `nearest_30m`, `nearest_1h` and update the type doc comment
- [ ] 1.2 Add the `nearest_*` branch (half-up) and the never-round-to-zero guard to `applyRoundingRule` in `shared/utils/rounding.ts`, documenting both in the function doc comment
- [ ] 1.3 Extend the rounding unit tests (`test/unit/rounding.spec.ts`) with the REQ-220/REQ-221 table: `1:03`, `1:07:30`, `1:11`, exact multiples, `0:04`, `0:00`, and `up_*` regression cases for all three increments

## 2. Backend validation

- [ ] 2.1 Verify the remote-system-config write endpoint accepts the new rules and still rejects unknown values with the `{ messageKey, params }` 422 contract (no handler change expected — enum-driven)
- [ ] 2.2 Add an integration test for the config endpoint covering a `nearest_30m` happy path and an unknown-rule 422 rejection

## 3. Configuration UI and i18n

- [ ] 3.1 Add `remoteSystemConfig.roundingRule.<id>` labels for all seven rules to `i18n/locales/en.json` and `pl.json`, keeping catalog parity
- [ ] 3.2 Render every accepted rule in the remote-system-config form select using those labels, ordered `none` → `up_*` → `nearest_*`
- [ ] 3.3 Add an E2E test that saves a `nearest_15m` configuration for a Client and reloads it to assert the persisted selection

## 4. Rounding suggestions on the Remote Sync row

- [ ] 4.1 Expose `suggestionsFor(taskId, selectedSeconds, rule)` from `app/composables/useRoundedDurations.ts` returning de-duplicated `exact` / `floor` / `ceil` values (`exact` only for `none`)
- [ ] 4.2 Add a unit test for `suggestionsFor` covering de-duplication, `none`, sub-increment totals, and exact multiples
- [ ] 4.3 Render the suggestions in the manageable row of `app/pages/sync/[date].vue` as keyboard-operable controls with translated labels and `data-testid="remote-sync-rounding-suggestion-{taskId}-{kind}"`, applying the value through the existing override setter
- [ ] 4.4 Add `remoteSync.roundingSuggestion*` i18n keys to `en.json` and `pl.json`
- [ ] 4.5 Add an E2E test on the Remote Sync page: choose a suggestion, assert the export duration changes, assert it survives an entry-selection change, and assert reset restores the rule default

## 5. Verification

- [ ] 5.1 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`
- [ ] 5.2 Run `pnpm test:unit`, `pnpm test:nuxt`, `pnpm test:e2e`
