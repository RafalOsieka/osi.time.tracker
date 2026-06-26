## Why

User Story #1 (WBS 3.1) needs its first real feature slice. The authenticated app shell already exists, but the `Clients` page it links to is still a placeholder. Users cannot yet organize work by the companies they work for. This slice also becomes the CRUD template every later story (Projects, Tasks) will copy.

## What Changes

- Add a new `clients` domain table (Drizzle schema + committed SQL migration), soft-delete from the start (`deletedAt`), with names unique per user.
- Add authenticated, user-scoped Nitro API under `server/api/clients/`: list, create, update, soft-delete — each guarded by `requireAuth` + CSRF and using the `{ messageKey, params }` error contract.
- Replace the placeholder `app/pages/clients.vue` with a working CRUD surface: PrimeVue `DataTable` list, `Dialog`-based create/edit form, `ConfirmDialog` delete, `Toast` feedback, and a dedicated empty state.
- Surface field errors (empty/duplicate name) inline; surface server/network failures via `Toast`.
- Add new i18n strings to `en.json` and `pl.json` in parity.

## Capabilities

### New Capabilities
- `client-management`: Authenticated, user-scoped CRUD for Clients (name only), with per-user unique names, soft delete, strict cross-user isolation, and a PrimeVue Dialog-based UI.

### Modified Capabilities
<!-- None: the shell and data-persistence specs are unchanged; this slice only adds a new capability. -->

## Impact

- **Schema/DB**: new `server/db/schema/clients.ts` + generated migration under `server/db/migrations`.
- **API**: new handlers `server/api/clients/index.get.ts`, `index.post.ts`, `[id].patch.ts`, `[id].delete.ts`.
- **UI**: rewritten `app/pages/clients.vue`; reuses `utils/extractMessageKey`.
- **i18n**: `i18n/locales/en.json`, `pl.json`.
- **Tests**: `test/unit`, `test/nuxt`, `test/e2e` (including a cross-user isolation negative test).

## Non-goals

- Client **detail view** and anything about Projects (User Story #2) — out of scope.
- Remote system configuration / credentials (User Story #8) — only acknowledged as future field growth; not built now.
- A "show archived" / restore UI — the API excludes soft-deleted rows; restore stays a purely additive future change.
