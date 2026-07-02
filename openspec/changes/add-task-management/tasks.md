## 1. Schema & Migration (backend)

- [x] 1.1 Add `server/db/schema/tasks.ts` (id `uuidv7`, `userId` FK, **nullable** `projectId` FK → `projects.id`, `name` (NOT unique), `number` `integer` NOT NULL, `createdAt`, `updatedAt`, `deletedAt`), a unique index on `(userId, number)` and a `(userId, projectId)` lookup index (no unique index on `name`); export it from `server/db/schema/index.ts`
- [x] 1.2 Generate the SQL migration with `pnpm db:generate` and commit it under `server/db/migrations`
- [x] 1.3 Add a unit/integration test verifying the migration applies, that duplicate task names are allowed, and that the `(userId, number)` unique index rejects a duplicate number for the same user while allowing the same number across different users

## 2. Boundary Type & Validation (shared)

- [x] 2.1 Add `shared/types/task.ts`: a single `zod` request schema (`name` trimmed/non-empty/length-bounded — NOT required unique, `projectId` optional/nullable uuid; `number` is server-assigned and NOT in the request body) plus the response DTO (`id`, `number` integer, `name`, nullable `projectId`/`projectName`/`clientName`, timestamps typed as `string`)
- [x] 2.2 Add a unit test for the `zod` schema covering trimming, empty/whitespace rejection, length bounds, omitted/null `projectId` accepted (project-less), invalid `projectId` rejected, and that no `number` is expected in the request, asserting `ZodError` maps to the `{ messageKey, params }` contract via `mapZodError`

## 3. API Endpoints (backend)

- [x] 3.1 Implement `GET /api/tasks` (`server/api/tasks/index.get.ts`): `requireAuth`, list own non-deleted tasks ordered by `number`, returning `id` and `number`, optional `projectId` filter plus the `projectId=none` sentinel for project-less tasks, LEFT joins resolving `projectName`/`clientName` ignoring parent `deletedAt` (null for project-less)
- [x] 3.2 Add integration tests for `GET /api/tasks`: own-only isolation, soft-deleted exclusion, `number` present and ordering, resolved names persisting after a parent is soft-deleted, `projectId` filter, empty list for a foreign/unknown `projectId`, project-less tasks listed with null names, and the `projectId=none` filter
- [x] 3.3 Implement `POST /api/tasks` (`index.post.ts`): `requireAuth` + CSRF, validate body, when `projectId` is provided enforce owned non-deleted project (404 otherwise) else create project-less, and atomically assign the next per-user `number` (`COALESCE(MAX(number),0)+1` scoped by `userId`, retrying on a `(userId, number)` unique-violation); duplicate names are allowed (no name-uniqueness check)
- [x] 3.4 Add integration tests for `POST /api/tasks`: happy path, project-less creation, empty-name rejection, invalid `projectId`, foreign/unknown `projectId` → 404, duplicate names allowed, first task numbered 1, numbers increasing per user, per-user isolation of numbering, and soft-deleted numbers not reused
- [x] 3.5 Implement `PATCH /api/tasks/[id]` (`[id].patch.ts`): addressed by `uuidv7` id, scoped by `userId`, same `name` validation as create (no uniqueness), leave `number` immutable, re-validate `projectId` only when changed to a non-null project, allow clearing to `null`, allow rename when `projectId` unchanged even if that project is soft-deleted
- [x] 3.6 Add integration tests for `PATCH /api/tasks/[id]`: happy path, duplicate name allowed, `number` unchanged by edit, foreign/unknown id → 404, unchanged-project not re-validated, rename allowed under a soft-deleted project, clearing the project to null, and assigning a project to a project-less task
- [x] 3.7 Implement `DELETE /api/tasks/[id]` (`[id].delete.ts`): `requireAuth` + CSRF, soft-delete by setting `deletedAt` scoped by `userId`, never hard-delete
- [x] 3.8 Add integration tests for `DELETE /api/tasks/[id]`: successful soft-delete retains the row and removes it from the list, and foreign/unknown id → 404
- [x] 3.9 Add an integration test asserting all task endpoints reject unauthenticated (401) and mutating endpoints reject missing CSRF

## 4. Tasks Page UI (frontend)

- [x] 4.1 Create `app/pages/tasks.vue`: PrimeVue `DataTable` listing tasks (`#N` number, name, project, client with a "no project" indicator), a Project filter including a project-less option, and a dedicated empty state with a create call-to-action
- [x] 4.2 Add a `Dialog`-based create/edit form with a labelled, optional/clearable Project `Select` (seeded with the task's `projectId`/`projectName` when editing a soft-deleted project), inline field errors with `aria-invalid`/`aria-describedby`, and `ConfirmDialog` delete
- [x] 4.3 Wire mutations via `$csrfFetch` / `useCsrfFetch`, translate API `messageKey` via `t()`, and surface success/failure through `Toast` (reuse `utils/extractMessageKey`)
- [x] 4.4 Add `en.json` and `pl.json` i18n strings (labels including the `#N` number column, actions, empty state, toasts) in parity
- [x] 4.5 Add a Nuxt component test for `tasks.vue`: empty state renders, create/edit dialog opens with a labelled Project select, and inline field error exposes `aria-invalid`/`aria-describedby`
- [x] 4.6 Add an E2E test for the full Tasks flow: create (with and without a project), duplicate names allowed with distinct `#N` numbers, edit, clearing/assigning a project, filter by project and by project-less, delete-with-confirm, and a cross-user isolation negative case (foreign task id → 404)

## 5. Verification

- [x] 5.1 Run `pnpm lint`, `pnpm format:check`, and `pnpm type-check`
- [x] 5.2 Run `pnpm test:unit`, `pnpm test:nuxt`, and `pnpm test:e2e` and confirm the i18n catalog parity test passes
