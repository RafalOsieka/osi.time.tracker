## 1. Dependency bump & baseline

- [ ] 1.1 Record the pre-migration baseline: count `error.*` message keys in `shared/types`, and list every occurrence of the nil UUID `00000000-0000-0000-0000-000000000000` in `test/`, classified as "unknown id" or "malformed id"
- [ ] 1.2 Bump `zod` to `^4` in `package.json`, run `pnpm install`, and verify no second major of `zod` is reachable from application code
- [ ] 1.3 Confirm `@nuxt/ui@4` resolves its zod peer without warnings and record the resolved version in the change notes

## 2. Automated migration (codemod)

- [ ] 2.1 Run the `zod-v3-to-v4` codemod over `shared/`, `server/`, `app/`, and `test/`; commit the output verbatim as its own commit
- [ ] 2.2 Review the codemod diff hunk-by-hunk; revert any rewrite that converts a plain message-key string into a function form or that touches test fixtures

## 3. Backend — shared boundary schemas

- [ ] 3.1 `shared/types/auth.ts`, `client.ts`, `project.ts`, `task.ts`: replace residual `required_error` / `invalid_type_error` with the unified `error` option, preserving every translation key
- [ ] 3.2 `shared/types/time-entry.ts`: same rewrite plus `z.uuid()` / `z.iso.datetime()` for `projectId`, `taskId`, `ids[]`, `startedAt`, `stoppedAt`, `from`, `to`
- [ ] 3.3 `shared/types/remote-*.ts` (6 modules): same rewrite plus `z.url()` for `baseUrl`, `z.uuid()` for `remoteSystemConfigId`, and the unified `error` option on the three enums
- [ ] 3.4 Sweep the remaining deprecated `message:` options to `error:` across all 12 modules, including `.refine()` calls
- [ ] 3.5 Verify `remoteExecutionModeSchema.default('client')` still yields an optional input at every `CreateRemoteSystemConfigDto` call site under the v4 `.default()` input typing
- [ ] 3.6 Add a unit spec asserting that identifier schemas reject the nil UUID and accept a UUIDv7 value (covers REQ-234)
- [ ] 3.7 Add a unit spec (or lint-style assertion) that no `required_error`, `invalid_type_error`, or `message:` option remains in `shared/types`

## 4. Backend — error mapper contract

- [ ] 4.1 Rewrite `server/utils/zod-error.ts` against the v4 issue shape: keep `min`, `max`, `expected` and custom `params`; stop emitting `received`
- [ ] 4.2 Update `test/unit/zod-error.spec.ts` to the new contract, including a case asserting `params` has no `received` key (covers REQ-158)
- [ ] 4.3 Verify the ~20 `server/api` handlers still catch `ZodError` correctly under v4 and continue to throw `422` with `{ messageKey, params }`
- [ ] 4.4 Add an e2e assertion that a malformed identifier in a request body returns `422` with a `messageKey`, and that a well-formed unknown identifier still returns `404` (covers REQ-172)

## 5. Frontend

- [ ] 5.1 Migrate the client-side form schemas (`timerAddEntryFormSchema`, `timerBulkAssignFormSchema`, remote-config and auth forms) to the v4 idiom
- [ ] 5.2 Verify `UForm` still surfaces per-field errors from a v4 schema in the `nuxt` test project (timer add-entry and bulk-assign dialogs)
- [ ] 5.3 Add/extend an e2e test covering an invalid submission in the remote-system-config form, asserting the translated error is shown

## 6. Test fixtures

- [ ] 6.1 Export a single deterministic "valid but unknown" UUIDv7 constant from the e2e support module
- [ ] 6.2 Replace every "unknown id" nil-UUID fixture (clients, projects, time-entries, tasks-remote-issue-ref, remote-*-proxy) with that constant, keeping the `404` expectation
- [ ] 6.3 Keep deliberately malformed-id fixtures as-is and flip their expectation to `422`

## 7. Documentation

- [ ] 7.1 Update `CODING_STANDARDS.md` §5/§6 to name the unified `error` option as the idiom and require `z.uuid()` / `z.url()` / `z.iso.datetime()` for identifier and format fields
- [ ] 7.2 Update `AGENTS.md` if it pins a zod version, and note the `params` contract change (no `received`)

## 8. Verification

- [ ] 8.1 `pnpm type-check` passes with no zod-related errors
- [ ] 8.2 `pnpm test:unit` and `pnpm test:nuxt` pass
- [ ] 8.3 `pnpm test:e2e` passes against the production build
- [ ] 8.4 `pnpm lint` and `pnpm format:check` pass
- [ ] 8.5 Confirm the `error.*` message-key count in `shared/types` matches the 1.1 baseline (no key silently dropped)
