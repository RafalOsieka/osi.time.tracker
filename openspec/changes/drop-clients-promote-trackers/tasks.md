## 1. Schema and data migration

- [ ] 1.1 Backend: Drizzle schema — rename `remote_system_configs` → `trackers` (add required `name`, drop `clientId`); change `projects.clientId` → nullable `trackerId` FK; rename task remote-config provenance column to `trackerId` if present; remove `clients` schema and barrel exports
- [ ] 1.2 Backend: Generate committed SQL migration implementing data rewrite (active client+config → tracker name + project re-parent; flatten orphans/soft-deleted clients to local; auto-suffix local name clashes; drop clients/client FKs; unique active tracker names; project uniqueness with NULLS NOT DISTINCT)
- [ ] 1.3 Backend test: Unit/integration test of migration helpers or SQL fixtures covering happy path, orphan flatten, and local name auto-suffix collision

## 2. Shared boundary types

- [ ] 2.1 Backend/shared: Add `shared/types/tracker.ts` (create/update schemas + `TrackerDto`); remove `shared/types/client.ts` and nested remote-config client types; rewrite `project.ts` (`trackerId?`, `trackerName?`); drop `clientName` from `time-entry` and day-review DTOs; rename remote-issue provenance fields to tracker ids
- [ ] 2.2 Backend test: Unit tests for tracker and project zod schemas (required fields, optional tracker, duplicates messageKeys, uuid nullability)

## 3. Tracker API

- [ ] 3.1 Backend: Implement `/api/trackers` list/create and `/api/trackers/[id]` patch/delete (auth, CSRF, isolation, name uniqueness, soft-delete, no secret persistence); delete all `/api/clients*` and nested remote-config routes
- [ ] 3.2 Backend test: E2E/integration for tracker CRUD happy path, duplicate name, foreign id 404, soft-delete excludes from list
- [ ] 3.3 Backend: Re-home server-execution proxy routes to tracker ids; update credential header handling comments/keys only as needed
- [ ] 3.4 Backend test: Integration for server-mode proxy happy path + missing secret / foreign tracker error

## 4. Project API

- [ ] 4.1 Backend: Update project list/create/patch/delete for optional `trackerId`, `trackerName` join (ignore tracker `deletedAt`), filter by tracker, uniqueness scopes, detach to null
- [ ] 4.2 Backend test: E2E/integration for local project create, tracker-linked create, duplicate scopes, foreign tracker 404, rename with soft-deleted tracker

## 5. Resolve path, linking, time entries, remote sync

- [ ] 5.1 Backend: Replace Project→Client→config resolution with `project.trackerId` + active tracker; update `remote-issue-refs`, reassign (REQ-179), time-entry list DTO (drop `clientName`), day-review aggregate
- [ ] 5.2 Backend test: Unit/integration for resolve/link eligibility (local project rejects link; active tracker allows; soft-deleted tracker rejects)
- [ ] 5.3 Backend test: Integration for time-entry list without `clientName` and day-review tracker surface without credentials

## 6. Frontend Trackers UI and shell

- [ ] 6.1 Frontend: Replace Clients page with Trackers page (`/trackers`) — single form (name + connection + secret), list/empty/confirm delete; remove `clients.vue` and client composables; update secret localStorage keying to tracker id
- [ ] 6.2 Frontend: Sidebar nav Clients → Trackers (`/trackers`); i18n en/pl keys for nav and tracker strings; remove client keys or alias only if needed for one release
- [ ] 6.3 Frontend test: E2E Trackers CRUD flow (create, edit, delete confirm) + empty state
- [ ] 6.4 Frontend test: Nuxt/unit shell nav lists Trackers and not Clients (`href="/trackers"`)

## 7. Frontend Projects UI

- [ ] 7.1 Frontend: Projects page — optional Tracker select/filter, `trackerName` column, confirm on detach when linked tasks exist; drop client required validation
- [ ] 7.2 Frontend test: E2E create local project, create under tracker, detach with confirmation path

## 8. Frontend timer, sync, and utilities

- [ ] 8.1 Frontend: Timer grouping/labels show project only; update `useActiveRemoteConfigs` and issue picker eligibility to project.trackerId; Remote Sync copy/state for missing tracker
- [ ] 8.2 Frontend test: Unit tests for timer view grouping utility (no client/tracker secondary segment)
- [ ] 8.3 Frontend test: E2E or nuxt coverage that ineligible local/project-less rows hide issue control / show read-only sync reason

## 9. Sweep, docs, verification

- [ ] 9.1 Backend/Frontend: Grep sweep — remove remaining `clientId`/`clientName`/`/api/clients`/`RemoteSystemConfig` production references; fix test seeds/factories/fixtures
- [ ] 9.2 Docs: Update `docs/vision.md` and `docs/wbs.md` hierarchy language (Client → Tracker; optional project parent)
- [ ] 9.3 Verification: Run `pnpm lint`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:nuxt`, and `pnpm test:e2e` green
