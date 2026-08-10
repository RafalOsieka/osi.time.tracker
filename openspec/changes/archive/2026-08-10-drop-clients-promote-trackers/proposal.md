## Why

In production, “Client” is not a company entity — it is a named attachment point for a remote issue tracker (OpenProject A, Redmine B). Projects cannot be local without a dummy client, and remote config has no display name of its own. Dropping `clients` and promoting a first-class **Tracker** aligns the model with real usage and simplifies linking/push resolution.

## What Changes

- **BREAKING:** Remove the `clients` table, `/api/clients*`, `/clients` page, and all Client boundary types/i18n.
- **BREAKING:** Promote `remote_system_configs` to a named first-class **Tracker** entity (table/types/routes/UI: `trackers` / `/api/trackers` / `/trackers`). Create = one form: name + system type + URL + execution/rounding + optional defaults + browser secret.
- **BREAKING:** Projects gain optional `trackerId` (nullable FK) replacing required `clientId`. Local projects (no tracker) are first-class.
- Link/push only when the task’s project has an **active** tracker; local/project-less tasks cannot link or export.
- Detach project from tracker: confirm → allow; keep existing issue refs historical; block new links.
- Delete tracker: confirm → allow with projects still pointing; soft-delete tracker; keep FKs; linking/push off.
- Timer labels show **project name only** (drop secondary client/tracker segment); drop `clientName` from time-entry DTOs.
- Prod migration: active client + active config → tracker name from client, re-parent projects (stable config ids); clients without active config (incl. soft-deleted) → projects become local with auto-suffix on name clashes.

## Capabilities

### New Capabilities
- `tracker-management`: First-class Tracker CRUD (name + connection config), browser-only secrets, soft-delete, isolation, Trackers UI, and server-execution proxy/rounding behavior formerly nested under Client remote config.

### Modified Capabilities
- `client-management`: Retire — remove all Client requirements.
- `remote-system-config`: Retire — fold into `tracker-management` (remove Client-nested config requirements).
- `project-management`: Optional `trackerId`; uniqueness and list/filter/DTO use tracker instead of client.
- `remote-issue-linking`: Resolve active tracker via `project.trackerId` (not Client → config).
- `remote-sync-review`: Row state/reasons and day-review aggregate use tracker, not Client/config-on-client.
- `time-tracking`: DTOs and timer UI drop `clientName`; group context is project-only.
- `frontend-shell`: Nav Clients → Trackers (`/trackers`).

## Impact

- Schema/migrations, Drizzle schema barrel, all Client→Project→config joins and `useActiveRemoteConfigs`.
- API surface, shared types, pages (`clients.vue` → `trackers.vue`, `projects.vue`), sidebar, i18n en/pl.
- E2E/unit/nuxt tests seeded on Client hierarchy; docs vision/wbs language (follow-up ok outside apply if scoped out of code).

## Non-goals

- Remote project id / browse-import catalog of remote projects.
- Non-tracker folder above projects.
- Showing tracker name beside project on the timer.
- Rewriting browser secrets (tracker row ids stay stable across migration).
- Reports “by client” redesign beyond dropping Client as an entity (reports still placeholder).
