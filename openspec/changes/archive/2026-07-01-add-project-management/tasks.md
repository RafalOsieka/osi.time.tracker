## 1. Schema & Migration (backend)

- [x] 1.1 Create `server/db/schema/projects.ts` (`id` uuid PK `default uuidv7()`, `userId` uuid NOT NULL FK → `users.id`, `clientId` uuid NOT NULL FK → `clients.id`, `name` text NOT NULL, `createdAt`/`updatedAt`/`deletedAt` `withTimezone` timestamps; `deletedAt` nullable)
- [x] 1.2 Add a partial unique index `(userId, clientId, name) WHERE deletedAt IS NULL` plus an index on `(userId, clientId)` (fall back to app-layer uniqueness if impractical)
- [x] 1.3 Export `projects` from the schema barrel `server/db/schema/index.ts`
- [x] 1.4 Run `pnpm db:generate` and commit the generated SQL migration; verify it applies with `pnpm db:migrate`

## 2. Shared Types & Validation (backend)

- [x] 2.1 Create `shared/types/project.ts` with a single `zod` schema (`name` trimmed/non-empty/length-bounded, `clientId` required uuid), inferred `CreateProjectDto`/`UpdateProjectDto`, and a serialized `ProjectDto` (`id`, `name`, `clientId`, `clientName`, `createdAt: string`)
- [x] 2.2 Unit test the schema (empty/whitespace name, over-length name, missing/invalid `clientId`, valid input)

## 3. Projects API (backend)

- [x] 3.1 `server/api/projects/index.get.ts` — list `WHERE userId = user.id AND deletedAt IS NULL`, ordered by name, with an optional `clientId` query filter (always scoped by `userId`), via `requireAuth`; `LEFT JOIN clients` (not filtered on `deletedAt`) to include `clientName`, so soft-deleted clients still resolve a name
- [x] 3.2 `server/api/projects/index.post.ts` — validate body, verify `clientId` references a non-deleted client owned by the user (else 404), per-user-per-client duplicate check; map DB unique violation (`23505`) to `error.projectNameDuplicate`; return the resolved `clientName`
- [x] 3.3 `server/api/projects/[id].patch.ts` — update name/`clientId` scoped by `userId`; validate target `clientId` ownership only when it differs from the project's current client (else 404); skip client soft-delete/ownership re-validation when `clientId` is unchanged so a rename works even if the client was soft-deleted; 404 for foreign/unknown project id; return the resolved `clientName` (looked up without filtering the client's `deletedAt`)
- [x] 3.4 `server/api/projects/[id].delete.ts` — soft delete (`deletedAt = now()`) scoped by `userId`; 404 for foreign/unknown id
- [x] 3.5 Ensure all handlers return `{ messageKey, params }` on error via `mapZodError` and the shared error contract
- [x] 3.6 e2e test: list returns only own non-deleted projects ordered by name (happy path + soft-delete exclusion) and honors the `clientId` filter (incl. foreign/unknown `clientId` → empty list)
- [x] 3.7 e2e test: create happy path + empty-name, missing-`clientId`, and duplicate-name-per-client scenarios; same name under a different client allowed
- [x] 3.8 e2e test: create/patch with a foreign or unknown `clientId` → 404
- [x] 3.9 e2e test: patch happy path (name + client change) + foreign project id → 404
- [x] 3.10 e2e test: rename a project whose client is soft-deleted succeeds when `clientId` is unchanged (no re-validation of the client's soft-delete status), and the response carries the soft-deleted client's `clientName`
- [x] 3.11 e2e test: list still returns `clientName` for a project whose client has been soft-deleted
- [x] 3.12 e2e test: delete soft-deletes (row retained) + foreign id → 404
- [x] 3.13 e2e test: cross-user isolation negative (user B cannot list/edit/delete user A's project) and unauthenticated → 401

## 4. Projects Page UI (frontend)

- [x] 4.1 Rewrite `app/pages/projects.vue` with a `DataTable` (Name, Client, Created, Actions) sorted by name; host the **+ New** button in the DataTable header template; the Client column renders `clientName` directly from the DTO (not derived from the active-client list)
- [x] 4.2 Add a Client filter `Select` above the table (option to show all clients) wired to the `clientId` list query
- [x] 4.3 Add a dedicated empty state ("No projects yet" + create CTA), respecting the active Client filter
- [x] 4.4 Implement a single `Dialog` form (create/edit modes) with `InputText` for `name` and a PrimeVue `Select` for the owned Client; inline field errors via `aria-invalid`/`aria-describedby` styled with `--p-form-field-invalid-color`; when editing a project whose client is soft-deleted (missing from the active list), seed the Client select with the project's `clientId`/`clientName` so it stays visible and pre-selected
- [x] 4.5 Add per-row edit/delete icon buttons; delete uses `ConfirmDialog` (`useConfirm`)
- [x] 4.6 Wire mutations through `useCsrfFetch`/`$csrfFetch`; show success Toasts; translate server/network errors to Toasts via `extractMessageKey` + `t()`; refresh the list after each mutation
- [x] 4.7 nuxt test: empty state renders; list rows render; Client filter narrows rows; dialog opens/saves; inline error displays; Client select is labelled; the Client column shows `clientName` for a soft-deleted client; the edit dialog seeds the soft-deleted client into the Client select
- [x] 4.8 e2e test: full CRUD happy path through the UI (create with client → edit → delete) and filtering by client

## 5. i18n (frontend)

- [x] 5.1 Add new keys (page title, column headers incl. Client, filter/select labels, button/dialog labels, empty state, validation errors incl. `error.projectNameRequired`, `error.projectNameTooLong`, `error.projectClientRequired`, `error.projectNameDuplicate`) to `i18n/locales/en.json` and `pl.json` in parity
- [x] 5.2 Confirm `test/unit/i18n-catalog-parity.spec.ts` passes for the new keys

## 6. Verification

- [x] 6.1 Run `pnpm lint` and `pnpm format:check`
- [x] 6.2 Run `pnpm test:unit`, `pnpm test:nuxt`, and `pnpm test:e2e`; ensure all pass
