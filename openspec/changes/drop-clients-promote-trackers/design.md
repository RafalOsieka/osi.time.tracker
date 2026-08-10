## Context

See `proposal.md` for motivation. Today the hierarchy is `Client → Project (required clientId) → Task?` with `RemoteSystemConfig` 1:1 on Client (`clientId` unique). Active config resolution walks Project → Client → config. Browser secrets and task issue provenance key off config row ids. Prod already names clients like tracker instances. This change is a cross-cutting domain rename + parent flip with a real data migration.

## Goals / Non-Goals

**Goals:**
- Single first-class **Tracker** entity (named connection) at DB/API/UI layers.
- Optional project→tracker FK; local projects first-class.
- One-hop active-config resolve: `project.trackerId` + `deletedAt IS NULL`.
- Stable tracker row ids through migration (no secret/ref rewrite).
- Consistent “Tracker” naming in code paths, routes, types, and i18n.

**Non-Goals:**
- Remote project catalog / `remoteProjectId` (later session).
- Reports redesign beyond removing Client fields.
- Changing adapter contracts beyond parent resolution path.
- Rewriting historical task issue refs.

## Decisions

### 1. Rename table `remote_system_configs` → `trackers` (keep ids)
- **Choice:** Physical rename (or recreate-with-same-ids) to `trackers`; drop `clientId`; add required `name`.
- **Why:** Matches product noun end-to-end; avoids dual vocabulary (`RemoteSystemConfig` vs Tracker).
- **Alternative considered:** Keep table name `remote_system_configs` and only rename UI — rejected; user required code consistency.

### 2. Projects: `clientId` NOT NULL → `trackerId` NULLABLE
- **Choice:** Nullable FK to `trackers.id`; uniqueness among active rows with NULLS NOT DISTINCT pattern (linked: user+tracker+name; local: user+name where tracker null) mirroring tasks.
- **Why:** Local projects without dummy parents.
- **Alternative:** Keep required parent with a synthetic “Local” tracker — rejected; invents fake entities.

### 3. Drop `clients` entirely in one migration
- **Choice:** Single committed SQL migration that:
  1. Adds `trackers.name` (nullable temporarily) + `projects.trackerId` (nullable).
  2. For each **active** client with an **active** remote config: set tracker.name = client.name; set projects.trackerId = config.id.
  3. For clients without active config (and all soft-deleted clients): leave projects.trackerId null (flatten); auto-suffix local name collisions (`Name`, `Name (2)`, …) among active local projects per user.
  4. Soft-deleted configs: do not promote into active trackers from dead clients; projects that only hung under soft-deleted clients become local (flatten).
  5. Drop `projects.clientId`, drop `trackers.clientId` / unique(clientId), drop `clients` table; enforce NOT NULL on `trackers.name` and unique active name per user.
- **Why:** Full drop, stable ids, matches locked prod policies.
- **Alternative:** Multi-step expand/contract across releases — unnecessary for single-tenant self-host MVP with coordinated deploy.

### 4. API surface
```
REMOVE                              ADD
/api/clients*                       /api/trackers (GET list, POST)
/api/clients/:id*                   /api/trackers/:id (PATCH, DELETE)
/api/clients/:id/remote-config*     (folded into tracker body)
```
- Nested remote-config routes deleted; server-execution proxy routes rekey from config id to tracker id (same uuid values post-migration).
- Project APIs: `clientId`/`clientName` → optional `trackerId`/`trackerName`; filter `?trackerId=`.

### 5. Active config resolution
- Replace Project→Client→config with `project.trackerId` join where `trackers.deletedAt IS NULL`.
- Task-stored `remoteSystemConfigId` column renames to `trackerId` (or keep column name only if migration cost high — prefer rename for consistency; value unchanged).

### 6. UI
- `app/pages/clients.vue` → `trackers.vue`; form = name + former remote-config fields + secret.
- Sidebar: Clients → Trackers (`/trackers`).
- Projects: optional Tracker select; confirm on detach when linked tasks exist; confirm on tracker delete always.
- Timer grouping: project name only (`timerViewGrouping` / DTO drop `clientName`).

### 7. Spec capability map
- New `tracker-management` absorbs client-management + remote-system-config.
- Retire those two capability specs via REMOVED deltas at archive time.

## Risks / Trade-offs

- **[Risk] Broad rename misses a join or test seed** → Mitigation: grep-driven cutover checklist in tasks; run full unit/nuxt/e2e.
- **[Risk] Local name auto-suffix surprises prod users** → Mitigation: deterministic ` (n)` suffix; rare if prod clients were tracker-named with configs.
- **[Risk] Soft-deleted client flatten loses “folder”** → Mitigation: accepted policy; no non-tracker folder in scope.
- **[Trade-off] Detach keeps historical issue refs** → Stale refs visible only as cache without URL/search; consistent with config soft-delete today.
- **[Trade-off] Capability retirement leaves empty main specs until archive** → Archive step removes/replaces main specs; apply implements against deltas + new capability.

## Migration Plan

1. Ship migration + app in same release (standalone compose migrator runs first).
2. Backup DB before migrate on prod.
3. After migrate: verify tracker count = former active client+config pairs; project FKs; localStorage secrets still match ids; link/push on a known project.
4. Rollback: restore DB backup (forward migration is destructive on `clients`); no automatic down migration required if backup policy holds.

## Open Questions

None that block implementation. Docs (`vision.md` / `wbs.md`) language update can ship in the same change or immediately after; not behavior-blocking.
