## Why

The project pins `zod@^3.25`, a version line that is now in maintenance while all new
validation work (better error surface, first-class string formats, locales, JSON Schema)
happens in zod 4. Every boundary contract in `shared/types` and every server route depends
on zod, so the longer the bump waits the larger and riskier it becomes. `@nuxt/ui@4` already
accepts `zod@^4`, so nothing external blocks the move.

## What Changes

- Bump `zod` to `^4` and migrate all 12 schema modules in `shared/types`.
- Replace the removed `required_error` / `invalid_type_error` options (~40 occurrences) with
  the unified `error` option, keeping the existing translation keys as the message payload.
- Adopt the v4 top-level string formats: `z.uuid()`, `z.url()`, `z.iso.datetime()`, and
  sweep the deprecated `message:` option to `error:` so the codebase has one idiom.
- **BREAKING** `z.uuid()` in v4 enforces the RFC version/variant nibbles. Malformed
  identifiers (including the nil UUID) that previously reached a lookup and returned `404`
  now fail validation and return `422`. Affected e2e fixtures move to valid UUIDv7 values.
- **BREAKING** `mapZodError` drops `received` from the emitted `params`; the v4 issue shape
  no longer carries it and no locale catalog interpolates it.
- Update `CODING_STANDARDS.md` where it prescribes the v3 idiom.

## Capabilities

### New Capabilities
- _None._

### Modified Capabilities
- `type-safety`: REQ-158 — the `{ messageKey, params }` translator is specified against the
  v4 issue shape (`error` option instead of `required_error` / `invalid_type_error`, no
  `received` param).
- `api-endpoint-conventions`: REQ-172 — distinguishes a malformed identifier (`422`) from a
  well-formed but unknown or foreign identifier (`404`).
- `platform-toolchain`: new requirement pinning the zod 4 baseline with all quality gates
  green.

## Non-goals

- Adopting new zod 4 capabilities (`z.prettifyError`, the locale API, `z.toJSONSchema`) —
  noted as future work in `design.md` and deliberately out of scope here, so the migration
  stays a behavior-preserving port.
- Replacing the `messageKey` contract with zod's locale system.
- Introducing `drizzle-zod` or changing any boundary shape, DB schema, or i18n catalog.
- Runtime-validating response DTOs.

## Impact

- Dependencies: `zod` `^3.25.76` → `^4`.
- Code: `shared/types/*` (12 modules), `server/utils/zod-error.ts`, ~20 `server/api` handlers
  (only via `instanceof ZodError`, expected unchanged), client form schemas.
- Tests: `test/unit/zod-error.spec.ts`, e2e fixtures using the nil UUID in request bodies.
- Docs: `CODING_STANDARDS.md`, `AGENTS.md` if it names the zod version.
