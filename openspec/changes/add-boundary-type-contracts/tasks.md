## 1. Dependency & Lint Gate

- [ ] 1.1 Add `zod` to `package.json` dependencies and run `pnpm install`
- [ ] 1.2 Add `@typescript-eslint/no-explicit-any: 'error'` rule in `eslint.config.mjs` (append block), documenting the `eslint-disable-next-line` + reason escape hatch
- [ ] 1.3 Run `pnpm lint` to confirm the new rule passes (or fix/annotate any existing `any`)

## 2. Shared Boundary Contract (Backend + Frontend shared)

- [ ] 2.1 Create `shared/types/client.ts`: export `createClientBodySchema` (zod: `name` trimmed, required, max length) and `CreateClientBody = z.infer<typeof createClientBodySchema>`
- [ ] 2.2 In the same module export `ClientDto` as a plain type (`{ id: string; name: string; createdAt: string }`) — timestamp typed as serialized `string`
- [ ] 2.3 Move `CLIENT_NAME_MAX_LENGTH` into `shared/types/client.ts` (or import it there) so schema and DTO share the constant
- [ ] 2.4 Add unit test `test/unit/client-schema.spec.ts`: valid body trims + strips unknown keys; missing/over-length `name` fails parse

## 3. ZodError → messageKey Translator (Backend)

- [ ] 3.1 Create `server/utils/zod-error.ts`: generic mapper from a `ZodError` issue (`path` + `code`) to `{ messageKey, params }` (e.g. `name`+`invalid_type`/`too_small` → `error.clientNameRequired`; `name`+`too_big` → `error.clientNameTooLong` with `params.max`), with a safe fallback key for unmapped issues
- [ ] 3.2 Add unit test `test/unit/zod-error.spec.ts`: each known `(path, code)` maps to the expected key/params; unmapped issue yields the fallback key

## 4. Retrofit clients Endpoint (Backend — reference slice)

- [ ] 4.1 Update `server/api/clients/index.post.ts`: parse `readBody` through `createClientBodySchema`, map `ZodError` to a `422` `{ messageKey, params }` via the new translator, and remove manual `validateClientName`/`.trim()`
- [ ] 4.2 Annotate the handler return type as `ClientDto` (map the Drizzle row, ensuring `createdAt` is serialized to `string`)
- [ ] 4.3 Remove now-unused `validateClientName`/`ValidationResult` from `server/utils/validation.ts` (or repoint remaining callers); update/remove its unit tests accordingly
- [ ] 4.4 Add/update integration test `test/e2e/clients.spec.ts`: happy path returns a `ClientDto`; missing name → `422 error.clientNameRequired`; over-length name → `422 error.clientNameTooLong`; duplicate still → `error.clientNameDuplicate`

## 5. Retrofit clients Page (Frontend — reference slice)

- [ ] 5.1 Update `app/pages/clients.vue` to import `ClientDto` and `CreateClientBody` from `shared/types/client`, replacing all inline `{ id, name, createdAt }` declarations and the `$csrfFetch` generics
- [ ] 5.2 (Optional) reuse `createClientBodySchema.safeParse` for client-side form pre-validation to avoid drift
- [ ] 5.3 Add/update E2E test `test/e2e/clients.spec.ts` (or Nuxt test) covering the create-client form flow with the typed contract

## 6. Documentation

- [ ] 6.1 Add a "Boundary types & validation" note to `AGENTS.md` Code Style: shared `shared/types` contracts, zod for request bodies, plain inferred response DTOs, ZodError→messageKey, and `no-explicit-any: error` with the documented exception
- [ ] 6.2 Run `pnpm lint`, `pnpm format:check`, and the relevant test projects to confirm the suite is green
