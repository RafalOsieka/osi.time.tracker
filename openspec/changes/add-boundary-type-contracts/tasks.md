## 1. Dependency & Lint Gate

- [x] 1.1 Add `zod` to `package.json` dependencies and run `pnpm install`
- [x] 1.2 Add `@typescript-eslint/no-explicit-any: 'error'` rule in `eslint.config.mjs` (append block), documenting the `eslint-disable-next-line` + reason escape hatch
- [x] 1.3 Run `pnpm lint` to confirm the new rule passes (or fix/annotate any existing `any`)

## 2. Shared Boundary Contract (Backend + Frontend shared)

- [x] 2.1 Create `shared/types/client.ts`: export `createClientBodySchema` (zod: `name` trimmed, required, max length) and `CreateClientBody = z.infer<typeof createClientBodySchema>`
- [x] 2.2 In the same module export `ClientDto` as a plain type (`{ id: string; name: string; createdAt: string }`) — timestamp typed as serialized `string`
- [x] 2.3 Move `CLIENT_NAME_MAX_LENGTH` into `shared/types/client.ts` (or import it there) so schema and DTO share the constant
- [x] 2.4 Add unit test `test/unit/client-schema.spec.ts`: valid body trims + strips unknown keys; missing/over-length `name` fails parse

## 3. ZodError → messageKey Translator (Backend)

- [x] 3.1 Create `server/utils/zod-error.ts`: `mapZodError` reads the first `ZodError` issue, detects a dot-notation message key authored in the schema's Zod message (e.g. `error.clientNameRequired`, `error.clientNameTooLong`), and returns `{ messageKey, params }` with extracted params (`min`/`max`/`expected`/`received`/custom `params`), falling back to `errors.unexpected` for unrecognized messages
- [x] 3.2 Add unit test `test/unit/zod-error.spec.ts`: each authored schema rule (missing/empty/over-length `name`) maps to the expected key/params; an unmapped issue yields the `errors.unexpected` fallback key

## 4. Retrofit clients Endpoint (Backend — reference slice)

- [x] 4.1 Update `server/api/clients/index.post.ts` and `server/api/clients/[id].patch.ts`: parse `readBody` through `createClientBodySchema`, map `ZodError` to a `422` `{ messageKey, params }` via the new translator, and remove manual `validateClientName`/`.trim()`
- [x] 4.2 Annotate the handler return type as `ClientDto` (map the Drizzle row, ensuring `createdAt` is serialized to `string`)
- [x] 4.3 Remove now-unused `validateClientName`/`ValidationResult` from `server/utils/validation.ts` (or repoint remaining callers); update/remove its unit tests accordingly
- [x] 4.4 Add/update integration test `test/e2e/clients.spec.ts`: happy path returns a `ClientDto`; missing name → `422 error.clientNameRequired`; over-length name → `422 error.clientNameTooLong`; duplicate still → `error.clientNameDuplicate`

## 5. Retrofit clients Page (Frontend — reference slice)

- [x] 5.1 Update `app/pages/clients.vue` to import `ClientDto` and `CLIENT_NAME_MAX_LENGTH` from `#shared/types/client`, replacing all inline `{ id, name, createdAt }` declarations and the `$csrfFetch` generics
- [ ] 5.2 (Optional, not implemented) reuse `createClientBodySchema.safeParse` for client-side form pre-validation to avoid drift — the form currently relies on server-side validation plus `:maxlength="CLIENT_NAME_MAX_LENGTH"` HTML enforcement
- [x] 5.3 Add/update E2E test `test/e2e/clients.spec.ts` (or Nuxt test) covering the create-client form flow with the typed contract

## 6. Documentation

- [x] 6.1 Add a "Boundary types & validation" note to `AGENTS.md` Code Style: shared `shared/types` contracts, zod for request bodies, plain inferred response DTOs, ZodError→messageKey, and `no-explicit-any: error` with the documented exception
- [x] 6.2 Run `pnpm lint`, `pnpm format:check`, and the relevant test projects to confirm the suite is green
