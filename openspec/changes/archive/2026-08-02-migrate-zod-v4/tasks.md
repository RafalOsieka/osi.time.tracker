## 1. Dependency bump & baseline

- [x] 1.1 Record the pre-migration baseline: count `error.*` message keys in `shared/types`, and list every occurrence of the nil UUID `00000000-0000-0000-0000-000000000000` in `test/`, classified as "unknown id" or "malformed id"
- [x] 1.2 Bump `zod` to `^4` in `package.json`, run `pnpm install`, and verify no second major of `zod` is reachable from application code
- [x] 1.3 Confirm `@nuxt/ui@4` resolves its zod peer without warnings and record the resolved version in the change notes

## 2. Automated migration (codemod)

- [x] 2.1 Run the `zod-v3-to-v4` codemod over `shared/`, `server/`, `app/`, and `test/`; commit the output verbatim as its own commit
- [x] 2.2 Review the codemod diff hunk-by-hunk; revert any rewrite that converts a plain message-key string into a function form or that touches test fixtures

## 3. Backend — shared boundary schemas

- [x] 3.1 `shared/types/auth.ts`, `client.ts`, `project.ts`, `task.ts`: replace residual `required_error` / `invalid_type_error` with the unified `error` option, preserving every translation key
- [x] 3.2 `shared/types/time-entry.ts`: same rewrite plus `z.uuid()` / `z.iso.datetime()` for `projectId`, `taskId`, `ids[]`, `startedAt`, `stoppedAt`, `from`, `to`
- [x] 3.3 `shared/types/remote-*.ts` (6 modules): same rewrite plus `z.url()` for `baseUrl`, `z.uuid()` for `remoteSystemConfigId`, and the unified `error` option on the three enums
- [x] 3.4 Spot-check that every pre-migration `error.*` key from task 1.1 still appears as a plain string (or as a returned value of an `error` function) exactly once per original site — no drops, no renames
- [x] 3.5 Confirm TypeScript still treats `remoteExecutionModeSchema.default('client')` as making `executionMode` optional on the create-config input type; fix call sites only if the inference changes

## 4. Backend — error mapper & identifier contract

- [x] 4.1 Drop the `received` branch from `server/utils/zod-error.ts`; keep `min` / `max` / `expected` / custom `params`
- [x] 4.2 Update `test/unit/zod-error.spec.ts` so the invalid-type case asserts `params` has no `received` key
- [x] 4.3 Add a unit assertion that `z.uuid()` rejects the nil UUID and accepts a UUIDv7 on a representative identifier field (e.g. `projectId`)
- [x] 4.4 Update e2e negative fixtures: replace every "unknown id" nil-UUID fixture with a well-formed non-existent UUIDv7 (still expects 404); keep deliberately malformed-id fixtures as-is and flip their expectation to 422; add an e2e assertion that a malformed id in a request body yields HTTP 422 with a `messageKey`

## 5. Frontend forms

- [x] 5.1 Confirm every `UForm :schema="…"` binding still type-checks against the migrated schemas (`pnpm type-check`)
- [x] 5.2 Verify `TimerAddEntryDialog` and `TimerBulkAssignDialog` still surface per-field errors from the shared schemas (existing unit/nuxt coverage, extend only if a gap appears)
- [x] 5.3 Extend the remote-system-config form test to assert that an invalid submission surfaces a translated error under zod 4

## 6. Docs, lint surface, final verification

- [x] 6.1 Update `CODING_STANDARDS.md` and `AGENTS.md`: zod 4, unified `error` option, top-level format constructors, no `received` in the error-mapper contract
- [x] 6.2 Grep `shared/types` for residual `required_error`, `invalid_type_error`, and `message:` option usage; also grep for method-form `.uuid(` / `.url(` / `.datetime(` — all must be clean
- [x] 6.3 Run the full suite green: `pnpm type-check`, `pnpm test:unit`, `pnpm test:nuxt`, `pnpm test:e2e`
