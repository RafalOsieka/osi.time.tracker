## Why

User Story #3 (WBS 3.3) is the next slice of the `Client → Project → Task` hierarchy. Clients and Projects already have working CRUD, but Tasks — the level users actually log time against — do not yet exist, so nothing downstream (timer, manual entries, remote linking) can be built. This slice completes the hierarchy and copies the established Project CRUD template.

## What Changes

- Add a new `tasks` domain table (Drizzle schema + committed SQL migration), soft-delete from the start (`deletedAt`). A task's `projectId` is **optional (nullable)**: a task may belong to exactly one project owned by the same user, or to no project at all (project-less, owned directly by the user). Task **names are NOT unique** — duplicate names are allowed. Each task is instead assigned a **per-user sequential integer `number`** starting at 1 that is unique per user (uniqueness enforced by a `(userId, number)` index), while the `uuidv7` `id` remains the sole API identifier.
- Add authenticated, user-scoped Nitro API under `server/api/tasks/`: list (with optional `projectId` filter, including a filter for project-less tasks), create, update (including assigning or clearing the project), soft-delete — each guarded by `requireAuth` + CSRF and using the `{ messageKey, params }` error contract. Tasks are always addressed by their `uuidv7` `id`; number-based endpoints are explicitly out of scope for now.
- Resolve and return each task's owning `projectName` (and `clientName`) via joins that ignore the parent's `deletedAt`, so names persist after a parent is soft-deleted; both are `null` for a project-less task.
- Add a working Tasks CRUD surface (PrimeVue `DataTable`, `Dialog` create/edit form with an optional, clearable Project select, `ConfirmDialog` delete, `Toast` feedback, dedicated empty state), mirroring the Projects page. The list shows each task's `number` as `#N` (e.g. `#1`, `#2`) so duplicate-named tasks stay distinguishable.
- Add a boundary type + `zod` request schema in `shared/types/task.ts`.
- Add new i18n strings to `en.json` and `pl.json` in parity.

## Capabilities

### New Capabilities
- `task-management`: Authenticated, user-scoped CRUD for Tasks (the leaf of the hierarchy), with an optional project assignment (project-less tasks allowed), non-unique names distinguished by a per-user sequential `number` displayed as `#N`, project ownership validation when assigned, soft delete, strict cross-user isolation, and an accessible PrimeVue Dialog-based UI. The `uuidv7` `id` is the API identifier.

### Modified Capabilities
<!-- None: project-management, client-management, and data-persistence specs are unchanged; this slice only adds a new capability. -->

## Impact

- **Schema/DB**: new `server/db/schema/tasks.ts` + generated migration under `server/db/migrations`; export from `server/db/schema/index.ts`.
- **API**: new handlers `server/api/tasks/index.get.ts`, `index.post.ts`, `[id].patch.ts`, `[id].delete.ts`.
- **Types**: new `shared/types/task.ts` (DTO + `zod` schema).
- **UI**: new `app/pages/tasks.vue`; reuses `utils/extractMessageKey`.
- **i18n**: `i18n/locales/en.json`, `pl.json`.
- **Tests**: `test/unit`, `test/nuxt`, `test/e2e` (including a cross-user isolation negative test).

## Non-goals

- The live **timer** and **manual TimeEntry** CRUD (User Stories #4–#5) — out of scope.
- **RemoteIssueRef** linking and remote push (User Stories #9–#10) — future slices.
- A "show archived" / restore UI — the API excludes soft-deleted rows; restore stays a purely additive future change.
