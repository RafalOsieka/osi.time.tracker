## Context

The authenticated shell and the `client-management` slice are complete: `clients` (uuid PK `default uuidv7()`, `userId` FK, soft-delete `deletedAt`, partial unique index `(userId, name) WHERE deletedAt IS NULL`) plus its API and Dialog-based UI are the established CRUD template. Conventions in place: shared boundary types in `shared/types/<entity>.ts` (single `zod` schema + serialized DTO), the lazy `db` client from `server/db/index.ts`, `requireAuth` + CSRF, `mapZodError` → `{ messageKey, params }`, PrimeVue-first UI with theme tokens, and i18n `en`/`pl` parity. This slice adds Projects as children of Clients, filling the placeholder `app/pages/projects.vue` and introducing the first parent/child relationship.

## Goals / Non-Goals

**Goals:**
- A `projects` table + migration mirroring `clients`, adding a `clientId` FK → `clients.id`, soft-delete from the start.
- User-scoped CRUD API with strict cross-user isolation (foreign/unknown project id → 404).
- `clientId` ownership validation on create/update (foreign/unknown client → 404, never confirming existence).
- Per-user-per-client unique names with a dedicated error key and inline field errors.
- A PrimeVue Dialog-based CRUD page with a Client `Select` in the form and an optional Client filter above the table.

**Non-Goals:**
- A Client detail view (explicitly not built, not deferred); Tasks (Story #3); remote-system config (Story #8); a restore/"show archived" UI.

## Decisions

- **Schema = `name` + required `clientId` now.** Mirrors `clients` (name-only) plus the relationship; the Dialog/row layout accommodates future field growth. _Alternative:_ add a description or speculative fields now — rejected as premature.
- **`clientId` ownership validated in the app layer, only when it changes.** Create — and update when the submitted `clientId` differs from the project's current client — look up the referenced client scoped by `userId` and `deletedAt IS NULL`; a foreign/unknown `clientId` returns 404. When an update leaves the `clientId` unchanged, the existing client is **not** re-validated (its soft-delete status is ignored), so a project's `name` remains editable even after its client has been soft-deleted. _Alternative:_ always re-validate the client on every update — rejected because it would block renaming a project whose client was later archived, which the user explicitly needs. _Alternative:_ rely on the FK constraint alone — rejected because a raw FK can reference another user's client and leaks existence via error shape.
- **Uniqueness via partial unique index `(userId, clientId, name) WHERE deletedAt IS NULL`.** Lets the same project name exist under different clients and lets an archived name be reused. App-layer duplicate check is the primary guard, with DB unique-violation (`23505`) mapped to `error.projectNameDuplicate` as a fallback, mirroring `clients/index.post.ts`. _Alternative:_ plain composite unique index — rejected; it would block reusing a soft-deleted name.
- **Soft delete from the start** (`deletedAt timestamptz NULL`); never hard `DELETE`; all reads filter `deletedAt IS NULL`. _Alternative:_ hard delete — rejected; loses history and complicates later Task FKs.
- **Optional `clientId` list filter.** `GET /api/projects` accepts an optional `clientId` query param, always additionally scoped by `userId`; an invalid/foreign `clientId` yields an empty list (not an error) since it is a filter, not a lookup. _Alternative:_ separate per-client endpoint — rejected; a single filtered list is simpler and avoids a detail route.
- **Isolation returns 404, not 403,** for foreign/unknown project ids and foreign `clientId` on write, so existence is never confirmed. _Alternative:_ 403 — rejected as it leaks existence.
- **Dialog-based CRUD** (`DataTable` + `Dialog` + PrimeVue `Select` for client + `ConfirmDialog` + `Toast`), with a Client filter `Select` above the table. Error contract translated client-side; inline field errors mirror `login.vue` (`aria-invalid`/`aria-describedby`). _Alternative:_ master/side-panel detail — rejected; it sneaks in the deferred client detail view.

## Risks / Trade-offs

- **Cross-user leakage** (highest-weight criterion) → always filter on `userId` and return 404 for foreign/unknown project ids and foreign `clientId`; add dedicated e2e negatives (cross-user isolation and foreign-`clientId` → 404).
- **Foreign `clientId` assignment** → validate client ownership on every create/update before writing; never trust the client-supplied `clientId`.
- **Duplicate-name race / DB unique violation** → app-layer check plus mapping the `23505` unique-constraint error to `error.projectNameDuplicate`.
- **Partial unique index portability** → if `drizzle-kit` handling is awkward, fall back to the app-layer uniqueness check over non-deleted rows.
- **Future field growth (Story #8 / Tasks)** → keep the Dialog and row-action area structured so adding fields/actions needs no relayout.

## Migration Plan

- Add `server/db/schema/projects.ts`, export it from the schema barrel (`server/db/schema/index.ts`).
- `pnpm db:generate` to produce a committed SQL migration; verify with `pnpm db:migrate`.
- Rollback: the change is additive (new table only); reverting drops the `projects` table with no impact on existing `clients`/`users` data.

## Open Questions

- None blocking. Partial-index vs app-layer uniqueness is resolved (partial index primary, app-layer check fallback); filter-by-foreign-`clientId` behavior is resolved (empty list, not an error).
