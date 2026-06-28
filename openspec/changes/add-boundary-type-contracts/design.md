## Context

The codebase has two boundary features so far: `auth` (with a named, shared `User` shape and a named `ApiMessage` contract) and `clients` (with no named contract — the response shape is inlined four times in `pages/clients.vue` and the request body arrives as untyped `readBody` `any`). The good patterns (`shared/types/auth.d.ts`, `server/types/api-message.ts`) already exist but entity DTOs have no equivalent. This change establishes the convention now, while the surface is tiny, and retrofits `clients` as the worked example. Decisions already made by the user: Option B (hand-written, DB-decoupled contracts), `zod` only, plain inferred response DTOs, generic ZodError→messageKey mapping, and `no-explicit-any: error`.

## Goals / Non-Goals

**Goals:**
- One named, shared source of truth per boundary shape, imported by both sides.
- Request bodies validated + normalized + typed from a single `zod` schema.
- Preserve the locale-agnostic `{ messageKey, params }` server contract.
- Hard `no-explicit-any` lint gate with a visible escape hatch.
- A copy-paste reference slice (`clients`).

**Non-Goals:**
- `drizzle-zod` / DB-driven contracts.
- Runtime validation of responses.
- `@typescript-eslint/no-unsafe-*` rules and type-aware linting.
- Migrating features other than `clients` (none exist yet).

## Decisions

- **Where shapes live: `shared/types/<entity>.ts` (Option B).** Nuxt auto-includes `shared/` on both sides, mirrors the existing `ApiMessage` style, and decouples the public contract from DB columns so internal fields (`userId`, `deletedAt`) never leak. _Alternative — derive from Drizzle `$inferSelect`:_ free and DB-synced, but leaks columns and carries the `Date`-vs-`string` footgun; rejected per user's Option B choice.
- **Request validation: plain `zod`, parsed in the handler.** `schema.parse(body)` validates, trims, strips unknown keys (kills mass-assignment), and yields the `z.infer` type in one step, replacing `validateClientName` + manual `.trim()`. _Alternative — `safeParse` branching:_ equivalent; `.parse` + single try/catch is terser given the central error mapper. _Alternative — `drizzle-zod`:_ explicitly out of scope.
- **Responses: plain inferred/explicit types, no runtime parse.** The server is trusted, so paying parse cost on egress adds ceremony without value. `createdAt` is typed `string` to match serialized JSON. _Alternative — Zod-parse responses too:_ rejected (perf + ceremony, no real safety gain).
- **ZodError → messageKey: generic translator (style 2).** A shared util maps `(path, code)` → message key (e.g. `name`+`too_small`/`invalid_type` → `error.clientNameRequired`; `name`+`too_big` → `error.clientNameTooLong` with `params.max`). Keeps schemas pure and centralizes the i18n bridge. _Alternative — embed keys in schema via custom messages/`refine`:_ co-locates keys with rules but scatters the contract; rejected for a single shared mapper.
- **`any` gate: `@typescript-eslint/no-explicit-any: 'error'` in `eslint.config.mjs`.** Cheap, immediate, enforced by the existing `pnpm lint` PR gate; exceptions require an explicit `eslint-disable-next-line` + reason. _Alternative — `warn`:_ rejected (easily ignored, defeats the purpose).

## Risks / Trade-offs

- **Implicit `any` from `readBody`/`$fetch` still slips past `no-explicit-any`** → Mitigated structurally: routing bodies through `schema.parse` removes the `readBody` `any` at the source; `no-unsafe-*` deferred as a later belt-and-suspenders.
- **ZodError→messageKey mapper drifts from schema rules** → Mitigated with unit tests asserting each `(path, code)` maps to the expected key, and a default fallback key for unmapped issues.
- **`Date` vs `string` serialization confusion** → Mitigated by typing DTO timestamps as `string` and documenting the rule in the spec.
- **Convention decays without examples** → Mitigated by shipping the `clients` retrofit as the canonical template future entities copy.

## Open Questions

- None.
