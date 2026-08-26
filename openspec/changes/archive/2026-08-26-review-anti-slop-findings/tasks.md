## 1. Types, standards, lint policy

- [x] 1.1 Add `MessageParams` / `MessageParamValue` in `shared/types` (or next to `ApiMessage`) and switch `ApiMessage.params` off `Record<string, unknown>`; verify `pnpm type-check` includes the new type
- [x] 1.2 Point `mapZodError` output at `MessageParams`; keep omitting `received`; verify `test/unit/zod-error.spec.ts` still passes and types `params` as primitives
- [x] 1.3 Update `CODING_STANDARDS.md` and `AGENTS.md`: no `unknown` on helpers, unannotated `catch`, no ad hoc `typeof`, `MessageParams`, do not edit `tools/oxlint/anti-slop/`; verify those docs no longer recommend `err: unknown` + `typeof`

## 2. Backend — extractors, catch, db, spreads

- [x] 2.1 Replace `unknown` parameters on server/shared error helpers (`toAdapterError`, `getUpstreamStatus`, `extractRemoteErrorKey` server-side, etc.) with named types / `instanceof` / `isX`; strip `catch (err: unknown)` to `catch (err)`; verify no `catch (err: unknown)` remains under `server/` and `shared/`
- [x] 2.2 Remove ad hoc `typeof` ladders in `server/utils/zod-error.ts` and shared remote clients/adapters; verify `pnpm exec oxlint` reports no `no-runtime-typeof` under `server/` and `shared/`
- [x] 2.3 Replace `Reflect.get` on the lazy `db` Proxy (`server/db/index.ts`) with typed property access or a getter; verify `anti-slop/no-reflect-get` is gone and existing db unit tests still pass
- [x] 2.4 Fix empty object spreads in `server/api/time-entries/[id].patch.ts` and shared OpenProject/Redmine clients; verify `no-conditional-empty-object-spread` is gone there
- [x] 2.5 Fix `no-known-value-widening` and `no-unknown-returns` under `server/` and `shared/` (`satisfies` / named return types); verify those rules are clean in those trees
- [x] 2.6 Extend or add unit tests for `mapZodError`, adapter error mapping, and day/db helpers touched in 2.1–2.5; verify `pnpm test:unit` covers the changed modules (happy path + at least one error/narrowing miss)

## 3. Frontend — extractors, catch, transports

- [x] 3.1 Update `extractMessageKey` and client remote transports/adapters to named error types and no `typeof` ladders; strip Vue/composable `catch (err: unknown)`; verify no `no-unknown-parameters` / `no-runtime-typeof` under `app/`
- [x] 3.2 Fix client empty spreads, widening, and `safeJson` unknown returns (`app/utils/remote/client-fetch-transport.ts` and related); verify those anti-slop rules are clean under `app/`
- [x] 3.3 Unit-test `extractMessageKey` / client error mapping against `MessageParams` and a non-matching throw; verify `pnpm test:unit` includes those cases

## 4. Tests — chained casts, shape, mocks

- [x] 4.1 Rename `updateTaskSchema.shape` usage (`test/unit/task-schema.spec.ts`) so `no-shape-in-symbol-names` is clean; verify the schema still rejects an extra `number` field
- [x] 4.2 Reduce `as unknown as` in unit/nuxt tests (e2e-guards, overflow, use-user-settings, redmine-client, etc.); leftover single `as` get `// SAFETY:`; verify `no-chained-type-assertions` is gone or only justified disables remain
- [x] 4.3 Remove `vi.mock` where a real seam exists; for each remaining mock add `oxlint-disable-next-line anti-slop/no-module-mocking -- <reason>`; list remaining disables in the PR description for developer review; verify no un-disabled `no-module-mocking` hits
- [x] 4.4 Fix remaining test-only `Record<string, unknown>`, widening, and unknown returns (schema extra-key asserts, page-render meta, harness `safeJson`); verify `pnpm test:unit` and `pnpm test:nuxt` still pass

## 5. SAFETY comments and lint green

- [x] 5.1 Add `// SAFETY:` (or remove the `as`) for remaining `require-safety-comment-for-type-assertion` hits in `app/`, `server/`, `shared/`, and tests; verify that rule is clean
- [x] 5.2 Run `pnpm lint`, `pnpm format:check`, and `pnpm type-check`; verify lint is fully green (no anti-slop errors, no unused disables) and type-check passes
- [x] 5.3 Confirm `tools/oxlint/anti-slop/` is unchanged in the diff except ignore/docs if any; verify `git diff -- tools/oxlint/anti-slop` is empty
