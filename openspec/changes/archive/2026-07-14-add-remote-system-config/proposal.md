## Why

User story 9 (WBS 5.1–5.4) is the first slice of remote issue-tracker integration: before a user can browse/link issues (US-10a) or push time (US-11), they must be able to configure a remote tracker per Client. This change delivers that configuration foundation, storing everything except the API secret server-side while keeping credentials strictly in the browser for the MVP client-side execution mode.

## What Changes

- Add a `RemoteSystemConfig` associated with a Client (**one per Client**): `systemType` (`redmine` | `openproject`), `baseUrl`, `executionMode`, `roundingRule`, and an adapter-agnostic `requiredFieldDefaults` key–value map.
- Persist the full config in the database **except the API secret**. For the MVP **client-side** execution mode, the credential is entered and kept **only in the browser** (`localStorage`, keyed by config id) and is never sent to or stored on the server.
- Add user-scoped API endpoints to read, upsert, and delete a Client's remote config (`requireAuth` + CSRF; `{ messageKey, params }` errors).
- Add a remote-config form on the Client edit surface (PrimeVue `Select`/`InputText`/`Password`), with new `en`/`pl` i18n keys in parity.
- Add `shared/types/remote-system-config.ts` (single-source boundary type: zod request schema + serialized DTO, no `any`).

## Capabilities

### New Capabilities
- `remote-system-config`: Per-Client configuration of a remote issue tracker (system type, base URL, client-side execution mode, rounding rule, and default values for the remote system's required fields), with browser-only credential handling and full CRUD scoped to the authenticated user.

### Modified Capabilities
<!-- None. No existing spec's requirements change; this adds a new capability only. -->

## Impact

- **New**: `server/db/schema/remote-system-configs.ts` (+ migration), `shared/types/remote-system-config.ts`, `server/api/clients/[id]/remote-config.{get,put,delete}.ts`, client-side config form + a composable for the browser-held secret.
- **Docs/i18n**: new `error.*` and form label keys in `i18n/locales/{en,pl}.json`.
- **Tests**: unit (zod schema, secret never in DTO), nuxt (form), e2e (config CRUD, cross-user isolation).

## Non-goals

- No adapter, transport, or live remote calls — no "test connection", no fetching of activities/custom-field options (deferred to US-10a / US-14).
- No backend-side execution mode or server-side encrypted credential storage (post-MVP, WBS 5.2/5.4 🟡).
- No issue browse/link (US-10a), no time push, rounding *application*, or push locks (US-11).
- No Redmine-specific work beyond allowing `redmine` as a stored `systemType` value.
- Does not depend on `setup-openproject-dev-env` landing first (config storage needs no live instance), though that change enables later slices.
