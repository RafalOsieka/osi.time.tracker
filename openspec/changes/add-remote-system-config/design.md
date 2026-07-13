## Context

Remote issue-tracker integration (user stories 9–11) begins with per-Client configuration. This change (US-9, WBS 5.1–5.4) delivers only the configuration foundation. The codebase already has an established vertical-slice pattern (Client/Project): Drizzle schema in `server/db/schema`, a single-source boundary type in `shared/types/<entity>.ts` (zod request schema + serialized DTO), user-scoped Nitro API routes guarded by `requireAuth` + CSRF returning `{ messageKey, params }` errors, PrimeVue forms, and i18n parity between `en`/`pl`.

The MVP ships **client-side execution mode only**: API calls will later be made directly from the browser (for trackers behind a VPN the user is already on). The defining constraint is that the API secret **must never reach the server**.

## Goals / Non-Goals

**Goals:**

- Store a per-Client remote tracker configuration (system type, base URL, execution mode, rounding rule, required-field defaults) in the database.
- Keep the API secret exclusively in the browser; guarantee it is never accepted, logged, or persisted server-side.
- Full CRUD for a Client's config, strictly scoped to the authenticated user.
- An adapter-agnostic shape that later serves both OpenProject and Redmine, and both built-in fields (e.g. `activity`) and instance-specific required custom fields.

**Non-Goals:**

- No adapter/transport, no live remote calls, no "test connection", no fetching of activity/custom-field option lists (US-10a / US-14).
- No backend-side execution mode or server-side encrypted credentials (post-MVP 🟡).
- No issue linking, time push, rounding *application*, or push locks (US-10a / US-11).

## Decisions

### D1: One `RemoteSystemConfig` per Client (unique index on `clientId`)

Modeled as a separate table `remote_system_configs` with a unique `clientId` and a nested endpoint `clients/[id]/remote-config`.
**Alternative considered:** many configs per Client (full collection like projects). Rejected for MVP — WBS/US-9 say "per Client" (singular), a single tracker per client matches the push model (US-11), and a unique constraint keeps the API a simple GET/PUT/DELETE upsert.

### D2: Secret lives only in the browser (`localStorage`, keyed by config id)

The DB row stores everything **except** the credential. The browser holds the secret in `localStorage` under a key derived from the config `id` (e.g. `rsc:<configId>`), via a dedicated composable. The zod request schema does **not** include a secret field, so the server can never accidentally persist it; a submitted secret field is rejected/stripped.
**Alternatives considered:** `sessionStorage` (rejected — user chose persistence across sessions for convenience); server-side encrypted storage (rejected — that is backend-side mode, post-MVP).
**Consequence:** the API response DTO must return the config `id` even though the server never sees the secret, so the client can locate its stored credential; deleting a config must also clear the matching `localStorage` key (orphan-secret hygiene).

### D3: `requiredFieldDefaults` as a generic key–value map, picker deferred

Defaults for the remote system's required fields (OpenProject `activity`, Redmine `activity_id`, required custom fields) are stored as an adapter-agnostic `Record<string, string>` JSON column.
**Alternative considered:** a dedicated `activityId` column. Rejected — OpenProject-specific, ignores custom/required fields and Redmine. Because live option lists require the adapter (not in scope), US-9 stores the shape but the fetched-dropdown picker lands with the adapter (US-10a/US-11). US-9 exposes at most raw/no default entry.

### D4: Reuse the existing boundary-type + error contract

`shared/types/remote-system-config.ts` defines a zod schema (validated/normalized, `mapZodError` → `{ messageKey, params }`) and a serialized DTO (timestamps as `string`); no `any`. Enums (`systemType`, `executionMode`, `roundingRule`) are zod enums shared client/server.

## Risks / Trade-offs

- **[Browser-only secret is lost on cache/localStorage clear]** → Accepted for MVP; the secret is re-enterable and the rest of the config survives server-side. Documented in UI copy.
- **[`executionMode` enum has only one MVP value (`client`)]** → Keep it a stored enum now so backend-side mode (post-MVP) needs no schema migration; default and only-allowed value is `client` for this change.
- **[Storing a secret in `localStorage` is XSS-exposed]** → Mitigated by the existing baseline CSP and the fact that this is a self-hosted single-user app; backend-side encrypted mode is the post-MVP hardening path.
- **[Generic `requiredFieldDefaults` map is unvalidated against a real schema]** → Accepted; validation against fetched field definitions arrives with the adapter.

## Migration Plan

- Additive Drizzle migration creating `remote_system_configs` (generated via `pnpm db:generate`, applied via `pnpm db:migrate`). No changes to existing tables; rollback is dropping the new table. No data backfill.

## Open Questions

- None blocking. Rounding-rule value set (e.g. `none` | `up_15m` | `up_30m` | `up_1h`) is finalized in the spec; the exact enum members can be refined during implementation without changing the contract shape.
