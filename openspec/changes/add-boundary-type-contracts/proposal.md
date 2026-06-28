## Why

API boundary shapes are currently re-described ad hoc on both sides of the wire (the `Client` response shape is hand-written four times in `pages/clients.vue` and named zero times on the server, while request bodies arrive as untyped `readBody` `any`). Without a single source of truth, drift between client, server, and DB is inevitable, and `any` silently erodes type safety. Setting the convention now — while only `auth` and `clients` exist — is far cheaper than retrofitting later.

## What Changes

- Introduce **hand-written boundary contracts** in `shared/types/<entity>.ts` as the single source of truth both sides import (Option B: decoupled from DB columns).
- Adopt **`zod`** (only, no `drizzle-zod`) for **request bodies**: one schema validates, normalizes (trim), and strips unknown keys at runtime; the request type is derived via `z.infer`.
- **Response DTOs are plain inferred/explicit types** (no runtime parsing — the server is trusted), with the `Date → string` JSON serialization made explicit.
- Add a shared **ZodError → `{ messageKey, params }` translator** (generic: maps issue `path`+`code` to a message key) so the locale-agnostic server contract is preserved.
- Enable **`@typescript-eslint/no-explicit-any: 'error'`** with a documented `eslint-disable` escape hatch as the hard gate.
- **Retrofit the `clients` slice** end-to-end as the reference implementation for future entities.

## Capabilities

### New Capabilities
- `type-safety`: cross-cutting governance defining where boundary shapes live, the `zod` request-validation contract, plain-inferred response DTOs, ZodError→`messageKey` mapping, and the `no-explicit-any` enforcement gate.

### Modified Capabilities
<!-- No spec-level behavioral requirements change; client-management behavior is unchanged (internal typing/validation refactor only). -->

## Impact

- **Dependencies**: adds `zod`.
- **Code**: new `shared/types/client.ts`; `server/api/clients/index.post.ts` (and any future handlers) route bodies through `schema.parse`; `pages/clients.vue` imports `ClientDto`; `server/utils/validation.ts` absorbed into schema + error translator.
- **Tooling**: `eslint.config.mjs` gains the `no-explicit-any` rule (enforced by the existing `pnpm lint` PR gate).
- **Non-goals**: `no-unsafe-*` rules (deferred), `drizzle-zod`, runtime parsing of responses, and migrating non-`clients` features (none exist yet).
