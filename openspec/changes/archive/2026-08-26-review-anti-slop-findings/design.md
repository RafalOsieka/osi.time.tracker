## Context

See `proposal.md`. ~411 `anti-slop/*` diagnostics block `pnpm lint`. Specs: `type-safety` (REQ-284–286), `lint-and-format-toolchain` (REQ-282), `api-endpoint-conventions` (REQ-171), `vue-component-typing` (REQ-238). Do not edit `tools/oxlint/anti-slop/`.

```
catch (err)                    →  implicit unknown (no annotation)
err: unknown on helpers        →  named error type + isX / instanceof
typeof ladders                 →  instanceof / schema / isX
Record<string, unknown> params →  MessageParams (string|number|boolean)
vi.mock                        →  remove, or disable -- reason (developer review)
```

## Goals / Non-Goals

**Goals:** Green `pnpm lint` with every generic anti-slop rule still `error`. Align coding standards. Tighten `params` typing without changing JSON keys.

**Non-Goals:** Plugin edits, type-aware Oxlint, TS 7, blanket `test/` allowlists, product/schema/i18n copy.

## Decisions

### D1 — Catch: drop `: unknown`, keep implicit unknown

`catch (err)` under `strict` is already `unknown`. Explicit `: unknown` trips `no-unknown-parameters` without adding safety.

- **Alternative:** Keep `: unknown` and disable the rule on catch. Rejected: noise; TS already does this.

### D2 — `typeof` out; named guards in

Shared JSON/error helpers (`extractMessageKey`, adapter mappers) get `instanceof` / `isX`. `allowInTypeGuards` only if a predicate still needs `typeof` internally.

- **Alternative:** `allowInTypeGuards: true` globally and leave extractors as `typeof` soup. Rejected: user wants concrete types.

### D3 — `MessageParams` replaces `Record<string, unknown>`

```ts
export type MessageParamValue = string | number | boolean;
export type MessageParams = Partial<Record<string, MessageParamValue>>;
```

`ApiMessage.params`, `mapZodError` output, and client `t(key, params)` for API errors use it. Existing keys `min` / `max` / `expected` fit.

- **Alternative:** A closed union of known keys only. Rejected: zod custom `params` can add keys.
- **Alternative:** Keep `unknown` values. Rejected: user wants the contract changed.

### D4 — Mechanical anti-slop fixes in application code

Empty spreads → `if` assignment. Widening → `satisfies` or named aliases (including return types). `safeJson` → parse to a named type or generic with a schema. Lazy DB access is `getDb()` (no `Proxy`). Rename test `shape` (e.g. schema `keyof`). Remote transports take a zod `schema` argument and `safeParse` the payload.

- **Alternative:** Disable those rules. Rejected: user asked to fix.

### D5 — Mocks: unmock first, disable remainder for review

No `test/**` override. Each leftover `vi.mock` / `jest.mock` gets `oxlint-disable-next-line anti-slop/no-module-mocking -- <reason>`. Developer validates the list.

- **Alternative:** Off in `test/`. Rejected: user will validate each remaining mock.

### D6 — SAFETY comments stay

`require-safety-comment-for-type-assertion` remains `error`. Remaining single `as` get `// SAFETY:`. Chained `as unknown as` reduced in tests (REQ-238).

## Risks / Trade-offs

- [Catch without annotation looks “untyped”] → Document in `CODING_STANDARDS.md` that `strict` implies `unknown`.
- [Named error types drift from ofetch/Nitro shapes] → Central `isApiError` / `RemoteAdapterError` only.
- [MessageParams rejects nested objects] → API params today are primitives; if a nested param appears, add a named field, not `unknown`.
- [Unmocking Nuxt `$fetch` / i18n is expensive] → Disable with reason rather than a fake DI rewrite in this change.
- [Lazy DB without connecting at import] → `getDb()` creates the client on first call; no Proxy.

## Migration Plan

1. Types + standards (`MessageParams`, catch, typeof policy).
2. Shared/server extractors and `mapZodError`.
3. App call sites and Vue `catch`.
4. Spreads, widening, returns, Reflect, shape rename, chained casts.
5. Mock pass: remove or disable; `pnpm lint` green.
6. Rollback: revert; no DB migration.

## Open Questions

None blocking. Remaining mock disables are the review surface after apply, not a spec fork.
