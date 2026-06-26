## Context

The authenticated shell (`openspec/specs/frontend-shell`) is complete; its `Clients` sidebar link routes to `app/pages/clients.vue`, a placeholder rendering `nav.clients` + `page.comingSoon`. The data layer is Drizzle-only via the shared client `server/db/index.ts`, with committed SQL migrations (`data-persistence` spec). Conventions already established: `users.ts` (uuid PK `default uuidv7()`, camelCase columns, `withTimezone` timestamps), `protected.get.ts` (`const { user } = await requireAuth(event)`), and `login.vue` (PrimeVue form, `aria-invalid`/`aria-describedby`, `{ messageKey }` → `extractMessageKey` → `t()`). This slice fills the Clients page and sets the CRUD template for later stories.

## Goals / Non-Goals

**Goals:**
- A `clients` table + migration following existing conventions, soft-delete from the start.
- User-scoped CRUD API with strict cross-user isolation (foreign id → 404).
- A PrimeVue Dialog-based CRUD page that scales when fields grow (Story #8).
- Per-user unique names with a dedicated error key and inline field errors.

**Non-Goals:**
- Client detail view / Projects (Story #2); remote-system config (Story #8); a restore/"show archived" UI.

## Decisions

- **Schema = `name` only now.** Designed knowing remote-config fields arrive later, so the Dialog/row layout must accommodate growth. _Alternative:_ add speculative fields now — rejected as premature.
- **Unique per user via partial unique index `(userId, name) WHERE deletedAt IS NULL`.** Lets an archived name be reused. _Alternative:_ plain composite unique index — rejected because it would block reusing a soft-deleted name. App-layer check remains a fallback if the partial index is impractical.
- **Soft delete from the start** (`deletedAt timestamptz NULL`); never hard `DELETE`; all reads filter `deletedAt IS NULL`. _Alternative:_ hard delete now — rejected; would lose history and complicate later FKs.
- **Dialog-based CRUD** (`DataTable` + `Dialog` + `ConfirmDialog` + `Toast`). _Alternatives:_ inline row edit (cramped as fields grow) and master/side-panel (sneaks in a detail view deferred to Story #2) — both rejected.
- **Isolation returns 404, not 403, for foreign/unknown ids** so existence is never confirmed. _Alternative:_ 403 — rejected as it leaks existence.
- **Error contract** `{ messageKey, params }` translated client-side; field errors inline, server/network failures via `Toast`.

## Risks / Trade-offs

- **Cross-user leakage** (highest-weight criterion) → always filter on `userId` and return 404; add a dedicated e2e negative test.
- **Duplicate-name race / DB unique violation** → map the unique-constraint error to `error.clientNameDuplicate`.
- **Future field growth (Story #8)** → keep Dialog and row-action area structured so adding fields/actions needs no relayout.
- **Partial unique index portability** → if `drizzle-kit` handling is awkward, fall back to an app-layer uniqueness check over non-deleted rows.

## Migration Plan

- Add `server/db/schema/clients.ts`, export from the schema barrel if present.
- `pnpm db:generate` to produce a committed SQL migration; verify with `pnpm db:migrate`.
- Rollback: the change is additive (new table only); reverting drops the table with no impact on existing data.

## Open Questions

- None blocking; partial-index vs app-layer uniqueness is resolved with the partial index as primary and the app-layer check as documented fallback.
