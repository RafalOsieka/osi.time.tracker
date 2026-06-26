## 1. Schema & Migration (backend)

- [ ] 1.1 Create `server/db/schema/clients.ts` (`id` uuid PK `default uuidv7()`, `userId` uuid NOT NULL FK → `users.id`, `name` text NOT NULL, `createdAt`/`updatedAt`/`deletedAt` `withTimezone` timestamps; `deletedAt` nullable)
- [ ] 1.2 Add a partial unique index `(userId, name) WHERE deletedAt IS NULL` (fall back to app-layer uniqueness if impractical)
- [ ] 1.3 Export `clients` from the schema barrel if one exists
- [ ] 1.4 Run `pnpm db:generate` and commit the generated SQL migration; verify it applies with `pnpm db:migrate`

## 2. Validation Helper (backend)

- [ ] 2.1 Add a shared client-name validation helper (trim, non-empty, length bound) under `server/utils/`
- [ ] 2.2 Unit test the validation helper (empty/whitespace, over-length, valid)

## 3. Clients API (backend)

- [ ] 3.1 `server/api/clients/index.get.ts` — list `WHERE userId = user.id AND deletedAt IS NULL`, ordered by name, via `requireAuth`
- [ ] 3.2 `server/api/clients/index.post.ts` — create with validation + per-user duplicate check; map DB unique violation to `error.clientNameDuplicate`
- [ ] 3.3 `server/api/clients/[id].patch.ts` — update name scoped by `userId`; 404 for foreign/unknown id
- [ ] 3.4 `server/api/clients/[id].delete.ts` — soft delete (`deletedAt = now()`) scoped by `userId`; 404 for foreign/unknown id
- [ ] 3.5 Ensure all handlers return `{ messageKey, params }` on error
- [ ] 3.6 e2e test: list returns only own non-deleted clients, ordered by name (happy path + soft-delete exclusion)
- [ ] 3.7 e2e test: create happy path + empty-name and duplicate-name error scenarios
- [ ] 3.8 e2e test: patch happy path + foreign id → 404
- [ ] 3.9 e2e test: delete soft-deletes (row retained) + foreign id → 404
- [ ] 3.10 e2e test: cross-user isolation negative (user B cannot list/edit/delete user A's client) and unauthenticated → 401

## 4. Clients Page UI (frontend)

- [ ] 4.1 Rewrite `app/pages/clients.vue` with a `DataTable` (Name, Created, Actions) sorted by name; host the **+ New** button in the DataTable header template
- [ ] 4.2 Add a dedicated empty state ("No clients yet" + create CTA)
- [ ] 4.3 Implement a single `Dialog` form (create/edit modes) with `InputText` for `name`; inline field errors via `aria-invalid`/`aria-describedby` styled with `--p-form-field-invalid-color`
- [ ] 4.4 Add loose per-row edit/delete icon buttons; delete uses `ConfirmDialog` (`useConfirm`)
- [ ] 4.5 Wire mutations through `useCsrfFetch`/`$csrfFetch`; show success Toasts; translate server/network errors to Toasts via `extractMessageKey` + `t()`; refresh the list after each mutation
- [ ] 4.6 nuxt test: empty state renders; list rows render; dialog opens/saves; inline error displays
- [ ] 4.7 e2e test: full CRUD happy path through the UI (create → edit → delete)

## 5. i18n (frontend)

- [ ] 5.1 Add new keys (page title, column headers, button/dialog labels, empty state, validation errors incl. `error.clientNameDuplicate`) to `i18n/locales/en.json` and `pl.json` in parity
- [ ] 5.2 Confirm `test/unit/i18n-catalog-parity.spec.ts` passes for the new keys

## 6. Verification

- [ ] 6.1 Run `pnpm lint` and `pnpm format:check`
- [ ] 6.2 Run `pnpm test:unit`, `pnpm test:nuxt`, and `pnpm test:e2e`; ensure all pass
