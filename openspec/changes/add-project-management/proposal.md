## Why

User Story #2 (WBS 3.2) builds the second level of the `Client → Project → Task` hierarchy: users need to group related bodies of work into Projects under a Client they own. The completed `client-management` slice established the CRUD template; this slice reuses it and adds the first parent/child relationship, which Story #3 (Tasks) will copy next.

## What Changes

- Add a new `projects` domain table (Drizzle schema + committed SQL migration), soft-delete from the start (`deletedAt`), with a `clientId` FK → `clients.id` and names unique per user per client among non-deleted rows.
- Add authenticated, user-scoped Nitro API under `server/api/projects/`: list (with optional `clientId` filter), create, update, soft-delete — each guarded by `requireAuth` + CSRF and using the `{ messageKey, params }` error contract.
- Validate `clientId` ownership on create/update: the referenced client must belong to the user and be non-deleted; a foreign/unknown `clientId` resolves to HTTP 404 (never confirms existence).
- Replace the placeholder `app/pages/projects.vue` with a working CRUD surface: PrimeVue `DataTable`, `Dialog`-based create/edit form with a Client `Select` (dropdown), `ConfirmDialog` delete, `Toast` feedback, a dedicated empty state, and a Client filter above the table.
- Surface field errors (empty/duplicate name, missing client) inline; surface server/network failures via `Toast`.
- Add new i18n strings to `en.json` and `pl.json` in parity.

## Capabilities

### New Capabilities
- `project-management`: Authenticated, user-scoped CRUD for Projects (name + required `clientId`), with per-user-per-client unique names, soft delete, `clientId` ownership validation, an optional Client list filter, strict cross-user isolation, and a PrimeVue Dialog-based UI.

### Modified Capabilities
<!-- None: the client-management, shell, and data-persistence specs are unchanged; this slice only adds a new capability. -->

## Impact

- **Schema/DB**: new `server/db/schema/projects.ts` + generated migration under `server/db/migrations`; exported from the schema barrel.
- **API**: new handlers `server/api/projects/index.get.ts`, `index.post.ts`, `[id].patch.ts`, `[id].delete.ts`.
- **Boundary types**: new `shared/types/project.ts` (single zod schema + serialized DTO).
- **UI**: rewritten `app/pages/projects.vue`; reuses `utils/extractMessageKey`.
- **i18n**: `i18n/locales/en.json`, `pl.json`.
- **Tests**: `test/unit`, `test/nuxt`, `test/e2e` (including cross-user isolation and foreign-`clientId` → 404 negatives).

## Non-goals

- A **Client detail view** — explicitly not built and not deferred; Projects surface only on the Projects page with a Client filter.
- Tasks (User Story #3), remote system configuration (User Story #8), and a "show archived" / restore UI.
