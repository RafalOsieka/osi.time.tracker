## Context

`zod@^3.25.76` is a direct dependency used at every client/server boundary: 12 schema
modules in `shared/types`, ~20 Nitro handlers that catch `ZodError`, and several client-side
`UForm` schemas. Every validation failure funnels through one chokepoint,
`server/utils/zod-error.ts`, which converts the first issue into the locale-agnostic
`{ messageKey, params }` contract by reading `issue.message` (a translation key) plus
`minimum`/`maximum`/`expected`/`received`/`params`.

Dependency-wise nothing blocks the bump: `@nuxt/ui@4` peers on `zod ^3.24.0 || ^4.0.0`, and
`nuxt-auth-utils` / `nuxt-security` declare no zod peer.

```
   shared/types/*.ts  ──▶  server/api/**.ts  ──▶  server/utils/zod-error.ts
   (12 schema modules)     (instanceof ZodError)   (issue ─▶ { messageKey, params })
          │                                                    │
          └──▶ app/**.vue (UForm schemas)                      └──▶ 422 + t(messageKey)
```

The migration is ~90% mechanical (option renames) and ~10% behavioral (the error-mapper
contract and stricter `z.uuid()`).

## Goals / Non-Goals

**Goals:**

- Land zod 4 in a single reviewable change with every quality gate green.
- Leave exactly one zod idiom in the codebase — no mixed v3/v4 style, no deprecated options.
- Keep the `{ messageKey, params }` wire contract stable apart from the deliberate removal of
  `received`.
- Tighten identifier validation deliberately rather than by accident.

**Non-Goals:**

- Adopting new zod 4 features (`z.prettifyError`, locales, `z.toJSONSchema`).
- Changing any boundary shape, DB schema, or i18n catalog.
- Introducing `drizzle-zod` or runtime-validating response DTOs.

## Decisions

### D1 — Codemod first, hand-fix the two behavioral seams

Run the official `zod-v3-to-v4` codemod over `shared/`, `server/`, `app/`, and `test/`, then
hand-review. The mechanical surface (~40 `required_error` / `invalid_type_error`, ~60
`message:` options, the `.uuid()` / `.url()` / `.datetime()` method forms) is exactly what the
codemod handles; the mapper and the UUID fixtures are exactly what it cannot.

*Alternatives considered:*

- **Fully manual rewrite** — ~35 files of tedium with a high typo rate for zero benefit.
- **Incremental via the `zod/v4` subpath of `zod@3.25`** — allows file-by-file migration, but
  two zod runtimes coexist in one process, so `instanceof ZodError` in the handlers becomes
  version-dependent, and the mixed state would live across several PRs. Rejected: this
  codebase is small enough and centralized enough that the incrementalism buys nothing.

### D2 — `z.uuid()` (RFC-strict), not `z.guid()`

Real identifiers come from PostgreSQL `uuidv7()`, so strictness costs nothing in production
and rejects garbage earlier. The visible consequence is that the nil UUID — used as the
"definitely not found" fixture in 10+ e2e assertions — stops being a valid body value, so
those routes answer `422` instead of `404`.

*Alternative considered:* `z.guid()` preserves v3 permissiveness and keeps every fixture
green, but it enshrines a lower validation standard purely to protect test data. Rejected.

**Fixture policy:** "unknown id" fixtures move to a valid, deterministic UUIDv7-shaped
constant (the pattern `sync-export.spec.ts` already uses:
`01900000-0000-7000-8000-…`), exported once from the e2e support module so the intent is
named rather than copy-pasted. Tests that specifically assert *malformed* input keep an
obviously-invalid value and assert `422`.

### D3 — Drop `received` from `params`

The v4 issue shape replaces the `received` string with `input` (the actual value). Neither
`i18n/en.json` nor `pl.json` interpolates `{received}`, so nothing consumes it. Emitting
`issue.input` instead would leak user-supplied data into an error payload; synthesizing a
`typeof` string would preserve a field nobody reads.

*Alternative considered:* re-derive `received` from `typeof issue.input` to keep the contract
byte-identical. Rejected — it perpetuates dead weight in a contract we control end to end.

### D4 — Sweep the deprecations in the same change

`message:` → `error:` and the string-format method forms still work in v4, so this is
optional. Doing it now keeps the diff single-idiom and avoids a second pass over the same 12
files later. The cost is a larger diff, mitigated by the fact that the codemod produces it
mechanically and the change is reviewed as one logical unit.

### D5 — Verification order

`pnpm type-check` is the primary migration oracle: the removed error options and the changed
`.default()` input type surface as type errors, not runtime failures. Gate order: type-check →
unit → nuxt → e2e, since e2e is the slowest and depends on the fixture policy from D2.

## Risks / Trade-offs

- **[e2e red from the nil UUID]** → Enumerate every nil-UUID occurrence before touching the
  schemas and classify each as "unknown id" (replace with the valid v7 constant, still expects
  `404`) or "malformed id" (keep, now expects `422`). Path parameters validated by hand are
  unaffected.
- **[Codemod over-eagerness]** → It may rewrite `error` values into function form or touch
  test fixtures. Review the codemod diff hunk-by-hunk before committing; commit the codemod
  output separately from hand edits so the two are distinguishable in review.
- **[`executionMode: remoteExecutionModeSchema.default('client')`]** → v4 changed the input
  type of `.default()`; `pnpm type-check` catches this at the `CreateRemoteSystemConfigDto`
  call sites. Verify the remote-config form still treats the field as optional on input.
- **[Silent message-key regressions]** → If a codemod rewrite drops a message key, the mapper
  falls back to `errors.unexpected` and the user sees a generic error instead of a red test.
  Mitigation: assert on the exact `messageKey` in the e2e validation assertions that already
  exist, and grep that the count of `error.` keys in `shared/types` is unchanged before/after.
- **[Nuxt UI form integration]** → `@nuxt/ui@4` resolves the schema type at runtime; a v4
  schema is supported but exercised by the `nuxt` test project rather than the type-checker.
  Run `pnpm test:nuxt` explicitly rather than relying on type-check.

## Migration Plan

1. Bump `zod` to `^4`, reinstall, confirm no second zod major is reachable from app code.
2. Run the codemod; commit its output verbatim.
3. Hand-fix `mapZodError`, its unit spec, and the e2e id fixtures.
4. Sweep residual deprecations; run the full gate set.
5. Update `CODING_STANDARDS.md` (and `AGENTS.md` if it pins a zod version).

**Rollback:** revert the dependency bump and the lockfile; the change touches no database
schema and no persisted data, so rollback is a pure code revert.

## Future Work (out of scope here)

The bump unlocks three zod 4 capabilities that overlap with machinery this project currently
hand-rolls. They are recorded here rather than acted on, so this change stays a
behavior-preserving port:

- **`z.prettifyError`** — a human-readable, multi-issue rendering for developer-facing
  diagnostics (server logs, dev-mode output), where the first-issue `messageKey` is a poor fit.
- **Locale API** — could serve `en`/`pl` messages for a subset of built-in issues. Likely
  outcome: keep the `{ messageKey, params }` contract authoritative for end-user errors (the
  client translating a key is a product decision, not a zod workaround) and adopt locales only
  for developer-facing output.
- **`z.toJSONSchema`** — could generate the OpenProject/Redmine payload schema documents
  instead of maintaining them by hand.

Each is independently adoptable; a follow-up change can evaluate them once the v4 surface has
been lived with.

## Open Questions

- ~~Does `CODING_STANDARDS.md` prescribe the v3 error options?~~ **Resolved:** it does not —
  §5 and §6 only require "a single zod schema" and "validation messages as translation keys".
  The docs edit is therefore additive: name the unified `error` option as the idiom and note
  that identifier fields use `z.uuid()`.
- Should the shared "valid but unknown" UUID constant live in `test/e2e/support` only, or is
  it also useful to the `nuxt` project fixtures?
