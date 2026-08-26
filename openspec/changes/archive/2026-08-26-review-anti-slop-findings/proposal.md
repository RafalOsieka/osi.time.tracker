## Why

Oxlint anti-slop reports 411 errors. Many match real slop (chained `as`, empty spreads, widening). Others clash with the old “prefer `unknown` then `typeof`” standard. After review, that standard should move: application code uses concrete types; `catch` stays implicitly `unknown`. Until this lands, `pnpm lint` cannot go green.

## What Changes

- **Standards:** Prefer named types, schema parse, `instanceof`, and `isX` guards over `unknown` + `typeof`. Omit `: unknown` on `catch` (TS `strict` already types it `unknown`). Keep `// SAFETY:` on remaining `as`.
- **Contract:** Replace `params?: Record<string, unknown>` with a named `MessageParams` whose values are `string | number | boolean` (wire keys `min` / `max` / `expected` unchanged). **Not a JSON-shape break.**
- **Fix:** `no-conditional-empty-object-spread`, `no-known-value-widening`, `no-unknown-returns`, `no-reflect-get` (replace the lazy `db` Proxy with `getDb()`), `no-shape-in-symbol-names`; reduce `no-chained-type-assertions` as far as typed fakes allow.
- **Remote adapters:** Every transport `execute` SHALL parse the upstream JSON with a zod schema (`Transport.execute(request, schema)`). Provider payloads are untrusted; `schema.safeParse` is the evidence for `T`. This is required from the contract, not optional.
- **Mocks:** Do not `vi.mock` when a real seam exists. Remaining mocks get a justified `oxlint-disable-next-line anti-slop/no-module-mocking` for developer review. Do **not** edit `tools/oxlint/anti-slop/`.
- All generic anti-slop rules stay `error`. `pnpm lint` must pass.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `type-safety`: drop `unknown`+`typeof` as the default boundary pattern; catch unannotated; `MessageParams` instead of `Record<string, unknown>`.
- `lint-and-format-toolchain`: anti-slop stays fully on; leftover mocks are documented disables, not a `test/` allowlist.
- `api-endpoint-conventions`: `{ messageKey, params }` params type is `MessageParams`; query strings use `getZodQuery` like bodies use `readZodBody`.
- `vue-component-typing`: chained `as unknown as` reduced in tests as well as `app/`.
- `remote-adapter-contract`: L4 transports parse upstream JSON with a required zod schema.

## Impact

- **Code:** `app/`, `server/`, `shared/`, tests; `CODING_STANDARDS.md` / `AGENTS.md`; `mapZodError` / i18n `t()` typing.
- **API:** same JSON keys; tighter TypeScript on `params`.
- **Tests:** unit coverage for `MessageParams` and extractors; mock list reviewed in-place.

## Non-goals

- Editing the vendored anti-slop plugin.
- Type-aware Oxlint / TypeScript 7.
- Blanket `test/` disable of anti-slop.
- Changing remote HTTP fake/`page.route` e2e policy (only `vi.mock` usage).
- Product behavior, schema, or i18n catalog copy.
