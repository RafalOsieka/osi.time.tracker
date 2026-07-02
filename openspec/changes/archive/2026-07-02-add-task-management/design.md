## Context

The `Client → Project → Task` hierarchy already has working, user-scoped CRUD for its top two levels. `client-management` and `project-management` established a consistent pattern: a soft-deletable Drizzle table keyed by `uuidv7()`, authenticated + CSRF-guarded Nitro handlers under `server/api/<entity>/`, a single `zod`-validated boundary type in `shared/types/`, and a PrimeVue `DataTable` + `Dialog` page mirroring `login.vue`'s accessibility. Tasks are the leaf level users actually log time against; every downstream story (timer, manual entries, remote linking) depends on them. This slice copies the Project pattern rather than inventing a new one.

## Goals / Non-Goals

**Goals:**
- User-scoped CRUD for Tasks, each belonging to at most one Project owned by the same user, or to no project at all (project-less).
- Non-unique names (duplicates allowed); each task carries a per-user sequential integer `number` (starting at 1) that keeps duplicate-named tasks distinguishable, shown as `#N` in the UI. Soft delete from the start.
- `uuidv7` `id` stays the sole API identifier; the `number` is display metadata only (no number-addressed endpoints in this slice).
- Reuse the Project ownership/isolation and `{ messageKey, params }` error patterns verbatim.
- Return resolved `projectName` (and `clientName`) so a task remains readable after a parent is soft-deleted; both are `null` for a project-less task.
- Accessible, tokenized Tasks page with an optional Project filter, including a filter for project-less tasks and a clearable Project select.

**Non-Goals:**
- TimeEntry, timer, RemoteIssueRef, and remote push (later stories).
- Restore / "show archived" UI.
- A dedicated Project *detail* view embedding its tasks (only a filterable Tasks list is in scope here).

## Decisions

- **Mirror the `projects` schema for `tasks`, but make `projectId` nullable and add a per-user `number`.** New `server/db/schema/tasks.ts` with `id (uuidv7)`, `userId` FK, **nullable** `projectId` FK → `projects.id`, `name`, an `integer` `number`, timestamps, and `deletedAt`; a `(userId, projectId)` lookup index and a unique index on `(userId, number)`. Task **names are deliberately NOT unique** — no unique index on name at all; duplicates are allowed and disambiguated by `number`/`id`.
  - *Alternative considered:* keeping unique names per user/project. Rejected by this change — the product now wants duplicate names allowed, using the `number` (shown as `#N`) plus the `uuidv7` `id` as the distinguishers.
  - *Alternative considered:* keeping `projectId` NOT NULL and modelling "no project" via a synthetic default project. Rejected — leaks an artificial project into lists/filters and complicates ownership; a nullable column is simpler and honest.
- **Allocate `number` as a per-user monotonic counter, atomically.** On create, the server computes the next value as `COALESCE(MAX(number), 0) + 1` scoped to the `userId` **within the insert transaction** (or via a dedicated per-user counter row), so concurrent creates cannot collide; the `(userId, number)` unique index is the source of truth and a rare race retries. Soft-deleted tasks still count toward `MAX`, so numbers are never reused and stay stable/monotonic per user. Numbers are assigned once at creation and never change on edit.
  - *Alternative considered:* a global Postgres `SERIAL`/sequence. Rejected — a global sequence is not per-user (users would see gaps and non-1-based numbers); per-user `MAX+1` under the unique index gives each user a clean 1-based sequence.
- **Ownership enforced through the parent Project only when a project is assigned.** On create when `projectId` is provided, and on update only when `projectId` changes to a non-null value, validate the target project is non-deleted and owned by the user; a foreign/unknown `projectId` resolves to HTTP 404 without confirming existence. A `null`/omitted `projectId` skips this check (project-less). An unchanged `projectId` is not re-validated, so a task can be renamed after its project is soft-deleted.
  - *Alternative considered:* also re-validating the grandparent client. Rejected — Project already guarantees the client chain; re-checking couples Tasks to client lifecycle unnecessarily.
- **Resolve `projectName`/`clientName` via LEFT joins that ignore parent `deletedAt`.** Same technique `project-management` uses for `clientName`, so names persist after soft-delete; LEFT joins yield `null` names for project-less tasks.
- **Single boundary type in `shared/types/task.ts`.** One `zod` schema for the request body (`name` trimmed/bounded, `projectId` an **optional/nullable** uuid — omitted or explicit `null` means project-less; the `number` is **server-assigned and NOT part of the request body**), a plain response DTO exposing `id`, `number` (integer), `name`, nullable `projectId`/`projectName`/`clientName`, and serialized timestamps as `string`; `mapZodError` for validation failures — consistent with the boundary-type contract.
- **`GET /api/tasks` accepts an optional `projectId` filter**, always additionally scoped by `userId`; a foreign/unknown `projectId` yields an empty list (no existence disclosure), mirroring Projects' `clientId` filter. A dedicated sentinel filter value (e.g. `projectId=none`) restricts results to project-less tasks (`projectId IS NULL`).

## Risks / Trade-offs

- [Concurrent creates racing for the same `number`] → The `(userId, number)` unique index is the source of truth; if two concurrent creates compute the same `MAX+1`, one insert fails on the unique constraint and the handler retries the allocation rather than surfacing an error.
- [Duplicate names are now allowed] → Intentional per this change; tasks are disambiguated in the UI by `#N` (their `number`) and internally by `uuidv7` `id`. No name uniqueness is enforced and no `error.taskNameDuplicate` is emitted.
- [Orphan-looking tasks after a project is soft-deleted] → Accepted and intentional: joins ignore parent `deletedAt`, and the edit dialog seeds the Project select with the task's current `projectId`/`projectName` so a soft-deleted project still displays.
- [Growing UI duplication across Clients/Projects/Tasks pages] → Accepted for this slice to keep momentum; extracting a shared CRUD-page composable is a future, purely additive refactor and out of scope here.
